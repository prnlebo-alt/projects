/**
 * SSRF guard for any remote fetch ChartRelay might ever make on a caller's behalf.
 *
 * ## Is anything calling this today? No.
 *
 * Nothing in ChartRelay fetches a remote resource. `chartSpecSchema` has no URL-shaped field, the
 * renderers emit no `<image>`, no `xlink:href` and no CSS `url()`, and rasterisation is `sharp`
 * (libvips) over an in-memory SVG string rather than a headless browser. A grep for
 * `assertSafeFetchUrl|guardedFetch|fetch-guard` outside this file and `tests/fetch-guard.test.ts`
 * returns nothing, and `tests/fetch-guard.test.ts` asserts that stays true.
 *
 * This module therefore protects nothing yet. It exists so that the day someone adds a logo URL, a
 * font URL, a CSV-by-URL import or a headless browser, the decision of what may be dereferenced is
 * already made, already tested, and does not get re-invented badly under deadline. Saying this
 * plainly is the point: a guard that is claimed to be wired in when it is not is worse than no
 * guard, because it stops anyone from looking.
 *
 * ## What it enforces (docs/BILLING_SPEC.md, "Security and abuse" → Renderer hardening)
 *
 * - **https only.** Every other scheme is refused by name, `file:`, `chrome:` and `data:` among them.
 * - **Resolve once, pin the result.** `guardedFetch` resolves the hostname a single time, refuses
 *   unless *every* returned address is publicly routable, and then performs the request through a
 *   `lookup` shim that can only ever hand the socket one of those pinned addresses. A second
 *   resolution cannot happen, so a DNS record that flips between a public and a private answer
 *   (rebinding) has nothing to flip to.
 * - **Private space is refused**, including loopback, link-local (`169.254.0.0/16`, which is where
 *   `169.254.169.254` lives), carrier-grade NAT, unique-local, multicast and the reserved blocks,
 *   and the IPv6 equivalents — `::1`, `fc00::/7`, `fe80::/10`, and the IPv4-mapped and NAT64 forms
 *   (`::ffff:169.254.169.254`, `::ffff:a9fe:a9fe`, `64:ff9b::169.254.169.254`) that look public to a
 *   substring check and are not.
 * - **Every redirect is re-checked** from scratch: scheme, hostname and freshly resolved addresses.
 *   A 302 is a new request to a new host, and the only reason SSRF filters are usually bypassable is
 *   that it is treated as a continuation of the old one.
 * - **Every refusal is logged** with its machine-readable reason, with the query string and any
 *   userinfo stripped first, because a blocked URL is caller-supplied data that reaches our logs.
 *
 * Nothing here opens a socket until the address is known-public, so a refusal costs no egress.
 */
import { isIPv4, isIPv6 } from "node:net";
import { lookup as dnsLookup } from "node:dns";

/** Why a URL was refused. Stable strings: logs and tests branch on them. */
export type BlockReason =
  | "scheme_not_https"
  | "credentials_in_url"
  | "hostname_missing"
  | "hostname_not_resolvable"
  | "address_not_public"
  | "port_not_allowed"
  | "too_many_redirects"
  | "redirect_without_location";

/**
 * What an address is, beyond "public" or not.
 *
 * Named rather than boolean so a refusal can say *which* reserved block the caller landed in. "the
 * host resolved to 169.254.169.254, which is link-local (cloud instance metadata)" is actionable;
 * "blocked" invites a support ticket.
 */
export type AddressClass =
  | "public"
  | "unspecified"
  | "loopback"
  | "private"
  | "link-local"
  | "carrier-grade-nat"
  | "unique-local"
  | "site-local"
  | "multicast"
  | "broadcast"
  | "documentation"
  | "benchmark"
  | "discard"
  | "reserved";

/** Human words for each class, used in the refusal message a caller reads. */
const CLASS_DESCRIPTION: Record<AddressClass, string> = {
  public: "publicly routable",
  unspecified: "the unspecified address",
  loopback: "loopback",
  private: "private (RFC 1918)",
  "link-local": "link-local, where cloud instance metadata lives",
  "carrier-grade-nat": "carrier-grade NAT (RFC 6598)",
  "unique-local": "IPv6 unique-local (RFC 4193)",
  "site-local": "IPv6 site-local",
  multicast: "multicast",
  broadcast: "broadcast",
  documentation: "reserved for documentation",
  benchmark: "reserved for benchmarking",
  discard: "a discard-only block",
  reserved: "reserved",
};

/** The only scheme a remote fetch may ever use. */
const ALLOWED_SCHEME = "https:";

/**
 * Schemes refused by name as well as by the https-only rule.
 *
 * The allowlist already covers them. They are enumerated because the spec names `file:`, `chrome:`
 * and `data:` specifically, and because a named refusal tells the caller which mistake they made
 * instead of leaving them to guess why "it" was blocked.
 */
