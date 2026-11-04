import { describe, expect, it } from "vitest";
import { groundExcerpt } from "./grounding.js";

const SOURCE_TEXT =
  "Acme Robotics today announced general availability of its Finance Agent for mid-market " +
  "Salesforce customers. Pricing starts at $1200 per month for the standard tier, billed annually.";

describe("groundExcerpt", () => {
  it("grounds an excerpt that is an exact substring of the source", () => {
    const result = groundExcerpt("Pricing starts at $1200 per month", SOURCE_TEXT);
    expect(result.status).toBe("grounded_exact");
  });

  it("is case- and whitespace-insensitive for exact matches", () => {
    const result = groundExcerpt("PRICING STARTS AT   $1200 per month", SOURCE_TEXT);
    expect(result.status).toBe("grounded_exact");
  });

  it("falls back to grounded_fuzzy for a lightly reworded excerpt", () => {
    const result = groundExcerpt("Pricing begins at $1200 monthly for the standard tier", SOURCE_TEXT);
    expect(result.status).toBe("grounded_fuzzy");
  });

  it("fails grounding for a fabricated excerpt not present in the source", () => {
    const result = groundExcerpt("Acme Robotics guarantees a 300% ROI within 30 days", SOURCE_TEXT);
    expect(result.status).toBe("grounding_failed");
  });

  it("fails grounding for an empty excerpt", () => {
    const result = groundExcerpt("", SOURCE_TEXT);
    expect(result.status).toBe("grounding_failed");
  });

  it("rejects a hallucinated figure close in shape to the real one (never fuzzy-matches numbers)", () => {
    // Adversarial case from ARCHITECTURE.md §25: a model could hallucinate a
    // specific, plausible-sounding but unsupported figure. Paraphrase
    // tolerance must never extend to the number itself.
    const result = groundExcerpt("Pricing starts at $999 per month", SOURCE_TEXT);
    expect(result.status).toBe("grounding_failed");
  });
});
