import type { EvidenceClass, InterestFlag, VerifierStatus } from "@mi/schemas";
import { EVIDENCE_CLASS_BASE_RELIABILITY } from "@mi/schemas";

// --- §7.6 / EVIDENCE_DOCTRINE.md TTL defaults, in days. null = no auto-expiry. ---
export type TTLCategory =
  | "pricing"
  | "maturity_availability"
  | "leadership_hiring"
  | "partnership_acquisition"
  | "positioning"
  | "customer_sentiment"
  | "analyst_market_structure"
  | "historical_event";

export const TTL_DAYS: Record<TTLCategory, number | null> = {
  pricing: 14,
  maturity_availability: 30,
  leadership_hiring: 30,
  partnership_acquisition: 60,
  positioning: 60,
  customer_sentiment: 90,
  analyst_market_structure: 180,
  historical_event: null
};

/** §7.6 — 1.00 while fresh, decays linearly to 0.50 at 2×TTL, floored there. */
export function freshnessFactor(ageDays: number, ttlDays: number | null): number {
  if (ttlDays === null) return 1;
  if (ageDays <= ttlDays) return 1;
  const twiceTtl = ttlDays * 2;
  if (ageDays >= twiceTtl) return 0.5;
  const fractionPastTtl = (ageDays - ttlDays) / (twiceTtl - ttlDays);
  return 1 - 0.5 * fractionPastTtl;
}

/** Is this evidence too stale to represent *current* state without a refresh? */
export function isStaleForCurrentState(ageDays: number, ttlDays: number | null): boolean {
  if (ttlDays === null) return false;
  return ageDays > ttlDays * 2;
}

export type ExtractionMethod = "structured" | "free_text" | "screenshot";

/** §8.2 extraction_certainty. */
export function extractionCertainty(input: {
  method: ExtractionMethod;
  groundedExact: boolean;
  independentlyCorroborated?: boolean;
}): number {
  if (input.method === "screenshot") {
    return input.independentlyCorroborated ? 0.9 : 0.75;
  }
  if (input.method === "structured" && input.groundedExact) return 1.0;
  return 0.9;
}

/** §8.2 verification_factor. */
export function verificationFactor(
  status: VerifierStatus,
  options: { sameSourceReFetchOnly?: boolean } = {}
): number {
  switch (status) {
    case "verified":
      return options.sameSourceReFetchOnly ? 0.9 : 1.0;
    case "not_selected":
    case "pending":
      return 0.7;
    case "failed":
    case "unresolved":
    case "grounding_failed":
      return 0.0;
    default:
      return 0.0;
  }
}

/** §8.2 interest_factor — most conservative applicable flag wins. */
export function interestFactor(flags: InterestFlag[]): number {
  if (flags.includes("syndicated_from_subject")) return 0.8;
  if (flags.includes("subject_commissioned") || flags.includes("subject_sponsored")) return 0.85;
  if (flags.includes("subject_owned")) return 0.9;
  return 1.0;
}

export interface EvidenceItemInputs {
  evidenceClass: EvidenceClass;
  ageDays: number;
  ttlDays: number | null;
  extraction: { method: ExtractionMethod; groundedExact: boolean; independentlyCorroborated?: boolean };
  verifierStatus: VerifierStatus;
  sameSourceReFetchOnly?: boolean;
  interestFlags: InterestFlag[];
}

/** §8.5 — evidence_item_confidence = base_reliability × freshness × extraction × verification × interest. */
export function evidenceItemConfidence(input: EvidenceItemInputs): number {
  const base = EVIDENCE_CLASS_BASE_RELIABILITY[input.evidenceClass];
  const freshness = freshnessFactor(input.ageDays, input.ttlDays);
  const extraction = extractionCertainty(input.extraction);
  const verification = verificationFactor(input.verifierStatus, {
    sameSourceReFetchOnly: input.sameSourceReFetchOnly
  });
  const interest = interestFactor(input.interestFlags);
  return clamp01(base * freshness * extraction * verification * interest);
}

/** §8.4 — corroboration factor from the number of independent source families. */
export function corroborationFactor(independentFamilyCount: number, hasTopTierSingleSource: boolean): number {
  if (hasTopTierSingleSource) return 1.0;
  if (independentFamilyCount <= 0) return 0;
  if (independentFamilyCount === 1) return 0.85;
  if (independentFamilyCount === 2) return 0.93;
  if (independentFamilyCount === 3) return 0.97;
  return 1.0;
}

/**
 * §8.5 claim_confidence. `familyConfidences` is one entry per independent
 * source family supporting the claim — the *maximum* evidence_item_confidence
 * within that family (syndicated duplicates already collapsed by the caller
 * using packages/evidence source-family clustering).
 */
export function claimConfidence(
  familyConfidences: number[],
  hasTopTierSingleSource: boolean
): number {
  if (familyConfidences.length === 0) return 0;
  const complement = familyConfidences.reduce((acc, c) => acc * (1 - c), 1);
  const corroboration = corroborationFactor(familyConfidences.length, hasTopTierSingleSource);
  return clamp01((1 - complement) * corroboration);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