export const EXPLICITLY_BLOCKED_SCHEMES = [
  "file:",
  "chrome:",
  "chrome-extension:",
  "chrome-untrusted:",
  "data:",
  "blob:",
  "javascript:",
  "view-source:",
  "resource:",
  "about:",
  "ftp:",
  "gopher:",
  "ws:",
  "wss:",
  "http:",
] as const;

/** Ports a fetch may target. 443 only: an https URL on port 25 is an SMTP probe wearing a hat. */
const ALLOWED_PORTS = new Set([443]);

/** A redirect chain longer than this is a loop or an attempt to exhaust the checks. */
const MAX_REDIRECTS = 5;

export class RemoteFetchBlockedError extends Error {
  /** The published error code for this refusal (`src/lib/http/errors.ts`), which maps to HTTP 400. */
  readonly code = "remote_fetch_blocked" as const;
  readonly status = 400 as const;
  readonly reason: BlockReason;
  /** The URL as refused, with the query string and any userinfo removed. */
  readonly url: string;
  /** Which hop refused, counting the caller's own URL as 0. */
  readonly hop: number;
  /** The resolved address that triggered the refusal, when the refusal was about an address. */
  readonly address?: string;

  constructor(reason: BlockReason, message: string, context: { url: string; hop?: number; address?: string }) {
    super(message);
    this.name = "RemoteFetchBlockedError";
    this.reason = reason;
    this.url = context.url;
    this.hop = context.hop ?? 0;
    if (context.address !== undefined) this.address = context.address;
  }
}

export interface FetchGuardLogEntry {
  event: "remote_fetch_blocked";
  reason: BlockReason;
  /** Already redacted: no query string, no userinfo. */
  url: string;
  message: string;
  hop: number;
  address?: string;
}

export type FetchGuardLogger = (entry: FetchGuardLogEntry) => void;

const defaultLogger: FetchGuardLogger = (entry) => {
  // One line, machine-greppable, no payload. Whoever later adds a real logger replaces this.
  console.warn(`[fetch-guard] ${entry.event} reason=${entry.reason} hop=${entry.hop} url=${entry.url}${entry.address ? ` address=${entry.address}` : ""}: ${entry.message}`);
};

let logger: FetchGuardLogger = defaultLogger;

/** Redirects refusal logs somewhere else (a test, or a real logger once one exists). */
export function setFetchGuardLogger(next: FetchGuardLogger): void {
  logger = next;
}

export function resetFetchGuardLogger(): void {
  logger = defaultLogger;
}

/**
 * A caller-supplied URL is log-injection material and may carry a signature or a token in its query.
 * Keep the origin and path, drop the rest, and never let a newline through.
 */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/[\r\n]+/g, " ");
  } catch {
    // Unparseable: say so rather than echoing arbitrary bytes into a log line.
    return "(unparseable url)";
  }
}

function refuse(reason: BlockReason, message: string, context: { url: string; hop?: number; address?: string }): never {
  const error = new RemoteFetchBlockedError(reason, message, { ...context, url: redactUrl(context.url) });
  logger({
    event: "remote_fetch_blocked",
    reason: error.reason,
    url: error.url,
    message: error.message,
    hop: error.hop,
    ...(error.address === undefined ? {} : { address: error.address }),
  });
  throw error;
}

// ---------------------------------------------------------------------------
// Address classification
// ---------------------------------------------------------------------------

function parseIPv4(value: string): number[] | null {
  if (!isIPv4(value)) return null;
  // isIPv4 already rejects the octal/short forms ("0177.1", "2130706433") that make naive parsers
  // disagree with the kernel about which address a string means.
  return value.split(".").map(Number);
}

/** The 16 bytes of an IPv6 address, or null. A zone id (`%eth0`) is dropped before parsing. */
function parseIPv6(value: string): number[] | null {
  const bare = value.split("%")[0];
  if (!isIPv6(bare)) return null;
  let head = bare;
  let tailV4: number[] = [];
  const lastColon = bare.lastIndexOf(":");
  const maybeV4 = bare.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const octets = parseIPv4(maybeV4);
    if (!octets) return null;
    tailV4 = octets;
    head = bare.slice(0, lastColon + 1);
    // "::ffff:1.2.3.4" leaves head as "::ffff:"; the trailing colon would otherwise read as a group.
    if (head.endsWith(":") && !head.endsWith("::")) head = head.slice(0, -1);
  }
  const [left, right, extra] = head.split("::");
  if (extra !== undefined) return null;
  const groups = (part: string | undefined) => (part ? part.split(":").filter((piece) => piece !== "") : []);
  const leftGroups = groups(left);
  const rightGroups = right === undefined ? [] : groups(right);
  const bytesFrom = (list: string[]) => list.flatMap((group) => {
    const word = Number.parseInt(group, 16);
    return [(word >> 8) & 0xff, word & 0xff];
  });
  const leftBytes = [...bytesFrom(leftGroups), ...(right === undefined ? tailV4 : [])];
  const rightBytes = right === undefined ? [] : [...bytesFrom(rightGroups), ...tailV4];
  const fill = 16 - leftBytes.length - rightBytes.length;
  if (fill < 0) return null;
  if (right === undefined && fill !== 0) return null;
  return [...leftBytes, ...Array.from({ length: fill }, () => 0), ...rightBytes];
}

