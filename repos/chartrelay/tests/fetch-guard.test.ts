/**
 * The SSRF guard, including the spec's stress-test row:
 *
 *   | Spec requests `http://169.254.169.254` image | 400 `remote_fetch_blocked`, logged |
 *
 * Every test here asserts both halves where the spec asks for both: the refusal *and* the log line,
 * because "logged" is what turns a blocked probe into something anyone will ever find out about.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  assertSafeFetchUrl,
  classifyAddress,
  EXPLICITLY_BLOCKED_SCHEMES,
  guardedFetch,
  isPublicAddress,
  pinTarget,
  redactUrl,
  RemoteFetchBlockedError,
  resetFetchGuardLogger,
  setFetchGuardLogger,
  type FetchGuardLogEntry,
  type GuardedTransport,
  type HostLookup,
} from "@/lib/security/fetch-guard";
import { ERROR_CODES } from "@/lib/http/errors";

let logged: FetchGuardLogEntry[] = [];

beforeEach(() => {
  logged = [];
  setFetchGuardLogger((entry) => logged.push(entry));
});

afterEach(() => {
  resetFetchGuardLogger();
});

/** The address of the cloud instance-metadata service, named here so the intent is unmistakable. */
const METADATA = "169.254.169.254";

const blocked = (fn: () => unknown): RemoteFetchBlockedError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof RemoteFetchBlockedError) return error;
    throw error;
  }
  throw new Error("Expected the URL to be refused, but it was allowed.");
};

const blockedAsync = async (fn: () => Promise<unknown>): Promise<RemoteFetchBlockedError> => {
  try {
    await fn();
  } catch (error) {
    if (error instanceof RemoteFetchBlockedError) return error;
    throw error;
  }
  throw new Error("Expected the fetch to be refused, but it was allowed.");
};

const publicLookup: HostLookup = async () => ["93.184.216.34"];

describe("the stress-test row: a spec asking for http://169.254.169.254", () => {
  it("refuses it with 400 remote_fetch_blocked, names the reason, and logs it", async () => {
    // Exactly the URL from docs/BILLING_SPEC.md, with the path an attacker actually wants.
    const url = `http://${METADATA}/latest/meta-data/iam/security-credentials/`;
    const error = await blockedAsync(() => pinTarget(url));

    // The published contract: a 400 under the code the spec names.
    expect(error.code).toBe("remote_fetch_blocked");
    expect(error.status).toBe(400);
    expect(ERROR_CODES.remote_fetch_blocked.status).toBe(400);

    // A reason a program can branch on, and a message a person can act on.
    expect(error.reason).toBe("scheme_not_https");
    expect(error.message).toMatch(/http:/);

    // "logged" is half the requirement. One entry, carrying the reason and the redacted URL.
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ event: "remote_fetch_blocked", reason: "scheme_not_https", hop: 0 });
    expect(logged[0].url).toContain(METADATA);
  });

  it("still refuses it over https, naming link-local metadata as the reason", async () => {
    // Upgrading the scheme is the obvious next attempt, and the address is the real problem.
    const error = await blockedAsync(() => pinTarget(`https://${METADATA}/latest/meta-data/`));
    expect(error.reason).toBe("address_not_public");
    expect(error.address).toBe(METADATA);
    expect(error.message).toMatch(/link-local/);
    expect(error.message).toMatch(/metadata/);
    expect(logged.map((entry) => entry.reason)).toEqual(["address_not_public"]);
  });

  it("refuses a hostname that resolves to the metadata address", async () => {
    // The usual bypass: a public name with a private A record. The guard resolves before it dials.
    const error = await blockedAsync(() => pinTarget("https://metadata.example.test/", { lookup: async () => [METADATA] }));
    expect(error.reason).toBe("address_not_public");
    expect(error.address).toBe(METADATA);
    expect(logged[0].address).toBe(METADATA);
  });

  it("refuses every IPv6 spelling of the metadata address", async () => {
    const spellings = [
      `[::ffff:${METADATA}]`, // IPv4-mapped, dotted tail
      "[::ffff:a9fe:a9fe]", // IPv4-mapped, hex tail — same 16 bytes, looks nothing like it
      `[::${METADATA}]`, // IPv4-compatible
      `[64:ff9b::${METADATA}]`, // NAT64: a translator dials the embedded IPv4
      "[2002:a9fe:a9fe::1]", // 6to4 wraps the IPv4 address in bytes 2-5
    ];
    for (const host of spellings) {
      const error = await blockedAsync(() => pinTarget(`https://${host}/latest/meta-data/`));
      expect(error.reason, host).toBe("address_not_public");
      expect(error.message, host).toMatch(/link-local/);
    }
  });

  it("refuses the metadata address when it appears only after a redirect", async () => {
    // A redirect is a new request to a host the caller never named. Checking only the first URL is
    // the single most common way an SSRF filter is bypassed.
    const transport: GuardedTransport = async (target) =>
      target.url.hostname === "images.example.test"
        ? { status: 302, location: `http://${METADATA}/latest/meta-data/` }
        : { status: 200, body: "should never be reached" };
    const error = await blockedAsync(() => guardedFetch("https://images.example.test/logo.png", transport, { lookup: publicLookup }));
    expect(error.reason).toBe("scheme_not_https");
    expect(error.hop).toBe(1);
    expect(logged[0].hop).toBe(1);
    expect(logged[0].url).toContain(METADATA);
  });

  it("refuses a relative redirect that lands on a host resolving to the metadata address", async () => {
    const lookup: HostLookup = async (hostname) => (hostname === "cdn.example.test" ? ["93.184.216.34"] : [METADATA]);
    const transport: GuardedTransport = async (target) =>
      target.url.hostname === "cdn.example.test" ? { status: 301, location: "https://internal.example.test/meta" } : { status: 200 };
    const error = await blockedAsync(() => guardedFetch("https://cdn.example.test/a.png", transport, { lookup }));
    expect(error.reason).toBe("address_not_public");
    expect(error.hop).toBe(1);
  });
});

