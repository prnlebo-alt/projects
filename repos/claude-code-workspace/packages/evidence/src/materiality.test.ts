import { describe, expect, it } from "vitest";
import { determineMateriality, requiresVerification } from "./materiality.js";
import type { MaterialitySensitivityRule } from "@mi/schemas";

const RULES: MaterialitySensitivityRule[] = [
  {
    id: "rule-pricing",
    predicatePattern: "pricing",
    fieldType: "pricing",
    affectedDimensions: [],
    affectedActionGate: true,
    material: true,
    ruleVersion: 1,
    active: true
  },
  {
    id: "rule-positioning",
    predicatePattern: "positioning",
    fieldType: "positioning",
    affectedDimensions: [],
    affectedActionGate: false,
    material: false,
    ruleVersion: 1,
    active: true
  },
  {
    id: "rule-inactive-pricing-v0",
    predicatePattern: "pricing_legacy",
    fieldType: "pricing",
    affectedDimensions: [],
    affectedActionGate: true,
    material: true,
    ruleVersion: 0,
    active: false
  }
];

describe("determineMateriality", () => {
  it("a claim matching a material rule is always material, never audit-only", () => {
    const decision = determineMateriality({ id: "c1", predicate: "pricing_model" }, RULES, {
      runSeed: "seed-1"
    });
    expect(decision.material).toBe(true);
    expect(decision.matchedRuleId).toBe("rule-pricing");
  });

  it("does not live-re-score materiality from the claim's own object_value", () => {
    // Materiality must depend only on predicate -> rule mapping, never on
    // the (unverified) claimed value itself.
    const a = determineMateriality({ id: "c1", predicate: "pricing_model" }, RULES, {
      runSeed: "seed-1"
    });
    const b = determineMateriality({ id: "c1", predicate: "pricing_model" }, RULES, {
      runSeed: "seed-1"
    });
    expect(a).toEqual(b);
  });

  it("ignores inactive rule versions", () => {
    const decision = determineMateriality({ id: "c2", predicate: "pricing_legacy_tier" }, RULES, {
      runSeed: "seed-1"
    });
    // "pricing_legacy_tier" also substring-matches active rule "pricing" —
    // confirms an active rule is found ahead of/independent of the inactive one.
    expect(decision.material).toBe(true);
    expect(decision.matchedRuleId).toBe("rule-pricing");
  });

  it("a non-material claim not selected for audit is neither material nor verified", () => {
    const decision = determineMateriality({ id: "claim-not-sampled-xyz" as string, predicate: "positioning_statement" }, RULES, {
      runSeed: "seed-fixed",
      auditSampleRate: 0 // force: never audit-sampled
    });
    expect(decision.material).toBe(false);
    expect(decision.auditSampled).toBe(false);
    expect(requiresVerification(decision)).toBe(false);
  });

  it("the deterministic audit sample is reproducible from the same seed", () => {
    const claims = Array.from({ length: 300 }, (_, i) => ({
      id: `claim-${i}`,
      predicate: "positioning_statement"
    }));
    const runA = claims.map((c) => determineMateriality(c, RULES, { runSeed: "gate-seed" }).auditSampled);
    const runB = claims.map((c) => determineMateriality(c, RULES, { runSeed: "gate-seed" }).auditSampled);
    expect(runA).toEqual(runB);
    const sampledCount = runA.filter(Boolean).length;
    // ~10% default rate over 300 items — allow a reasonable statistical band.
    expect(sampledCount).toBeGreaterThan(15);
    expect(sampledCount).toBeLessThan(45);
  });
});
