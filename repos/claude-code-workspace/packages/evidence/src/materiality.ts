import { isInDeterministicSample } from "@mi/schemas";
import type { MaterialitySensitivityRule } from "@mi/schemas";

export interface MaterialityDecision {
  material: boolean;
  matchedRuleId: string | null;
  auditSampled: boolean;
  reason: string;
}

const DEFAULT_AUDIT_SAMPLE_RATE = 0.1;

/**
 * ARCHITECTURE.md §7.10 / EVIDENCE_DOCTRINE.md — deterministic materiality.
 *
 * This is a pure function of the claim's predicate against the *static,
 * versioned* `materiality_sensitivity_rules` table (ADR-002) plus a seeded
 * audit sample for the non-material remainder. It never re-scores the
 * claim's own (unverified) content — that would be the counterfactual
 * scoring EVIDENCE_DOCTRINE.md explicitly prohibits.
 */
export function determineMateriality(
  claim: { id: string; predicate: string },
  rules: MaterialitySensitivityRule[],
  options: { runSeed: string; auditSampleRate?: number } = { runSeed: "default" }
): MaterialityDecision {
  const rate = options.auditSampleRate ?? DEFAULT_AUDIT_SAMPLE_RATE;
  const activeRules = rules.filter((r) => r.active);
  const matched = activeRules.find((r) => claim.predicate.includes(r.predicatePattern));

  if (matched?.material) {
    return {
      material: true,
      matchedRuleId: matched.id,
      auditSampled: false,
      reason: `predicate "${claim.predicate}" matches materiality_sensitivity_rules rule "${matched.predicatePattern}" (v${matched.ruleVersion})`
    };
  }

  const auditSampled = isInDeterministicSample(options.runSeed, claim.id, rate);
  return {
    material: false,
    matchedRuleId: matched?.id ?? null,
    auditSampled,
    reason: auditSampled
      ? `non-material claim selected by deterministic ${Math.round(rate * 100)}% audit sample (seed="${options.runSeed}")`
      : "non-material and not selected for audit sampling"
  };
}

/** A claim requires independent verification if it's material, or is a non-material audit pick. */
export function requiresVerification(decision: MaterialityDecision): boolean {
  return decision.material || decision.auditSampled;
}
