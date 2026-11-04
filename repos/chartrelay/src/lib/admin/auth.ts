import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shortest ADMIN_TOKEN this build will accept. A backup download hands over the entire database, so a
 * guessable token is worse than no endpoint at all: below this length the admin surface stays disabled.
 * Generate one with `openssl rand -hex 32`.
 */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

type Env = Record<string, string | undefined>;

/** SHA-256 digests are always 32 bytes, so timingSafeEqual can never throw on a length mismatch. */
function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Whether an admin token is configured and long enough to be worth trusting.
 * Callers use this to keep admin routes invisible (404) rather than merely locked (401) on installs
 * that never opted into them, so an unused endpoint does not advertise itself.
 */
export function adminTokenConfigured(env: Env = process.env): boolean {
  const token = env.ADMIN_TOKEN;
  return typeof token === "string" && token.length >= MIN_ADMIN_TOKEN_LENGTH;
}

/** Extracts the credential from an `Authorization: Bearer <token>` header. The scheme is case-insensitive (RFC 7235). */
function bearerCredential(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const separator = header.indexOf(" ");
  if (separator === -1) return null;
  if (header.slice(0, separator).toLowerCase() !== "bearer") return null;
  const credential = header.slice(separator + 1).trim();
  return credential === "" ? null : credential;
}

/**
 * Authorizes an admin request against ADMIN_TOKEN.
 *
 * Fails closed: an unset, too-short, or non-string ADMIN_TOKEN authorizes nobody, so a misconfigured
 * deployment can never accidentally expose the admin surface. The comparison runs over SHA-256 digests
 * with timingSafeEqual, which keeps it constant-time and independent of the tokens' lengths — a plain
 * `===` would leak the shared prefix through its exit time. The token is never logged or returned.
 */
export function authorizeAdmin(request: Request, env: Env = process.env): boolean {
  const expected = env.ADMIN_TOKEN;
  if (typeof expected !== "string" || expected.length < MIN_ADMIN_TOKEN_LENGTH) return false;
  const presented = bearerCredential(request);
  if (presented === null) return false;
  return timingSafeEqual(digest(presented), digest(expected));
}