describe("schemes", () => {
  it("allows https and nothing else", () => {
    expect(assertSafeFetchUrl("https://example.com/logo.png").protocol).toBe("https:");
    for (const scheme of EXPLICITLY_BLOCKED_SCHEMES) {
      const error = blocked(() => assertSafeFetchUrl(`${scheme}${scheme.endsWith(":") ? "//" : ""}example.com/x`));
      expect(error.reason, scheme).toBe("scheme_not_https");
    }
  });

  it("names file:, chrome: and data: specifically, as the spec does", () => {
    for (const url of ["file:///etc/passwd", "chrome://settings/", "data:text/html;base64,PHN2Zz48L3N2Zz4=", "chrome-extension://abcdef/page.html"]) {
      const error = blocked(() => assertSafeFetchUrl(url));
      expect(error.reason, url).toBe("scheme_not_https");
      expect(error.message, url).toMatch(/blocked|not allowed/);
      expect(error.message, url).toMatch(/https/);
    }
    expect(logged).toHaveLength(4);
  });

  it("refuses a URL carrying credentials and a non-443 port", () => {
    expect(blocked(() => assertSafeFetchUrl("https://user:secret@example.com/x")).reason).toBe("credentials_in_url");
    expect(blocked(() => assertSafeFetchUrl("https://example.com:25/x")).reason).toBe("port_not_allowed");
    expect(blocked(() => assertSafeFetchUrl("https://example.com:6379/x")).reason).toBe("port_not_allowed");
    // A credential must never survive into a log line.
    expect(logged[0].url).not.toContain("secret");
  });

  it("refuses something that is not a URL at all", () => {
    expect(blocked(() => assertSafeFetchUrl("not a url")).reason).toBe("hostname_missing");
    expect(logged[0].url).toBe("(unparseable url)");
  });
});

describe("address classification", () => {
  it("classifies the blocks the spec names, and the IPv6 equivalents", () => {
    const cases: Array<[string, string]> = [
      ["0.0.0.0", "unspecified"],
      ["127.0.0.1", "loopback"],
      ["127.255.255.254", "loopback"],
      ["10.0.0.1", "private"],
      ["172.16.0.1", "private"],
      ["172.31.255.255", "private"],
      ["192.168.1.1", "private"],
      ["100.64.0.1", "carrier-grade-nat"],
      ["100.127.255.255", "carrier-grade-nat"],
      [METADATA, "link-local"],
      ["169.254.0.1", "link-local"],
      ["224.0.0.1", "multicast"],
      ["255.255.255.255", "broadcast"],
      ["240.0.0.1", "reserved"],
      ["198.18.0.1", "benchmark"],
      ["203.0.113.1", "documentation"],
      ["::1", "loopback"],
      ["::", "unspecified"],
      ["fc00::1", "unique-local"],
      ["fd12:3456:789a::1", "unique-local"],
      ["fe80::1", "link-local"],
      ["fec0::1", "site-local"],
      ["ff02::1", "multicast"],
      ["2001:db8::1", "documentation"],
      ["100::1", "discard"],
      ["::ffff:127.0.0.1", "loopback"],
      ["::ffff:10.0.0.1", "private"],
      [`::ffff:${METADATA}`, "link-local"],
      // Public, and must stay public: an over-eager guard that blocks these blocks the product.
      ["8.8.8.8", "public"],
      ["1.1.1.1", "public"],
      ["93.184.216.34", "public"],
      ["172.32.0.1", "public"],
      ["172.15.255.255", "public"],
      ["100.63.255.255", "public"],
      ["100.128.0.1", "public"],
      ["169.253.255.255", "public"],
      ["2606:4700:4700::1111", "public"],
      ["2a00:1450:4001::200e", "public"],
    ];
    for (const [address, expected] of cases) expect(classifyAddress(address), address).toBe(expected);
  });

  it("treats anything it cannot parse as reserved rather than public", () => {
    // Fail closed. A string we cannot classify is a string we cannot vouch for.
    for (const value of ["", "example.com", "1.2.3", "999.1.1.1", "0x7f.1", "2130706433", "::ffff:999.1.1.1", "garbage"]) {
      expect(isPublicAddress(value), value).toBe(false);
    }
  });

  it("handles an IPv6 zone id without letting it through", () => {
    expect(classifyAddress("fe80::1%eth0")).toBe("link-local");
  });
});

