import { describe, expect, it } from "vitest";
import { buildBlindVerifierPayload, reVerifyClaim } from "./verification.js";

describe("buildBlindVerifierPayload", () => {
  it("excludes original rationale/excerpt/confidence — only re-derivable fields", () => {
    const payload = buildBlindVerifierPayload({
      id: "claim-1",
      predicate: "pricing_model",
      objectValue: "$1200/month",
      sourceCanonicalUrl: "https://acme.com/pricing"
    });
    expect(Object.keys(payload).sort()).toEqual(
      ["claimId", "objectValue", "predicate", "sourceCanonicalUrl"].sort()
    );
    expect(payload).not.toHaveProperty("excerptText");
    expect(payload).not.toHaveProperty("rationale");
    expect(payload).not.toHaveProperty("confidence");
  });
});

describe("reVerifyClaim", () => {
  it("verifies when the independently re-fetched source still grounds the claim", () => {
    const outcome = reVerifyClaim({
      refetchStatus: "ok",
      refetchedNormalizedText: "Acme Robotics pricing starts at $1200 per month.",
      objectValue: "$1200 per month"
    });
    expect(outcome.status).toBe("verified");
  });

  it("a vendor outcome claim that no longer grounds on independent re-fetch fails, not just downgrades", () => {
    const outcome = reVerifyClaim({
      refetchStatus: "ok",
      refetchedNormalizedText: "Acme Robotics pricing starts at $1500 per month now.",
      objectValue: "$1200 per month"
    });
    expect(outcome.status).toBe("failed");
  });

  it("a denied re-fetch is unresolved, never silently treated as verified", () => {
    const outcome = reVerifyClaim({
      refetchStatus: "denied",
      refetchedNormalizedText: null,
      objectValue: "$1200 per month"
    });
    expect(outcome.status).toBe("unresolved");
  });

  it("a source that has since become inaccessible is unresolved, not confirmed_absence", () => {
    const outcome = reVerifyClaim({
      refetchStatus: "not_found",
      refetchedNormalizedText: null,
      objectValue: "$1200 per month"
    });
    expect(outcome.status).toBe("unresolved");
  });
});
