import { describe, expect, it } from "vitest";
import {
  canonicalRequest, createSigningSecret, signQuery, signRequest, signUrl,
  strictEncode, timingSafeEqualHex, verifySignature, verifySignedUrl,
} from "@/lib/auth/signing";

const SECRET_A = "crsig_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_B = "crsig_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const PATH = "/chart";

describe("the signing secret", () => {
  it("is crsig_ plus 43 Base62 digits, and never repeats", () => {
    const secret = createSigningSecret();
    expect(secret).toMatch(/^crsig_[0-9A-Za-z]{43}$/);
    expect(new Set(Array.from({ length: 100 }, createSigningSecret)).size).toBe(100);
  });
});

describe("the canonical string", () => {
  it("is method, path and sorted parameters, and nothing else", () => {
    expect(canonicalRequest({ method: "GET", path: PATH, params: { b: "2", a: "1" } })).toBe("GET\n/chart\na=1&b=2");
  });

  it("cannot be made the same by two different parameter sets", () => {
    // The bug this exists to prevent: with a naive join, {a:1, b:2} and the single parameter literally
    // named "a=1&b" with value "2" both flatten to "a=1&b=2". One signature would then be valid for
    // both, so signing the honest URL silently signs the hostile one. That is a forgery.
    const honest = canonicalRequest({ path: PATH, params: { a: "1", b: "2" } });
    const smuggled = canonicalRequest({ path: PATH, params: { "a=1&b": "2" } });
    expect(honest).not.toBe(smuggled);
    expect(smuggled).toContain("a%3D1%26b=2");

    // And the signature follows: one does not verify the other.
    const query = signQuery({ path: PATH, params: { a: "1", b: "2" }, secret: SECRET_A });
    const forged = verifySignature({
      path: PATH,
      params: [["a=1&b", "2"], ["sig", query.get("sig") as string]],
      secrets: [SECRET_A],
    });
    expect(forged).toEqual({ ok: false, code: "signature_invalid", reason: "mismatch" });
  });

  it("separates an empty value from an absent one, and a space from a plus", () => {
    const sets = [
      canonicalRequest({ path: PATH, params: { a: "" } }),
      canonicalRequest({ path: PATH, params: {} }),
      canonicalRequest({ path: PATH, params: { a: "a b" } }),
      canonicalRequest({ path: PATH, params: { a: "a+b" } }),
      canonicalRequest({ path: PATH, params: { a: "a", b: "" } }),
      canonicalRequest({ path: PATH, params: { "a&b": "" } }),
    ];
    expect(new Set(sets).size).toBe(sets.length);
    expect(strictEncode("a b")).toBe("a%20b");
    expect(strictEncode("a+b")).toBe("a%2Bb");
    // encodeURIComponent leaves these alone; two spellings of one value is two valid signatures.
    expect(strictEncode("!'()*")).toBe("%21%27%28%29%2A");
    expect(strictEncode("~-._")).toBe("~-._");
  });

  it("does not depend on the order the caller happened to use", () => {
    const forwards = canonicalRequest({ path: PATH, params: [["t", "bar"], ["title", "Q3"], ["w", "800"]] });
    const backwards = canonicalRequest({ path: PATH, params: [["w", "800"], ["title", "Q3"], ["t", "bar"]] });
    expect(forwards).toBe(backwards);
  });

  it("keeps a repeated parameter as a repeat", () => {
    // Collapsing duplicates would let "series=a&series=b" and "series=a" share one signature.
    const both = canonicalRequest({ path: PATH, params: [["s", "a"], ["s", "b"]] });
    expect(both).toBe("GET\n/chart\ns=a&s=b");
    expect(both).not.toBe(canonicalRequest({ path: PATH, params: [["s", "a"]] }));
  });

  it("covers the method and the path", () => {
    const base = { path: PATH, params: { a: "1" } };
    expect(canonicalRequest({ ...base, method: "GET" })).not.toBe(canonicalRequest({ ...base, method: "POST" }));
    expect(canonicalRequest({ ...base, method: "get" })).toBe(canonicalRequest({ ...base, method: "GET" }));
    expect(canonicalRequest({ ...base, path: "/chart" })).not.toBe(canonicalRequest({ ...base, path: "/charts" }));
    // A path cannot smuggle a newline or an ampersand past the section separators.
    expect(canonicalRequest({ ...base, path: "/ch\nart" })).toBe("GET\n/ch%0Aart\na=1");
    expect(() => canonicalRequest({ ...base, method: "GET /chart?a=1 HTTP/1.1" })).toThrow();
  });

  it("excludes sig, because a signature cannot sign itself", () => {
    const withSig = canonicalRequest({ path: PATH, params: { a: "1", sig: "deadbeef" } });
    expect(withSig).toBe(canonicalRequest({ path: PATH, params: { a: "1" } }));
  });
});