describe("resolve once, pin the result", () => {
  it("pins the resolved address and reports every answer", async () => {
    const target = await pinTarget("https://cdn.example.test/logo.png", { lookup: async () => ["93.184.216.34", "1.1.1.1"] });
    expect(target.pinned).toBe("93.184.216.34");
    expect(target.addresses).toEqual(["93.184.216.34", "1.1.1.1"]);
    expect(logged).toHaveLength(0);
  });

  it("refuses when any single answer is private, not just the one it would pick", async () => {
    // This is what makes the pin worth having: a rebinding record that answers both a public and a
    // private address has nothing left to flip to, because the whole answer set is refused.
    const error = await blockedAsync(() => pinTarget("https://rebind.example.test/x", { lookup: async () => ["93.184.216.34", "127.0.0.1"] }));
    expect(error.reason).toBe("address_not_public");
    expect(error.address).toBe("127.0.0.1");
  });

  it("resolves exactly once per hop", async () => {
    let lookups = 0;
    const lookup: HostLookup = async () => {
      lookups += 1;
      return ["93.184.216.34"];
    };
    const transport: GuardedTransport = async () => ({ status: 200, body: "ok" });
    await guardedFetch("https://cdn.example.test/logo.png", transport, { lookup });
    expect(lookups).toBe(1);
  });

  it("refuses a hostname that does not resolve, or resolves to nothing", async () => {
    expect((await blockedAsync(() => pinTarget("https://nope.example.test/", { lookup: async () => [] }))).reason).toBe("hostname_not_resolvable");
    expect((await blockedAsync(() => pinTarget("https://nope.example.test/", { lookup: async () => { throw new Error("ENOTFOUND"); } }))).reason).toBe("hostname_not_resolvable");
  });

  it("never dials anything it refused", async () => {
    let dialled = 0;
    const transport: GuardedTransport = async () => {
      dialled += 1;
      return { status: 200 };
    };
    await blockedAsync(() => guardedFetch(`https://${METADATA}/x`, transport, { lookup: publicLookup }));
    expect(dialled).toBe(0);
  });
});

describe("redirects", () => {
  it("re-checks every hop and returns the final response", async () => {
    const seen: string[] = [];
    const transport: GuardedTransport = async (target) => {
      seen.push(target.url.toString());
      return seen.length === 1 ? { status: 302, location: "https://two.example.test/b" } : { status: 200, body: "png" };
    };
    const result = await guardedFetch("https://one.example.test/a", transport, { lookup: publicLookup });
    expect(result.status).toBe(200);
    expect(result.body).toBe("png");
    expect(result.chain).toEqual(["https://one.example.test/a", "https://two.example.test/b"]);
    expect(seen).toHaveLength(2);
  });

  it("stops a redirect loop", async () => {
    const transport: GuardedTransport = async () => ({ status: 302, location: "https://loop.example.test/next" });
    const error = await blockedAsync(() => guardedFetch("https://loop.example.test/start", transport, { lookup: publicLookup, maxRedirects: 3 }));
    expect(error.reason).toBe("too_many_redirects");
  });

  it("refuses a redirect with no Location", async () => {
    const transport: GuardedTransport = async () => ({ status: 302, location: null });
    expect((await blockedAsync(() => guardedFetch("https://a.example.test/x", transport, { lookup: publicLookup }))).reason).toBe("redirect_without_location");
  });
});

describe("logging is safe to log", () => {
  it("strips the query string, the fragment and any userinfo", () => {
    expect(redactUrl("https://u:p@example.com/a/b?sig=deadbeef&key=cr_live_x#frag")).toBe("https://example.com/a/b");
  });

  it("never lets a newline into a log line", () => {
    // A caller-supplied URL reaching a log is log-injection material.
    expect(redactUrl("https://example.com/a%0A%0DX-Fake: 1")).not.toMatch(/[\r\n]/);
  });
});

describe("honesty about who calls this", () => {
  it("is called by nothing in src/, exactly as its doc comment says", () => {
    // The doc comment claims the guard is unused today. A claim like that rots silently, and a
    // guard believed to be wired in when it is not is more dangerous than no guard at all. If
    // someone wires it up, this test fails and they update the doc comment in the same change.
    const root = path.resolve(import.meta.dirname, "../src");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        if (full.endsWith(path.join("security", "fetch-guard.ts"))) continue;
        if (/fetch-guard|assertSafeFetchUrl|guardedFetch|pinTarget/.test(readFileSync(full, "utf8"))) offenders.push(path.relative(root, full));
      }
    };
    walk(root);
    expect(offenders, "fetch-guard now has callers — update its doc comment and this test together").toEqual([]);
  });
});
