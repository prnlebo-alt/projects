import { createHash, randomBytes } from "node:crypto";

/**
 * The shape of a ChartRelay secret key, and the arithmetic that lets a bad one be thrown away for free.
 *
 * `cr_live_` / `cr_test_` + 32 random bytes in Base62 + a 6-character CRC32 checksum
 * (docs/BILLING_SPEC.md, "Keys and signed URLs").
 *
 * The checksum is the only part of this file that has to justify itself, so: it is not integrity
 * protection. Anyone can compute CRC32. What it buys is that a mistyped, truncated, fabricated or
 * copy-paste-mangled key is provably not ours **before** a database round trip, which turns the
 * cheapest denial-of-service against an authenticated API — spray strings at it and make it hash and
 * query each one — into a string comparison. It is also what makes the key self-describing enough to
 * register with GitHub's secret-scanning partner programme.
 *
 * Base62 rather than base64url because the alphabet has to survive being double-clicked, read down a
 * phone line and pasted into a YAML file: `-` and `_` break word selection and invite line wrapping.
 *
 * Keys written before this format existed are `cr_live_` + 24 bytes of base64url with no checksum.
 * They are still valid credentials and `inspectApiKey` recognises them; see `findApiKey`.
 */

/** Unchanged, and deliberately so: stored digests must stay readable. Pinned to FIPS vectors in tests. */
export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export type KeyMode = "live" | "test";

export const KEY_PREFIX = { live: "cr_live_", test: "cr_test_" } as const satisfies Record<KeyMode, string>;

/** 32 random bytes is 256 bits, and 62**43 > 2**256, so 43 digits always hold them. */
export const KEY_RANDOM_BYTES = 32;
export const KEY_BODY_LENGTH = 43;
export const KEY_CHECKSUM_LENGTH = 6;
/** `cr_live_` (8) + 43 + 6. Fixed, which is what makes parsing unambiguous. */
export const KEY_LENGTH = 8 + KEY_BODY_LENGTH + KEY_CHECKSUM_LENGTH;

export const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

const BASE62 = /^[0-9A-Za-z]+$/;
/** `cr_live_` + exactly 32 base64url characters: 24 bytes, the format in use before the checksum. */
const LEGACY = /^cr_live_[A-Za-z0-9_-]{32}$/;

/**
 * Big-endian Base62, left-padded to a fixed width.
 *
 * The padding is not cosmetic. Without it a random value with leading zero bytes encodes short, the
 * total key length varies, and "which characters are the checksum?" stops having one answer — so a
 * key could be parsed two ways, which is the beginning of a forgery.
 */
export function base62Encode(bytes: Uint8Array, width: number): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let digits = "";
  while (value > 0n) {
    digits = BASE62_ALPHABET[Number(value % 62n)] + digits;
    value /= 62n;
  }
  if (digits.length > width) throw new Error(`Base62 value needs ${digits.length} digits, not ${width}.`);
  return digits.padStart(width, BASE62_ALPHABET[0]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[index] = crc >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3: reflected, polynomial 0xEDB88320, init and final xor 0xFFFFFFFF). */
export function crc32(input: string): number {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(input, "utf8")) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * The checksum covers the prefix as well as the random part.
 *
 * That is the point of computing it over the whole body rather than the secret alone: editing
 * `cr_test_` into `cr_live_` to see whether the billed path behaves differently invalidates the key.
 */
export function checksumFor(body: string): string {
  const crc = crc32(body);
  // Spelled out byte by byte rather than through a typed-array view: a view's byte order is the
  // machine's, and a checksum that differs between an x86 build and an ARM one invalidates every key.
  return base62Encode(Uint8Array.from([(crc >>> 24) & 0xff, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff]), KEY_CHECKSUM_LENGTH);
}

export function createApiKeyValue(mode: KeyMode = "live"): string {
  const body = `${KEY_PREFIX[mode]}${base62Encode(randomBytes(KEY_RANDOM_BYTES), KEY_BODY_LENGTH)}`;
  return `${body}${checksumFor(body)}`;
}

export type KeyInspection =
  | { format: "current"; mode: KeyMode }
  | { format: "legacy"; mode: "live" }
  | { format: "invalid"; reason: "unknown_prefix" | "wrong_length" | "bad_alphabet" | "bad_checksum" };

/**
 * Everything that can be decided about a key from the key itself, with no database and no secrets.
 *
 * Returns `legacy` for keys minted before the checksum existed. Those cannot be checked arithmetically
 * — there is nothing to check them against — so they are admitted on shape and settled by the hash
 * lookup, exactly as they were before. That is a shrinking exception, not a hole: every key issued from
 * now on is `current`, and the day the last legacy row is rotated out, `LEGACY` can be deleted.
 */
export function inspectApiKey(value: string): KeyInspection {
  for (const mode of ["live", "test"] as const) {
    const prefix = KEY_PREFIX[mode];
    if (!value.startsWith(prefix)) continue;
    const rest = value.slice(prefix.length);
    if (rest.length !== KEY_BODY_LENGTH + KEY_CHECKSUM_LENGTH) {
      return mode === "live" && LEGACY.test(value) ? { format: "legacy", mode: "live" } : { format: "invalid", reason: "wrong_length" };
    }
    if (!BASE62.test(rest)) return { format: "invalid", reason: "bad_alphabet" };
    const body = value.slice(0, value.length - KEY_CHECKSUM_LENGTH);
    if (checksumFor(body) !== rest.slice(KEY_BODY_LENGTH)) return { format: "invalid", reason: "bad_checksum" };
    return { format: "current", mode };
  }
  return { format: "invalid", reason: "unknown_prefix" };
}