describe("verifying a signed URL", () => {
  const params = { kid: "pk_live_0123456789abcdef", t: "bar", title: "Q3 revenue (EU)", w: "800" };

  it("accepts the URL it produced", () => {
    const url = signUrl({ origin: "https://chartrelay.dev", path: PATH, params, secret: SECRET_A });
    expect(url.startsWith("https://chartrelay.dev/chart?")).toBe(true);
    expect(verifySignedUrl(url, [SECRET_A])).toEqual({ ok: true, secretIndex: 0 });
  });

  it("refuses an unsigned URL with signature_required, not signature_invalid", () => {
    // The two are a different instruction to the caller: one means "sign it", the other means "your
    // signature is wrong". Collapsing them makes a misconfigured embed undebuggable.
    expect(verifySignedUrl("https://chartrelay.dev/chart?t=bar", [SECRET_A]))
      .toEqual({ ok: false, code: "signature_required", reason: "missing" });
  });

  it("refuses two sig parameters rather than picking one", () => {
    const query = signQuery({ path: PATH, params, secret: SECRET_A });
    const result = verifySignature({
      path: PATH,
      params: [...query.entries(), ["sig", "00"]],
      secrets: [SECRET_A],
    });
    expect(result).toEqual({ ok: false, code: "signature_invalid", reason: "malformed" });
  });

  it("notices a changed, added or removed parameter", () => {
    const query = signQuery({ path: PATH, params, secret: SECRET_A });
    const sig = query.get("sig") as string;
    const check = (changed: Record<string, string | undefined>) => {
      const next = new URLSearchParams(query);
      for (const [name, value] of Object.entries(changed)) {
        if (value === undefined) next.delete(name);
        else next.set(name, value);
      }
      return verifySignature({ path: PATH, params: next, secrets: [SECRET_A] });
    };
    expect(check({ w: "4000" }).ok).toBe(false);
    expect(check({ extra: "1" }).ok).toBe(false);
    expect(check({ w: undefined }).ok).toBe(false);
    expect(check({ kid: "pk_live_somebodyelse00" }).ok).toBe(false);
    expect(check({}).ok).toBe(true);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses a signature from a different path, method or secret", () => {
    const sig = signRequest({ path: PATH, params, secret: SECRET_A });
    const withSig = { ...params, sig };
    expect(verifySignature({ path: "/chart-check", params: withSig, secrets: [SECRET_A] }).ok).toBe(false);
    expect(verifySignature({ method: "POST", path: PATH, params: withSig, secrets: [SECRET_A] }).ok).toBe(false);
    expect(verifySignature({ path: PATH, params: withSig, secrets: [SECRET_B] }).ok).toBe(false);
    expect(verifySignature({ path: PATH, params: withSig, secrets: [SECRET_A] }).ok).toBe(true);
  });

  it("refuses a malformed signature without throwing", () => {
    for (const sig of ["", "zz", "deadbeef", "0".repeat(63), "0".repeat(64), "not hex at all!!"]) {
      const result = verifySignature({ path: PATH, params: { ...params, sig }, secrets: [SECRET_A] });
      expect(result.ok).toBe(false);
    }
  });

  it("has no signing secret to check against, and says so instead of passing", () => {
    const sig = signRequest({ path: PATH, params, secret: SECRET_A });
    expect(verifySignature({ path: PATH, params: { ...params, sig }, secrets: [] }))
      .toEqual({ ok: false, code: "signature_invalid", reason: "no_secret" });
    expect(verifySignature({ path: PATH, params: { ...params, sig }, secrets: [""] }).ok).toBe(false);
  });
});

