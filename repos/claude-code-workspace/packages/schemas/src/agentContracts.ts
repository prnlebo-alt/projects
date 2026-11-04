import { z } from "zod";
import { agentRoleSchema, workerKindSchema } from "./enums.js";
import { claimSchema, sourceSchema, sourceSnapshotSchema } from "./entities.js";

/**
 * AGENT_CONTRACTS.md — Evidence & Research role.
 * Phase 1 implements this role concretely; the other four permanent roles
 * are typed stubs (packages/agents) until their phases unlock.
 */
export const evidenceAndResearchInputSchema = z.object({
  researchRunId: z.string().uuid(),
  boundedQueries: z.array(z.string().min(1)).min(1),
  sourceBudget: z.number().int().positive()
});
export type EvidenceAndResearchInput = z.infer<typeof evidenceAndResearchInputSchema>;

export const evidenceAndResearchOutputSchema = z.object({
  researchRunId: z.string().uuid(),
  candidateSources: z.array(sourceSchema),
  candidateSnapshots: z.array(sourceSnapshotSchema),
  candidateClaims: z.array(claimSchema),
  contradictionCandidateClaimIds: z.array(z.string().uuid())
});
export type EvidenceAndResearchOutput = z.infer<typeof evidenceAndResearchOutputSchema>;

/** Generic envelope every permanent-role and worker output can be checked against. */
export const agentContractEnvelopeSchema = z.object({
  agentRole: agentRoleSchema.optional(),
  workerKind: workerKindSchema.optional(),
  researchRunId: z.string().uuid(),
  producedAt: z.string().datetime({ offset: true })
});
export type AgentContractEnvelope = z.infer<typeof agentContractEnvelopeSchema>;

/** Scout Worker: discovers sources/entities for one bounded query. */
export const scoutWorkerOutputSchema = agentContractEnvelopeSchema.extend({
  workerKind: z.literal("scout"),
  query: z.string().min(1),
  discoveredUrls: z.array(z.string().url())
});
export type ScoutWorkerOutput = z.infer<typeof scoutWorkerOutputSchema>;

/** Extractor Worker: atomizes already-located content into claim candidates. */
export const extractorWorkerOutputSchema = agentContractEnvelopeSchema.extend({
  workerKind: z.literal("extractor"),
  sourceSnapshotId: z.string().uuid(),
  claims: z.array(
    z.object({
      subjectType: z.string(),
      subjectId: z.string(),
      predicate: z.string(),
      objectValue: z.string(),
      excerptText: z.string(),
      excerptLocation: z.string()
    })
  )
});
export type ExtractorWorkerOutput = z.infer<typeof extractorWorkerOutputSchema>;

/**
 * Verifier Worker payload. This is the *blind* payload: it deliberately
 * excludes original analysis/rationale/confidence so the re-check is
 * independent (ARCHITECTURE.md §5 Agent 5 / PHASE1_BUILD_DIRECTIVE.md step 10).
 */
export const verifierWorkerInputSchema = z.object({
  claimId: z.string().uuid(),
  predicate: z.string(),
  objectValue: z.string(),
  sourceCanonicalUrl: z.string().url()
});
export type VerifierWorkerInput = z.infer<typeof verifierWorkerInputSchema>;

export const verifierWorkerOutputSchema = agentContractEnvelopeSchema.extend({
  workerKind: z.literal("verifier"),
  claimId: z.string().uuid(),
  result: z.enum(["verified", "failed", "unresolved", "grounding_failed"])
});
export type VerifierWorkerOutput = z.infer<typeof verifierWorkerOutputSchema>;