/** True when the string is worth a database lookup. The whole value of the checksum is in this answer. */
export function apiKeyShapeAcceptable(value: string): boolean {
  return inspectApiKey(value).format !== "invalid";
}

export function apiKeyMode(value: string): KeyMode | null {
  const inspected = inspectApiKey(value);
  return inspected.format === "invalid" ? null : inspected.mode;
}

/** Stored in clear beside the hash, so a customer can tell two of their own keys apart in a list. */
export function apiKeyLast4(value: string): string {
  return value.slice(-4);
}

/*
 * Addresses and CIDRs, for the per-key IP allowlist.
 *
 * Written here rather than leaned on from a package because an allowlist that parses generously is
 * worse than none: `010.0.0.1` is not octal here, a zone id is not stripped and ignored, and an
 * address that cannot be parsed never matches anything.
 */

function parseIpv4(input: string): Uint8Array | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < 4; index++) {
    const part = parts[index];
    // Leading zeros are refused rather than accepted-and-interpreted: `010` means 8 to some resolvers
    // and 10 to others, and an allowlist that disagrees with the network stack is a bypass.
    if (!/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith("0"))) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    bytes[index] = octet;
  }
  return bytes;
}

function parseIpv6(input: string): Uint8Array | null {
  if (!input.includes(":") || input.includes("%")) return null;
  let text = input;
  let embedded: Uint8Array | null = null;
  const lastColon = text.lastIndexOf(":");
  if (text.slice(lastColon + 1).includes(".")) {
    embedded = parseIpv4(text.slice(lastColon + 1));
    if (!embedded) return null;
    // The dotted quad occupies the final two 16-bit groups; stand in for them so the group count works out.
    text = `${text.slice(0, lastColon + 1)}0:0`;
  }
  const sections = text.split("::");
  if (sections.length > 2) return null;
  const head = sections[0] === "" ? [] : sections[0].split(":");
  const tail = sections.length === 2 && sections[1] !== "" ? sections[1].split(":") : [];
  if (sections.length === 1 ? head.length !== 8 : head.length + tail.length > 7) return null;
  const groups: number[] = [];
  for (const group of head) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    groups.push(Number.parseInt(group, 16));
  }
  while (groups.length < 8 - tail.length) groups.push(0);
  for (const group of tail) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return null;
    groups.push(Number.parseInt(group, 16));
  }
  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 8; index++) {
    bytes[index * 2] = groups[index] >>> 8;
    bytes[index * 2 + 1] = groups[index] & 0xff;
  }
  if (embedded) bytes.set(embedded, 12);
  return bytes;
}

/**
 * An address as bytes: 4 for IPv4, 16 for IPv6, `null` for anything unparseable.
 *
 * IPv4-mapped IPv6 (`::ffff:203.0.113.4`) collapses to its 4 bytes, because that is the same host and
 * a proxy chain decides which spelling arrives. An allowlist of `203.0.113.0/24` that let the dotted
 * form through and refused the mapped form would be a bug the customer gets to debug.
 */
export function parseIp(input: string): Uint8Array | null {
  const bytes = input.includes(":") ? parseIpv6(input) : parseIpv4(input);
  if (bytes?.length !== 16) return bytes;
  const mapped = bytes.subarray(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  return mapped ? bytes.slice(12) : bytes;
}

/** True when `cidr` is a well-formed entry for an allowlist. Used to refuse one at the API boundary. */
export function isCidr(cidr: string): boolean {
  const [address, bits, ...rest] = cidr.split("/");
  if (rest.length > 0) return false;
  const parsed = parseIp(address);
  if (!parsed) return false;
  if (bits === undefined) return true;
  return /^\d{1,3}$/.test(bits) && Number(bits) <= parsed.length * 8;
}

/** Does `address` fall inside `cidr`? A malformed entry, or a different family, matches nothing. */
export function cidrContains(cidr: string, address: Uint8Array): boolean {
  const [text, bits, ...rest] = cidr.split("/");
  if (rest.length > 0) return false;
  const network = parseIp(text);
  if (!network || network.length !== address.length) return false;
  const prefix = bits === undefined ? network.length * 8 : /^\d{1,3}$/.test(bits) ? Number(bits) : -1;
  if (prefix < 0 || prefix > network.length * 8) return false;
  const wholeBytes = prefix >>> 3;
  for (let index = 0; index < wholeBytes; index++) if (network[index] !== address[index]) return false;
  const remainder = prefix & 7;
  if (remainder === 0) return true;
  const mask = 0xff << (8 - remainder) & 0xff;
  return (network[wholeBytes] & mask) === (address[wholeBytes] & mask);
}

/**
 * The allowlist decision. Empty list means any address; a list plus an address we cannot parse means no.
 *
 * Failing closed on an unparseable or absent client address is the whole point. The alternative — "we
 * could not tell, so allow it" — turns the control off for precisely the requests where the hop in
 * front of us is doing something unexpected.
 */
export function ipInAllowlist(allowlist: string | null | undefined, address: string | null | undefined): boolean {
  const entries = (allowlist ?? "").split(",").map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (entries.length === 0) return true;
  const parsed = address ? parseIp(address) : null;
  if (!parsed) return false;
  return entries.some((entry) => cidrContains(entry, parsed));
}
