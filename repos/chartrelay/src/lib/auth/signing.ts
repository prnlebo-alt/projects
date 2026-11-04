import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { base62Encode } from "./key-utils";

/**
 * HMAC-SHA256 signatures for `GET /chart` URLs (docs/BILLING_SPEC.md, "Signed GET /chart").
 *
 * **Nothing calls this yet.** `src/app/chart/route.ts` does not verify signatures and is owned by
 * another engineer; this module is the library that route will use, built and tested on its own so the
 * wiring is a small, reviewable change rather than a new protocol invented inside a request handler.
 *
 * The one thing worth reading carefully is `canonicalRequest`. A signature does not protect a request;
 * it protects *a string*, and the request is only as protected as the mapping from request to string
 * is injective. A canonical form built by joining names and values with `&` and `=` is not injective:
 * the parameters `{"a": "1", "b": "2"}` and the single parameter named `a=1&b` with value `2` both
 * flatten to `a=1&b=2`, so one signature is valid for both, and a customer who signs the first has
 * unknowingly signed the second. That is a forgery, not a formatting preference. So every name and
 * value is percent-encoded to RFC 3986 unreserved characters before any separator is added, which
 * leaves `&` and `=` impossible inside the data and the mapping one-to-one. `tests/signing.test.ts`
 * holds that exact collision as a test.
 *
 * Two secrets are active per key so that rotating the signing secret does not break the embeds a
 * customer has already published: sign with the new one, keep verifying against both, drop the old one
 * when the embeds have turned over.
 */

export const SIGNING_SECRET_PREFIX = "crsig_";
const SIGNING_SECRET_BYTES = 32;
/** 62**43 > 2**256, so 43 digits always hold 32 bytes. Same renderer as the API keys, for one alphabet. */
const SIGNING_SECRET_BODY = 43;

export function createSigningSecret(): string {
  return `${SIGNING_SECRET_PREFIX}${base62Encode(randomBytes(SIGNING_SECRET_BYTES), SIGNING_SECRET_BODY)}`;
}

/** The parameter carrying the signature. Excluded from the canonical string, because it cannot sign itself. */
export const SIGNATURE_PARAM = "sig";
/** Optional expiry, in seconds since the epoch. Signed like any other parameter, so it cannot be edited. */
export const EXPIRY_PARAM = "exp";

export type QueryInput = URLSearchParams | Iterable<readonly [string, string]> | Record<string, string | number | readonly string[]>;

function toPairs(params: QueryInput): Array<[string, string]> {
  if (params instanceof URLSearchParams) return [...params.entries()];
  if (typeof (params as Iterable<readonly [string, string]>)[Symbol.iterator] === "function") {
    return [...(params as Iterable<readonly [string, string]>)].map(([name, value]) => [name, value]);
  }
  const pairs: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(params as Record<string, string | number | readonly string[]>)) {
    if (Array.isArray(value)) for (const item of value) pairs.push([name, String(item)]);
    else pairs.push([name, String(value)]);
  }
  return pairs;
}

/**
 * RFC 3986 percent-encoding: everything outside `A-Za-z0-9-._~` is escaped.
 *
 * `encodeURIComponent` leaves `!'()*` alone, which is harmless for a URL and not harmless here — two
 * different canonical forms for the same data means two valid signatures, and a verifier that
 * normalises differently from the signer rejects honest requests.
 */
export function strictEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodePath(path: string): string {
  return path.split("/").map(strictEncode).join("/");
}

/**
 * The exact bytes that get signed:
 *
 * ```
 * GET\n/chart\na=1&b=2
 * ```
 *
 * Method uppercased and restricted to letters, path percent-encoded segment by segment, parameters
 * sorted by encoded name then encoded value so the caller's ordering cannot change the result, `sig`
 * removed, and repeated parameters kept as repeats — dropping a duplicate would let `a=1&a=2` and
 * `a=1` share a signature.
 */
