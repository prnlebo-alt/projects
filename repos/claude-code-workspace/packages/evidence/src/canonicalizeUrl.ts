/**
 * Deterministic URL canonicalization (PHASE1_BUILD_DIRECTIVE.md step 5).
 * Two URLs that resolve to the same canonical form are treated as the same
 * `sources` row so unchanged content is skipped instead of re-snapshotted.
 */
const TRACKING_PARAM_PREFIXES = ["utm_", "mc_", "ic_"];
const TRACKING_PARAM_EXACT = new Set(["gclid", "fbclid", "ref", "referrer", "igshid"]);

export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  const keptParams: [string, string][] = [];
  for (const [key, value] of url.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    if (TRACKING_PARAM_EXACT.has(lowerKey)) continue;
    if (TRACKING_PARAM_PREFIXES.some((prefix) => lowerKey.startsWith(prefix))) continue;
    keptParams.push([key, value]);
  }
  keptParams.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = "";
  for (const [key, value] of keptParams) {
    url.searchParams.append(key, value);
  }

  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  url.pathname = pathname === "" ? "/" : pathname;

  return url.toString();
}

export function extractDomain(rawUrl: string): string {
  return new URL(rawUrl).hostname.toLowerCase();
}
