/**
 * Where this service may not be sold.
 *
 * Two independent signals, because each is weak alone. The card's issuing country comes from the
 * payment provider and is hard to fake but arrives only at checkout, after an account exists. The
 * request's country is available from the first request but is trivially changed with a VPN. Blocking
 * on either is the point: neither is a wall, and together they stop the ordinary case without
 * pretending to stop a determined one.
 *
 * This is deliberately stricter than the law requires. Russia and Belarus are not comprehensively
 * embargoed for most software, and are blocked here on asymmetry rather than statute — the revenue
 * forgone is near zero because card rails to both are largely severed anyway, while the cost of being
 * wrong in the other direction is out of all proportion to a $19 subscription. See
 * docs/BILLING_DECISIONS.md. Reversing it is one entry in the list below.
 *
 * Not legal advice, and not a sanctions-screening product. It does not check names against SDN lists.
 */

/** ISO 3166-1 alpha-2, uppercase. */
export const BLOCKED_COUNTRIES = new Set([
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia — see the note above
  "BY", // Belarus — see the note above
]);

/**
 * Regions inside a country that is not itself blocked.
 *
 * Crimea and the self-declared DNR and LNR are comprehensively sanctioned while Ukraine is not, so a
 * country code alone cannot express this. ISO 3166-2 subdivisions, matched only when a provider gives
 * one — which most do not, making this a best-effort layer on top of the country check rather than a
 * guarantee.
 */
export const BLOCKED_SUBDIVISIONS = new Set([
  "UA-43", // Crimea
  "UA-40", // Sevastopol
  "UA-14", // Donetsk
  "UA-09", // Luhansk
]);

/** Headers that carry a country, in the order they are trusted. */
const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country", "x-country-code"] as const;
const SUBDIVISION_HEADERS = ["cf-region-code", "x-vercel-ip-country-region"] as const;

const normalise = (value: string | null | undefined): string | null => {
  const text = value?.trim().toUpperCase();
  // Cloudflare sends XX for an address it cannot place and T1 for Tor. Neither is a country, and
  // treating either as one would block or allow on noise.
  return text && /^[A-Z]{2}$/.test(text) && text !== "XX" && text !== "T1" ? text : null;
};

/** The country a request appears to come from, or null when nothing in front of us supplies one. */
export function requestCountry(request: Request): string | null {
  for (const header of COUNTRY_HEADERS) {
    const country = normalise(request.headers.get(header));
    if (country) return country;
  }
  return null;
}

function requestSubdivision(request: Request, country: string | null): string | null {
  if (!country) return null;
  for (const header of SUBDIVISION_HEADERS) {
    const region = request.headers.get(header)?.trim().toUpperCase();
    if (region && /^[A-Z0-9]{1,3}$/.test(region)) return `${country}-${region.padStart(2, "0")}`;
  }
  return null;
}

export interface RegionVerdict {
  blocked: boolean;
  /** The country that decided it, for the audit log. Null when no signal was available. */
  country: string | null;
  subdivision: string | null;
  /** True when nothing in front of this app supplies a country, so the check could not run. */
  unknown: boolean;
}

/**
 * Whether a country is blocked. Used for both the card's country and the request's.
 *
 * An unknown country is **not** blocked. Failing closed here would refuse every request whenever the
 * proxy in front of the app stops sending the header — turning a missing header into a total outage —
 * and the card-country check at checkout is the one that actually has to hold. This asymmetry is
 * deliberate and is why the verdict reports `unknown` separately rather than folding it into `blocked`.
 */
export function countryBlocked(country: string | null | undefined): boolean {
  const code = normalise(country);
  return code !== null && BLOCKED_COUNTRIES.has(code);
}

export function checkRequestRegion(request: Request): RegionVerdict {
  const country = requestCountry(request);
  const subdivision = requestSubdivision(request, country);
  return {
    blocked: countryBlocked(country) || (subdivision !== null && BLOCKED_SUBDIVISIONS.has(subdivision)),
    country,
    subdivision,
    unknown: country === null,
  };
}

/** What a blocked visitor is told. Specific enough to be actionable, vague enough not to be a map. */
export const REGION_BLOCKED_MESSAGE =
  "ChartRelay is not available in your location. If you believe this is wrong, contact support@chartrelay.dev.";
