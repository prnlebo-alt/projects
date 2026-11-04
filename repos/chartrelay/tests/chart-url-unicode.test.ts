import { describe, expect, it } from "vitest";
import { encodeExtended, isSendable, safeHeaders } from "@/lib/http/header-text";

const { GET } = await import("@/app/chart/route");

const chart = (query: string) => GET(new Request(`http://localhost:3000/chart?${query}`));

/** The alt text as a caller gets it back: the plain header, or the RFC 8187 extended one. */
const altOf = (response: Response) => {
  const plain = response.headers.get("x-chartrelay-alt");
  if (plain !== null) return plain;
  const extended = response.headers.get("x-chartrelay-alt*") ?? "";
  return decodeURIComponent(extended.replace(/^UTF-8''/, ""));
};

const decodeExtended = (value: string) => decodeURIComponent(value.replace(/^UTF-8''/, ""));

describe("text that does not fit in a header byte", () => {
  it("knows which values a header can carry as they are", () => {
    expect(isSendable("Revenue by month")).toBe(true);
    // Latin-1 goes out untouched. Percent-encoding "Café" was a quiet behaviour change for callers who
    // had been reading it correctly, and the kind of corruption that looks close enough to right to ship.
    expect(isSendable("Café")).toBe(true);
    expect(isSendable("uptime 99%")).toBe(true);
    expect(isSendable("Łódź")).toBe(false);
    expect(isSendable("line one\r\nline two")).toBe(false);
  });

  it("encodes the rest as RFC 8187 and decodes back to the same string", () => {
    for (const value of ["日本語の売上", "한국어", "العربية", "Ω", "🚀 launch", "€1,200", "em — dash", "Łódź", "99% of 日本"]) {
      expect(encodeExtended(value).startsWith("UTF-8''")).toBe(true);
      expect(decodeExtended(encodeExtended(value))).toBe(value);
    }
  });

  it("keeps an emoji whole rather than splitting it into surrogates", () => {
    // Iterating code units instead of code points encodes a lone surrogate, which decodes to U+FFFD.
    expect(decodeExtended(encodeExtended("🚀"))).toBe("🚀");
    expect(encodeExtended("🚀")).toBe("UTF-8''%F0%9F%9A%80");
  });

  it("omits the plain header rather than sending a mangled one", () => {
    // Absence is actionable; plausible corruption is not.
    const out = safeHeaders({ "x-chartrelay-alt": "日本語" });
    expect(out["x-chartrelay-alt"]).toBeUndefined();
    expect(out["x-chartrelay-alt*"]).toBeDefined();
  });

  it("leaves a sendable value exactly as it was", () => {
    expect(safeHeaders({ "x-chartrelay-alt": "It increased 200.0% for Café" })["x-chartrelay-alt"])
      .toBe("It increased 200.0% for Café");
  });

  it("produces a value a Headers object will actually accept", () => {
    // The whole point. This constructor is what threw, and the throw was a 500 with an empty body.
    for (const value of ["日本語", "Łódź", "🚀", "a\r\nb", "Café"]) {
      expect(() => new Headers(safeHeaders({ "x-chartrelay-alt": value }))).not.toThrow();
    }
  });
});

describe("GET /chart with text above U+00FF", () => {
  it("draws the chart instead of returning an empty 500", async () => {
    // Every one of these returned HTTP 500 with a zero-byte body, which an <img> shows as a broken icon.
    for (const title of ["日本語の売上", "한국어", "العربية", "Привет", "Ω", "🚀", "€", "—", "Łódź"]) {
      const response = await chart(`type=bar&data=1,2,3&labels=A,B,C&title=${encodeURIComponent(title)}&format=svg`);
      expect(response.status, title).toBe(200);
      expect((await response.text()).length, title).toBeGreaterThan(0);
    }
  });

  it("still carries the alt text, recoverable by the caller", async () => {
    const response = await chart(`type=bar&data=1,2,3&labels=A,B,C&title=${encodeURIComponent("日本語の売上")}&format=svg`);
    expect(altOf(response)).toContain("日本語の売上");
  });

  it("handles non-Latin-1 in labels and series names too, not only the title", async () => {
    const labels = encodeURIComponent("一月,二月,三月");
    const names = encodeURIComponent("売上");
    const response = await chart(`type=bar&data=1,2,3&labels=${labels}&names=${names}&title=Sales&format=svg`);
    expect(response.status).toBe(200);
  });

  it("leaves an ASCII chart's headers exactly as they were", async () => {
    // Existing consumers read this header raw; encoding one that did not need it would break them.
    const response = await chart("type=bar&data=1,2,3&labels=A,B,C&title=Revenue&format=svg");
    expect(response.headers.get("x-chartrelay-alt*")).toBeNull();
    expect(response.headers.get("x-chartrelay-alt")).toContain("Revenue");
    // A literal percent stays literal — "200.0%" must not arrive as "200.0%25".
    expect(response.headers.get("x-chartrelay-alt")).toContain("200.0%");
    expect(response.headers.get("x-chartrelay-alt")).not.toMatch(/%[0-9A-F]{2}/);
  });

  it("does not fall over on a carriage return in a parameter", async () => {
    // A header value carrying CR or LF is rejected by the same constructor, for a different reason.
    const response = await chart("type=bar&data=1,abc%0d%0aX-Injected:%20yes&labels=A,B&format=svg");
    expect(response.status).toBeLessThan(500);
    for (const [, value] of response.headers) expect(value).not.toMatch(/[\r\n]/);
  });
});