export function canonicalRequest(request: { method?: string; path: string; params: QueryInput }): string {
  const method = (request.method ?? "GET").toUpperCase();
  if (!/^[A-Z]+$/.test(method)) throw new Error(`Not an HTTP method: ${request.method}`);
  const encoded = toPairs(request.params)
    .filter(([name]) => name !== SIGNATURE_PARAM)
    .map(([name, value]) => [strictEncode(name), strictEncode(value)] as const)
    .sort((left, right) => (left[0] === right[0] ? (left[1] < right[1] ? -1 : left[1] > right[1] ? 1 : 0) : left[0] < right[0] ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  return `${method}\n${encodePath(request.path)}\n${encoded}`;
}

export function signRequest(request: { method?: string; path: string; params: QueryInput; secret: string }): string {
  return createHmac("sha256", request.secret).update(canonicalRequest(request), "utf8").digest("hex");
}

/**
 * The query string a customer should publish: their parameters, optional `exp`, and `sig`.
 *
 * Returns `URLSearchParams` rather than a string so the caller decides how to join it to an origin,
 * and so the `sig` is never re-encoded by a second pass.
 */
export function signQuery(request: {
  method?: string;
  path: string;
  params: QueryInput;
  secret: string;
  /** Seconds since the epoch, or a Date. Omit for a URL that never expires. */
  expires?: number | Date;
}): URLSearchParams {
  const pairs = toPairs(request.params).filter(([name]) => name !== SIGNATURE_PARAM && name !== EXPIRY_PARAM);
  if (request.expires !== undefined) {
    const seconds = request.expires instanceof Date ? Math.floor(request.expires.getTime() / 1000) : Math.floor(request.expires);
    pairs.push([EXPIRY_PARAM, String(seconds)]);
  }
  const query = new URLSearchParams(pairs);
  query.set(SIGNATURE_PARAM, signRequest({ ...request, params: pairs }));
  return query;
}

/** A full signed URL, for the dashboard's "sign this URL" tool and for the published helpers. */
export function signUrl(request: { origin: string; path: string; params: QueryInput; secret: string; expires?: number | Date }): string {
  return `${request.origin.replace(/\/$/, "")}${request.path}?${signQuery(request).toString()}`;
}

export type SignatureFailure = "missing" | "malformed" | "mismatch" | "expired" | "no_secret";

export type SignatureResult =
  | { ok: true; secretIndex: number }
  /** `code` is the published error contract's code; `reason` is for the log line. */
  | { ok: false; code: "signature_required" | "signature_invalid"; reason: SignatureFailure };

const HEX = /^[0-9a-fA-F]+$/;

/**
 * Constant-time comparison of two hex digests.
 *
 * Length and alphabet are checked first and in the clear: both are public facts about the *format*,
 * not about the secret. Only the bytes go through `timingSafeEqual`, which is what stops a caller
 * learning the right signature one character at a time from how long a rejection takes.
 */
export function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length || left.length === 0 || left.length % 2 !== 0) return false;
  if (!HEX.test(left) || !HEX.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

/**
 * Verify a signed request against every active secret for the key.
 *
 * Expiry is checked **after** the signature, deliberately. `exp` is a query parameter, so before the
 * HMAC matches there is no reason to believe we wrote it; treating an unverified `exp` as authoritative
 * would let anyone turn a permanent URL into an expired one, or an expired one into a live one.
 */
export function verifySignature(request: {
  method?: string;
  path: string;
  /** The request's parameters, `sig` included. */
  params: QueryInput;
  /** Both active secrets for the key. Order does not matter. */
  secrets: readonly string[];
  now?: Date;
}): SignatureResult {
  const pairs = toPairs(request.params);
  const provided = pairs.filter(([name]) => name === SIGNATURE_PARAM).map(([, value]) => value);
  if (provided.length === 0) return { ok: false, code: "signature_required", reason: "missing" };
  // Two `sig` parameters is an attempt to have one of them ignored, not an honest request.
  if (provided.length > 1) return { ok: false, code: "signature_invalid", reason: "malformed" };
  const usable = request.secrets.filter((secret) => secret.length > 0);
  if (usable.length === 0) return { ok: false, code: "signature_invalid", reason: "no_secret" };

  const canonical = canonicalRequest({ method: request.method, path: request.path, params: pairs });
  let matched = -1;
  for (const [index, secret] of usable.entries()) {
    const expected = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (timingSafeEqualHex(expected, provided[0])) matched = index;
  }
  if (matched < 0) return { ok: false, code: "signature_invalid", reason: "mismatch" };

  const expiries = pairs.filter(([name]) => name === EXPIRY_PARAM).map(([, value]) => value);
  if (expiries.length > 1) return { ok: false, code: "signature_invalid", reason: "malformed" };
  if (expiries.length === 1) {
    if (!/^\d{1,15}$/.test(expiries[0])) return { ok: false, code: "signature_invalid", reason: "malformed" };
    const now = request.now ?? new Date();
    if (Number(expiries[0]) * 1000 <= now.getTime()) return { ok: false, code: "signature_invalid", reason: "expired" };
  }
  return { ok: true, secretIndex: matched };
}

/** The same check starting from a URL, which is the shape the route will have. */
export function verifySignedUrl(url: string | URL, secrets: readonly string[], now: Date = new Date()): SignatureResult {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return verifySignature({ method: "GET", path: parsed.pathname, params: parsed.searchParams, secrets, now });
}
