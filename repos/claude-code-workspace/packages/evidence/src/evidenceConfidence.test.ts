import { describe, expect, it } from "vitest";
import {
  claimConfidence,
  corroborationFactor,
  evidenceItemConfidence,
  freshnessFactor,
  interestFactor,
  isStaleForCurrentState,
  verificationFactor
} from "./evidenceConfidence.js";

describe("freshnessFactor", () => {
  it("is 1.0 within TTL", () => {
    expect(freshnessFactor(5, 14)).toBe(1);
  });
  it("decays to 0.5 at exactly 2x TTL", () => {
    expect(freshnessFactor(28, 14)).toBeCloseTo(0.5, 5);
  });
  it("never expires when ttlDays is null (historical facts)", () => {
    expect(freshnessFactor(10_000, null)).toBe(1);
  });
});

describe("isStaleForCurrentState", () => {
  it("flags pricing older than 2x its 14-day TTL as stale", () => {
    expect(isStaleForCurrentState(29, 14)).toBe(true);
    expect(isStaleForCurrentState(27, 14)).toBe(false);
  });
});

describe("verificationFactor", () => {
  it("independently verified and grounded is 1.0", () => {
    expect(verificationFactor("verified")).toBe(1.0);
  });
  it("verified by same-source re-fetch only is 0.9", () => {
    expect(verificationFactor("verified", { sameSourceReFetchOnly: true })).toBe(0.9);
  });
  it("failed/unresolved material verification is 0.0 — cannot promote", () => {
    expect(verificationFactor("failed")).toBe(0.0);
    expect(verificationFactor("unresolved")).toBe(0.0);
  });
  it("unverified but permitted for non-material storage is 0.7", () => {
    expect(verificationFactor("pending")).toBe(0.7);
  });
});

describe("interestFactor", () => {
  it("no flags: 1.0", () => {
    expect(interestFactor([])).toBe(1.0);
  });
  it("syndicated_from_subject: 0.8, strictest even when combined with other flags", () => {
    expect(interestFactor(["subject_owned", "syndicated_from_subject"])).toBe(0.8);
  });
  it("subject_sponsored/commissioned: 0.85", () => {
    expect(interestFactor(["subject_sponsored"])).toBe(0.85);
    expect(interestFactor(["subject_commissioned"])).toBe(0.85);
  });
});

describe("corroborationFactor", () => {
  it("single top-tier source is 1.0 even alone", () => {
    expect(corroborationFactor(1, true)).toBe(1.0);
  });
  it("follows the §8.4 table for non-top-tier evidence", () => {
    expect(corroborationFactor(1, false)).toBe(0.85);
    expect(corroborationFactor(2, false)).toBe(0.93);
    expect(corroborationFactor(3, false)).toBe(0.97);
    expect(corroborationFactor(4, false)).toBe(1.0);
    expect(corroborationFactor(10, false)).toBe(1.0);
  });
});

describe("evidenceItemConfidence", () => {
  it("a vendor-only claim never reaches independent-proof-level confidence", () => {
    // Vendor primary documentation (0.65 base) with no independent verification.
    const confidence = evidenceItemConfidence({
      evidenceClass: "vendor_primary_documentation",
      ageDays: 0,
      ttlDays: 30,
      extraction: { method: "structured", groundedExact: true },
      verifierStatus: "not_selected",
      interestFlags: []
    });
    // 0.65 base * 1.0 fresh * 1.0 extraction * 0.7 unverified * 1.0 interest = 0.455
    expect(confidence).toBeCloseTo(0.455, 3);
    expect(confidence).toBeLessThan(0.9);
  });

  it("a vendor case-study outcome claim cannot become independent proof on its own", () => {
    // Even with an independent-analyst-level base reliability elsewhere, a
    // single vendor case study caps out well below top-tier independent
    // evidence — corroboration from other families is required to climb.
    const vendorOnly = evidenceItemConfidence({
      evidenceClass: "vendor_case_study_outcome",
      ageDays: 0,
      ttlDays: 60,
      extraction: { method: "free_text", groundedExact: false },
      verifierStatus: "verified",
      interestFlags: ["subject_owned"]
    });
    const independentAnalyst = evidenceItemConfidence({
      evidenceClass: "independent_analyst_academic_research",
      ageDays: 0,
      ttlDays: 180,
      extraction: { method: "free_text", groundedExact: false },
      verifierStatus: "verified",
      interestFlags: []
    });
    expect(vendorOnly).toBeLessThan(independentAnalyst);
  });
});

describe("claimConfidence", () => {
  it("gives diminishing returns to additional independent families", () => {
    const one = claimConfidence([0.8], false);
    const two = claimConfidence([0.8, 0.8], false);
    const three = claimConfidence([0.8, 0.8, 0.8], false);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    expect(three).toBeLessThanOrEqual(1);
  });

  it("a syndicated duplicate does not count as a second independent family", () => {
    // Caller is responsible for collapsing syndicated copies into one family
    // before calling this — simulate that correctly-collapsed input here.
    const collapsedToOneFamily = claimConfidence([0.8], false);
    const twoGenuineFamilies = claimConfidence([0.8, 0.8], false);
    expect(collapsedToOneFamily).toBeLessThan(twoGenuineFamilies);
  });

  it("returns 0 for a claim with no supporting evidence", () => {
    expect(claimConfidence([], false)).toBe(0);
  });
});
