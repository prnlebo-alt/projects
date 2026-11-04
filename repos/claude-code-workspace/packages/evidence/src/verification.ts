import type { VerifierStatus, VerifierWorkerInput } from "@mi/schemas";
import { groundExcerpt } from "./grounding.js";

export interface ClaimForVerification {
  id: string;
  predicate: string;
  objectValue: string;
  sourceCanonicalUrl: string;
}

/**
 * Builds the blind Verifier Worker payload. Deliberately excludes the
 * original excerpt, rationale, confidence, and evidence class — the
 * verifier independently re-derives the answer instead of grading the
 * original analysis (AGENT_CONTRACTS.md Verifier Worker; ARCHITECTURE.md §6).
 */
export function buildBlindVerifierPayload(claim: ClaimForVerification): VerifierWorkerInput {
  return {
    claimId: claim.id,
    predicate: claim.predicate,
    objectValue: claim.objectValue,
    sourceCanonicalUrl: claim.sourceCanonicalUrl
  };
}

export interface ReVerifyOutcome {
  status: VerifierStatus;
  reason: string;
}

/**
 * Independent verification: re-fetch the source (via the same provider-
 * neutral FetchAdapter the rest of the system uses) and check whether the
 * claimed value is still present, without ever consulting the original
 * claim_evidence excerpt/rationale.
 */
export function reVerifyClaim(input: {
  refetchStatus: "ok" | "not_found" | "error" | "denied";
  refetchedNormalizedText: string | null;
  objectValue: string;
}): ReVerifyOutcome {
  if (input.refetchStatus === "denied") {
    return { status: "unresolved", reason: "access-policy gate denied the independent re-fetch" };
  }
  if (input.refetchStatus !== "ok" || input.refetchedNormalizedText === null) {
    return { status: "unresolved", reason: `source inaccessible on re-fetch (${input.refetchStatus})` };
  }

  const grounding = groundExcerpt(input.objectValue, input.refetchedNormalizedText);
  if (grounding.status === "grounding_failed") {
    return { status: "failed", reason: "claimed value not found in independently re-fetched source" };
  }
  return { status: "verified", reason: `re-fetched source grounds the claim (${grounding.status})` };
}