function classifyIPv4(octets: number[]): AddressClass {
  const [a, b] = octets;
  if (a === 0) return "unspecified";
  if (a === 127) return "loopback";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  if (a === 100 && b >= 64 && b <= 127) return "carrier-grade-nat";
  if (a === 169 && b === 254) return "link-local";
  if (a === 192 && b === 0 && octets[2] === 0) return "reserved";
  if (a === 192 && b === 0 && octets[2] === 2) return "documentation";
  if (a === 198 && b === 51 && octets[2] === 100) return "documentation";
  if (a === 203 && b === 0 && octets[2] === 113) return "documentation";
  if (a === 192 && b === 88 && octets[2] === 99) return "reserved";
  if (a === 198 && (b === 18 || b === 19)) return "benchmark";
  if (octets.every((octet) => octet === 255)) return "broadcast";
  if (a >= 224 && a <= 239) return "multicast";
  if (a >= 240) return "reserved";
  return "public";
}

const startsWith = (bytes: number[], prefix: number[]) => prefix.every((byte, index) => bytes[index] === byte);

function classifyIPv6(bytes: number[]): AddressClass {
  if (bytes.every((byte) => byte === 0)) return "unspecified";
  if (startsWith(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) && bytes[15] === 1) return "loopback";
  // IPv4-mapped (::ffff:0:0/96) and IPv4-compatible (::/96): the address that matters is the
  // embedded IPv4 one, so classify that instead of calling the wrapper public.
  if (startsWith(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff])) return classifyIPv4(bytes.slice(12));
  if (startsWith(bytes, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) && bytes.slice(12).some((byte) => byte !== 0)) return classifyIPv4(bytes.slice(12));
  // NAT64 (64:ff9b::/96) carries an IPv4 destination that the translator will actually dial.
  if (startsWith(bytes, [0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0])) return classifyIPv4(bytes.slice(12));
  if (startsWith(bytes, [0x01, 0x00, 0, 0, 0, 0, 0, 0])) return "discard";
  if (startsWith(bytes, [0x20, 0x01, 0x0d, 0xb8])) return "documentation";
  // 2002::/16 6to4 wraps an IPv4 address in bytes 2-5.
  if (startsWith(bytes, [0x20, 0x02])) return classifyIPv4(bytes.slice(2, 6));
  if ((bytes[0] & 0xfe) === 0xfc) return "unique-local";
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return "link-local";
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0xc0) return "site-local";
  if (bytes[0] === 0xff) return "multicast";
  return "public";
}

/**
 * What block an address literal belongs to. Anything unparseable is `reserved` — refused, because a
 * string we cannot classify is one we also cannot vouch for.
 */
export function classifyAddress(value: string): AddressClass {
  const v4 = parseIPv4(value.trim());
  if (v4) return classifyIPv4(v4);
  const v6 = parseIPv6(value.trim());
  if (v6) return classifyIPv6(v6);
  return "reserved";
}

/** True only for an address a fetch may dial. */
export const isPublicAddress = (value: string): boolean => classifyAddress(value) === "public";

// ---------------------------------------------------------------------------
// URL checks
// ---------------------------------------------------------------------------

/**
 * The checks that need no network: scheme, userinfo, host shape, port, and — when the host is
 * already an address literal — the address itself. Returns the parsed URL so a caller does not
 * parse it a second time and risk checking one string while fetching another.
 */