describe("two active secrets per key", () => {
  it("verifies a URL signed with either one, so rotating does not break published embeds", () => {
    const withOld = signQuery({ path: PATH, params: { t: "bar" }, secret: SECRET_A });
    const withNew = signQuery({ path: PATH, params: { t: "bar" }, secret: SECRET_B });
    const secrets = [SECRET_B, SECRET_A];
    expect(verifySignature({ path: PATH, params: withOld, secrets })).toEqual({ ok: true, secretIndex: 1 });
    expect(verifySignature({ path: PATH, params: withNew, secrets })).toEqual({ ok: true, secretIndex: 0 });
    // And dropping the old secret is what finishes the rotation.
    expect(verifySignature({ path: PATH, params: withOld, secrets: [SECRET_B] }).ok).toBe(false);
  });
});

describe("expiry", () => {
  const future = Math.floor(Date.now() / 1000) + 3600;

  it("is honoured, and is part of what was signed", () => {
    const query = signQuery({ path: PATH, params: { t: "bar" }, secret: SECRET_A, expires: future });
    expect(query.get("exp")).toBe(String(future));
    expect(verifySignature({ path: PATH, params: query, secrets: [SECRET_A] }).ok).toBe(true);
    expect(verifySignature({ path: PATH, params: query, secrets: [SECRET_A], now: new Date((future + 1) * 1000) }))
      .toEqual({ ok: false, code: "signature_invalid", reason: "expired" });
    // Pushing the expiry out is a forgery, not a renewal.
    const extended = new URLSearchParams(query);
    extended.set("exp", String(future + 86_400));
    expect(verifySignature({ path: PATH, params: extended, secrets: [SECRET_A] }).ok).toBe(false);
  });

  it("is permanent when absent", () => {
    const query = signQuery({ path: PATH, params: { t: "bar" }, secret: SECRET_A });
    expect(query.has("exp")).toBe(false);
    expect(verifySignature({ path: PATH, params: query, secrets: [SECRET_A], now: new Date(2_200_000_000_000) }).ok).toBe(true);
  });

  it("is only believed once the signature proves we wrote it", () => {
    // exp is a query parameter. Reading it before the HMAC matches would let anyone turn a permanent
    // URL into an expired one — a denial of service that needs no secret.
    const result = verifySignature({ path: PATH, params: { t: "bar", exp: "1", sig: "00".repeat(32) }, secrets: [SECRET_A] });
    expect(result).toEqual({ ok: false, code: "signature_invalid", reason: "mismatch" });
  });

  it("refuses an exp that is not a count of seconds", () => {
    for (const exp of ["soon", "-1", "1e9", "1.5", ""]) {
      // Signed deliberately, so the rejection is the exp check and not a signature mismatch: an
      // unparseable exp must be refused, never read as "no expiry".
      const sig = signRequest({ path: PATH, params: { t: "bar", exp }, secret: SECRET_A });
      expect(verifySignature({ path: PATH, params: { t: "bar", exp, sig }, secrets: [SECRET_A] }))
        .toEqual({ ok: false, code: "signature_invalid", reason: "malformed" });
    }
  });
});

describe("the comparison", () => {
  it("is length- and alphabet-checked, then constant-time over the bytes", () => {
    const digest = "a".repeat(64);
    expect(timingSafeEqualHex(digest, digest)).toBe(true);
    expect(timingSafeEqualHex(digest, `b${digest.slice(1)}`)).toBe(false);
    expect(timingSafeEqualHex(digest, digest.toUpperCase())).toBe(true);
    // Different lengths must answer false rather than throw: timingSafeEqual throws on a length
    // mismatch, and a throw inside a verifier is a 500 on a merely-wrong signature.
    expect(timingSafeEqualHex(digest, digest.slice(0, 62))).toBe(false);
    expect(timingSafeEqualHex("", "")).toBe(false);
    expect(timingSafeEqualHex("zz", "zz")).toBe(false);
    expect(timingSafeEqualHex("abc", "abd")).toBe(false);
  });
});
