import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./canonicalizeUrl.js";

describe("canonicalizeUrl", () => {
  it("strips tracking params and fragment", () => {
    expect(canonicalizeUrl("https://Example.com/page/?utm_source=x&b=2&a=1#section")).toBe(
      "https://example.com/page?a=1&b=2"
    );
  });

  it("removes trailing slash except root", () => {
    expect(canonicalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
    expect(canonicalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("treats equivalent URLs as identical after canonicalization", () => {
    const a = canonicalizeUrl("https://example.com/a?utm_campaign=x&z=1&y=2");
    const b = canonicalizeUrl("https://EXAMPLE.com/a/?y=2&z=1&fbclid=abc");
    expect(a).toBe(b);
  });
});
