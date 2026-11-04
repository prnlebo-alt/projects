import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SUPPORT_RESPONSE, supportEmail, supportMailto, supportResponseTime } from "@/lib/support";

afterEach(() => vi.unstubAllEnvs());

describe("supportEmail", () => {
  it("returns the trimmed address when one is configured", () => {
    expect(supportEmail({ SUPPORT_EMAIL: "  help@chartrelay.dev \n" })).toBe("help@chartrelay.dev");
    expect(supportEmail({ SUPPORT_EMAIL: "first.last+charts@sub.example.co.uk" })).toBe("first.last+charts@sub.example.co.uk");
  });

  it("returns null when the variable is missing or blank", () => {
    expect(supportEmail({})).toBeNull();
    expect(supportEmail({ SUPPORT_EMAIL: "   " })).toBeNull();
  });

  it("rejects anything that is not a usable address rather than publishing it", () => {
    for (const value of ["support", "support@", "@chartrelay.dev", "support@localhost", "a b@chartrelay.dev", "support@chartrelay", "your-email-here"]) {
      expect(supportEmail({ SUPPORT_EMAIL: value })).toBeNull();
    }
  });

  it("rejects addresses carrying characters that would break a mailto URL", () => {
    for (const value of ["he%20lp@chartrelay.dev", "help?x=1@chartrelay.dev", "help&cc=x@chartrelay.dev", "help@chartrelay.dev#frag"]) {
      expect(supportEmail({ SUPPORT_EMAIL: value })).toBeNull();
    }
  });

  it("rejects an absurdly long value", () => {
    expect(supportEmail({ SUPPORT_EMAIL: `${"a".repeat(250)}@chartrelay.dev` })).toBeNull();
  });

  it("reads process.env by default", () => {
    vi.stubEnv("SUPPORT_EMAIL", "help@chartrelay.dev");
    expect(supportEmail()).toBe("help@chartrelay.dev");
    vi.stubEnv("SUPPORT_EMAIL", "");
    expect(supportEmail()).toBeNull();
  });
});

describe("supportResponseTime", () => {
  it("defaults when unset, blank or zero", () => {
    expect(supportResponseTime({})).toBe(DEFAULT_SUPPORT_RESPONSE);
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: "  " })).toBe(DEFAULT_SUPPORT_RESPONSE);
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: "0" })).toBe(DEFAULT_SUPPORT_RESPONSE);
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: "x".repeat(81) })).toBe(DEFAULT_SUPPORT_RESPONSE);
  });

  it("formats a bare number of hours", () => {
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: "24" })).toBe("24 hours");
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: " 1 " })).toBe("1 hour");
  });

  it("passes a ready-made phrase through, with whitespace collapsed", () => {
    expect(supportResponseTime({ SUPPORT_RESPONSE_HOURS: "one   business  day" })).toBe("one business day");
  });
});

describe("supportMailto", () => {
  const env = { SUPPORT_EMAIL: "help@chartrelay.dev" };

  it("builds a mailto with the subject pre-filled and escaped", () => {
    expect(supportMailto("ChartRelay billing question", env)).toBe("mailto:help@chartrelay.dev?subject=ChartRelay%20billing%20question");
    expect(supportMailto("Bug: 400 on /api/v1/charts & no id", env)).toBe("mailto:help@chartrelay.dev?subject=Bug%3A%20400%20on%20%2Fapi%2Fv1%2Fcharts%20%26%20no%20id");
  });

  it("collapses whitespace and caps the subject length", () => {
    expect(supportMailto("  spaced   out  ", env)).toBe("mailto:help@chartrelay.dev?subject=spaced%20out");
    const long = supportMailto("s".repeat(200), env);
    expect(long).toBe(`mailto:help@chartrelay.dev?subject=${"s".repeat(120)}`);
  });

  it("omits the query when the subject is empty", () => {
    expect(supportMailto("   ", env)).toBe("mailto:help@chartrelay.dev");
  });

  it("returns null when no address is configured, so callers render a non-link fallback", () => {
    expect(supportMailto("ChartRelay support request", {})).toBeNull();
    expect(supportMailto("ChartRelay support request", { SUPPORT_EMAIL: "not-an-address" })).toBeNull();
  });
});