export function assertSafeFetchUrl(raw: string, hop = 0): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    refuse("hostname_missing", "The URL could not be parsed.", { url: raw, hop });
  }
  if (url.protocol !== ALLOWED_SCHEME) {
    const named = (EXPLICITLY_BLOCKED_SCHEMES as readonly string[]).includes(url.protocol);
    refuse(
      "scheme_not_https",
      named
        ? `The ${url.protocol} scheme is blocked. Remote resources must be fetched over https.`
        : `Only https URLs may be fetched; ${url.protocol} is not allowed.`,
      { url: raw, hop },
    );
  }
  // `https://user:pass@host` is both a credential in a loggable string and the classic trick for
  // making a reader's eye stop before the real host.
  if (url.username || url.password) refuse("credentials_in_url", "A URL carrying credentials is not fetched.", { url: raw, hop });
  if (!url.hostname) refuse("hostname_missing", "The URL has no hostname.", { url: raw, hop });
  const port = url.port === "" ? 443 : Number(url.port);
  if (!ALLOWED_PORTS.has(port)) refuse("port_not_allowed", `Port ${port} is not allowed; https on port 443 only.`, { url: raw, hop });
  // A bracketed IPv6 literal, or a dotted-quad: no DNS involved, so decide now.
  const literal = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  if (isIPv4(literal) || isIPv6(literal.split("%")[0])) {
    const classification = classifyAddress(literal);
    if (classification !== "public") {
      refuse("address_not_public", `${literal} is ${CLASS_DESCRIPTION[classification]} and is never fetched.`, { url: raw, hop, address: literal });
    }
  }
  return url;
}

export type HostLookup = (hostname: string) => Promise<string[]>;

/** Default resolver: every A and AAAA record, so one private answer among several is still caught. */
const systemLookup: HostLookup = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses.map((entry) => entry.address));
    });
  });

export interface PinnedTarget {
  url: URL;
  /** Every address the hostname resolved to, all of them checked and public. */
  addresses: string[];
  /** The one address the socket will be given. */
  pinned: string;
}

/**
 * Resolves a hostname once and refuses unless **every** answer is publicly routable.
 *
 * Requiring all of them, not just the one we pick, is what makes the pin meaningful: a rebinding
 * record that answers `[1.2.3.4, 127.0.0.1]` is refused outright rather than accepted-then-reused,
 * and there is no second resolution later for an attacker to win.
 */
export async function pinTarget(raw: string, options: { lookup?: HostLookup; hop?: number } = {}): Promise<PinnedTarget> {
  const hop = options.hop ?? 0;
  const url = assertSafeFetchUrl(raw, hop);
  const lookup = options.lookup ?? systemLookup;
  const literal = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  if (isIPv4(literal) || isIPv6(literal.split("%")[0])) {
    // assertSafeFetchUrl already classified it, and there is nothing to resolve.
    return { url, addresses: [literal], pinned: literal };
  }
  let addresses: string[];
  try {
    addresses = await lookup(url.hostname);
  } catch (error) {
    refuse("hostname_not_resolvable", `The hostname ${url.hostname} could not be resolved: ${error instanceof Error ? error.message : "lookup failed"}.`, { url: raw, hop });
  }
  if (addresses.length === 0) refuse("hostname_not_resolvable", `The hostname ${url.hostname} resolved to no addresses.`, { url: raw, hop });
  for (const address of addresses) {
    const classification = classifyAddress(address);
    if (classification !== "public") {
      refuse("address_not_public", `${url.hostname} resolved to ${address}, which is ${CLASS_DESCRIPTION[classification]} and is never fetched.`, { url: raw, hop, address });
    }
  }
  return { url, addresses, pinned: addresses[0] };
}

/**
 * One hop of a guarded request. Injected so the guard can be tested without a network, and so the
 * caller that eventually needs this can supply `node:https` with the pinned `lookup` (which is what
 * turns "we checked an address" into "the socket can only reach that address").
 */
export type GuardedTransport = (target: PinnedTarget) => Promise<{ status: number; location?: string | null; body?: unknown }>;

export interface GuardedFetchResult {
  status: number;
  body?: unknown;
  /** Every URL dereferenced, in order, each one checked before it was dialled. */
  chain: string[];
  finalAddress: string;
}

/**
 * Fetches a URL, re-running every check on every redirect.
 *
 * A redirect is a fresh request to a host the caller never named, so it gets the full treatment —
 * scheme, userinfo, port, a new resolution, and the public-address requirement over all answers. A
 * relative `Location` is resolved against the hop that sent it before being checked, not after.
 */
export async function guardedFetch(raw: string, transport: GuardedTransport, options: { lookup?: HostLookup; maxRedirects?: number } = {}): Promise<GuardedFetchResult> {
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const chain: string[] = [];
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const target = await pinTarget(current, { ...(options.lookup ? { lookup: options.lookup } : {}), hop });
    chain.push(redactUrl(target.url.toString()));
    const response = await transport(target);
    if (response.status < 300 || response.status > 399) {
      return { status: response.status, ...(response.body === undefined ? {} : { body: response.body }), chain, finalAddress: target.pinned };
    }
    if (!response.location) refuse("redirect_without_location", `The server answered ${response.status} with no Location header.`, { url: current, hop });
    // Resolved against the hop that issued it, so "/latest/meta-data" cannot smuggle in a host.
    current = new URL(response.location, target.url).toString();
  }
  refuse("too_many_redirects", `The redirect chain exceeded ${maxRedirects} hops.`, { url: current, hop: maxRedirects });
}
