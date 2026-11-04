import { describe, expect, it } from "vitest";
import { BLOCKED_COUNTRIES, checkRequestRegion, countryBlocked, requestCountry } from "@/lib/compliance/regions";

const from = (headers: Record<string, string>) => new Request("http://localhost/x", { headers });

describe("where this may not be sold", () => {
  it("blocks the comprehensively sanctioned destinations", () => {
    for (const country of ["CU", "IR", "KP", "SY"]) expect(countryBlocked(country), country).toBe(true);
  });

  it("blocks Russia and Belarus, which is a decision rather than a statute", () => {
    // Recorded in docs/BILLING_DECISIONS.md. The test exists so that reversing it is a deliberate
    // edit with a failing test attached, not something that drifts.
    expect(countryBlocked("RU")).toBe(true);
    expect(countryBlocked("BY")).toBe(true);
  });

  it("serves everywhere else", () => {
    for (const country of ["US", "GB", "DE", "UA", "IN", "BR", "JP"]) expect(countryBlocked(country), country).toBe(false);
  });

  it("is case and whitespace insensitive, because providers disagree", () => {
    expect(countryBlocked(" ru ")).toBe(true);
    expect(countryBlocked("Ru")).toBe(true);
  });
});

describe("an unknown country", () => {
  it("is not blocked, so a missing header is not an outage", () => {
    // Failing closed here would refuse every request the moment the proxy stopped sending the header.
    // The card-country check at checkout is the one that has to hold.
    expect(countryBlocked(null)).toBe(false);
    expect(countryBlocked(undefined)).toBe(false);
    expect(countryBlocked("")).toBe(false);
    expect(checkRequestRegion(from({})).blocked).toBe(false);
  });

  it("is reported separately so it can be seen rather than mistaken for an allow", () => {
    const verdict = checkRequestRegion(from({}));
    expect(verdict.unknown).toBe(true);
    expect(verdict.country).toBeNull();
  });

  it("treats Cloudflare's placeholders as no answer rather than as a country", () => {
    // XX is an address Cloudflare could not place and T1 is Tor. Neither is a country, and reading
    // either as one would decide on noise.
    for (const placeholder of ["XX", "T1"]) {
      expect(requestCountry(from({ "cf-ipcountry": placeholder })), placeholder).toBeNull();
    }
  });

  it("ignores a malformed value instead of guessing at it", () => {
    for (const bad of ["USA", "1", "russia", "R", "??"]) {
      expect(requestCountry(from({ "cf-ipcountry": bad })), bad).toBeNull();
    }
  });
});

describe("regions inside a country that is not blocked", () => {
  it("blocks Crimea while Ukraine is served", () => {
    // A country code alone cannot express this, which is why the subdivision check exists.
    expect(checkRequestRegion(from({ "cf-ipcountry": "UA" })).blocked).toBe(false);
    expect(checkRequestRegion(from({ "cf-ipcountry": "UA", "cf-region-code": "43" })).blocked).toBe(true);
  });

  it("blocks Donetsk and Luhansk", () => {
    for (const region of ["14", "09"]) {
      expect(checkRequestRegion(from({ "cf-ipcountry": "UA", "cf-region-code": region })).blocked, region).toBe(true);
    }
  });

  it("serves the rest of Ukraine", () => {
    for (const region of ["30", "32", "46"]) {
      expect(checkRequestRegion(from({ "cf-ipcountry": "UA", "cf-region-code": region })).blocked, region).toBe(false);
    }
  });

  it("ignores a subdivision when there is no country to attach it to", () => {
    expect(checkRequestRegion(from({ "cf-region-code": "43" })).subdivision).toBeNull();
  });
});

describe("reading the country from whatever is in front of the app", () => {
  it("prefers Cloudflare's header, which is the one the platform plan calls for", () => {
    expect(requestCountry(from({ "cf-ipcountry": "DE", "x-country-code": "US" }))).toBe("DE");
  });

  it("falls back to other providers' headers", () => {
    expect(requestCountry(from({ "x-vercel-ip-country": "FR" }))).toBe("FR");
    expect(requestCountry(from({ "x-country-code": "ES" }))).toBe("ES");
  });

  it("names every blocked country in one place a reviewer can read", () => {
    expect([...BLOCKED_COUNTRIES].sort()).toEqual(["BY", "CU", "IR", "KP", "RU", "SY"]);
  });
});
