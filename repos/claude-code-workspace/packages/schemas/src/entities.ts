import { z } from "zod";
import {
  accessPolicyResultSchema,
  actorTypeSchema,
  agentRoleSchema,
  claimStatusSchema,
  evidenceClassSchema,
  familyTypeSchema,
  fetchMethodSchema,
  fetchStatusSchema,
  groundingStatusSchema,
  interestFlagSchema,
  materialityFieldTypeSchema,
  membershipRuleSchema,
  policyDecisionSchema,
  robotsModeSchema,
  runStatusSchema,
  subjectTypeSchema,
  supportTypeSchema,
  verifierStatusSchema
} from "./enums.js";

const isoDate = z.string().datetime({ offset: true });

/** ARCHITECTURE.md §10 — `sources` */
export const sourceSchema = z.object({
  id: z.string().uuid(),
  canonicalUrl: z.string().url(),
  domain: z.string().min(1),
  sourceType: z.string().min(1),
  publisher: z.string().nullable(),
  title: z.string().nullable(),
  publishedAt: isoDate.nullable(),
  firstFetchedAt: isoDate,
  lastFetchedAt: isoDate,
  fetchStatus: fetchStatusSchema,
  contentHash: z.string().nullable(),
  wireService: z.string().nullable(),
  wireItemId: z.string().nullable(),
  canonicalPublisherItemId: z.string().nullable(),
  syndicatedFromUrl: z.string().nullable()
});
export type SourceRecord = z.infer<typeof sourceSchema>;

/** `source_snapshots` */
export const sourceSnapshotSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  fetchedAt: isoDate,
  contentHash: z.string().min(1),
  rawContentLocation: z.string().min(1),
  normalizedTextLocation: z.string().min(1),
  screenshotLocation: z.string().nullable(),
  fetchMethod: fetchMethodSchema,
  accessPolicyResult: accessPolicyResultSchema
});
export type SourceSnapshotRecord = z.infer<typeof sourceSnapshotSchema>;

/** `source_families` */
export const sourceFamilySchema = z.object({
  id: z.string().uuid(),
  familyType: familyTypeSchema,
  canonicalOriginSourceId: z.string().uuid().nullable(),
  fingerprint: z.string().nullable(),
  createdAt: isoDate
});
export type SourceFamilyRecord = z.infer<typeof sourceFamilySchema>;

/** `source_family_members` */
export const sourceFamilyMemberSchema = z.object({
  sourceSnapshotId: z.string().uuid(),
  sourceFamilyId: z.string().uuid(),
  membershipRule: membershipRuleSchema,
  similarityScore: z.number().min(0).max(1).nullable()
});
export type SourceFamilyMemberRecord = z.infer<typeof sourceFamilyMemberSchema>;

/** `claims` */
export const claimSchema = z.object({
  id: z.string().uuid(),
  subjectType: subjectTypeSchema,
  subjectId: z.string().min(1),
  predicate: z.string().min(1),
  objectValue: z.string().min(1),
  normalizedValue: z.string().min(1),
  claimStatus: claimStatusSchema,
  material: z.boolean().nullable(),
  firstObservedAt: isoDate,
  lastVerifiedAt: isoDate.nullable(),
  confidence: z.number().min(0).max(1).nullable()
});
export type ClaimRecord = z.infer<typeof claimSchema>;

/** `claim_evidence` */
export const claimEvidenceSchema = z.object({
  id: z.string().uuid(),
  claimId: z.string().uuid(),
  sourceSnapshotId: z.string().uuid(),
  evidenceClass: evidenceClassSchema,
  supportType: supportTypeSchema,
  excerptLocation: z.string().min(1),
  excerptText: z.string().min(1),
  groundingStatus: groundingStatusSchema,
  extractorConfidence: z.number().min(0).max(1),
  verifierStatus: verifierStatusSchema,
  interestFlags: z.array(interestFlagSchema),
  evidenceItemConfidence: z.number().min(0).max(1).nullable(),
  /** True when the independent verifier re-fetched the *same* source URL rather than a distinct second source. */
  sameSourceRefetch: z.boolean()
});
export type ClaimEvidenceRecord = z.infer<typeof claimEvidenceSchema>;

/** `research_runs` */
export const researchRunSchema = z.object({
  id: z.string().uuid(),
  objective: z.string().min(1),
  runType: z.string().min(1),
  status: runStatusSchema,
  startedAt: isoDate,
  completedAt: isoDate.nullable(),
  tokenBudget: z.number().int().nonnegative(),
  monetaryBudget: z.number().nonnegative(),
  sourceBudget: z.number().int().nonnegative(),
  partialReason: z.string().nullable()
});
export type ResearchRunRecord = z.infer<typeof researchRunSchema>;

/** `agent_runs` */
export const agentRunSchema = z.object({
  id: z.string().uuid(),
  researchRunId: z.string().uuid(),
  agentRole: agentRoleSchema,
  modelProvider: z.string().min(1),
  modelName: z.string().min(1),
  promptVersion: z.string().min(1),
  promptContentHash: z.string().min(1),
  status: runStatusSchema,
  startedAt: isoDate,
  completedAt: isoDate.nullable(),
  costEstimate: z.number().nonnegative().nullable()
});
export type AgentRunRecord = z.infer<typeof agentRunSchema>;

/** `verification_runs` */
export const verificationRunSchema = z.object({
  id: z.string().uuid(),
  researchRunId: z.string().uuid(),
  claimCount: z.number().int().nonnegative(),
  verifiedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
  auditedNonmaterialCount: z.number().int().nonnegative(),
  completedAt: isoDate.nullable()
});
export type VerificationRunRecord = z.infer<typeof verificationRunSchema>;

/** `audit_events` */
export const auditEventSchema = z.object({
  id: z.string().uuid(),
  actorType: actorTypeSchema,
  actorId: z.string().min(1),
  eventType: z.string().min(1),
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  payload: z.record(z.unknown()),
  createdAt: isoDate
});
export type AuditEventRecord = z.infer<typeof auditEventSchema>;

/** `access_policy_registry` */
export const accessPolicyRegistryEntrySchema = z.object({
  id: z.string().uuid(),
  domainPattern: z.string().min(1),
  fetchPolicy: policyDecisionSchema,
  browserPolicy: policyDecisionSchema,
  authRequired: z.boolean(),
  robotsMode: robotsModeSchema,
  tosNote: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  reviewedAt: isoDate.nullable(),
  expiresAt: isoDate.nullable()
});
export type AccessPolicyRegistryEntry = z.infer<typeof accessPolicyRegistryEntrySchema>;

/** `materiality_sensitivity_rules` */
export const materialitySensitivityRuleSchema = z.object({
  id: z.string().uuid(),
  predicatePattern: z.string().min(1),
  fieldType: materialityFieldTypeSchema,
  affectedDimensions: z.array(z.string()),
  affectedActionGate: z.boolean(),
  material: z.boolean(),
  ruleVersion: z.number().int().positive(),
  active: z.boolean()
});
export type MaterialitySensitivityRule = z.infer<typeof materialitySensitivityRuleSchema>;
