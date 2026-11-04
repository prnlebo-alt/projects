import { z } from "zod";

/** ARCHITECTURE.md §8.1 — base reliability ladder, highest to lowest. */
export const evidenceClassSchema = z.enum([
  "audited_regulatory_primary_dataset",
  "direct_customer_primary_statement",
  "independent_analyst_academic_research",
  "implementation_partner_named_deployment",
  "vendor_primary_documentation",
  "vendor_case_study_outcome",
  "demo_roadmap_announcement",
  "marketing_only_assertion",
  "unverified_inaccessible"
]);
export type EvidenceClass = z.infer<typeof evidenceClassSchema>;

/** Base reliability values, ARCHITECTURE.md §8.1. */
export const EVIDENCE_CLASS_BASE_RELIABILITY: Record<EvidenceClass, number> = {
  audited_regulatory_primary_dataset: 1.0,
  direct_customer_primary_statement: 0.95,
  independent_analyst_academic_research: 0.9,
  implementation_partner_named_deployment: 0.75,
  vendor_primary_documentation: 0.65,
  vendor_case_study_outcome: 0.55,
  demo_roadmap_announcement: 0.4,
  marketing_only_assertion: 0.25,
  unverified_inaccessible: 0.0
};

/** ARCHITECTURE.md §7.9 / §8.2 — self-interest flags, orthogonal to evidence class. */
export const interestFlagSchema = z.enum([
  "subject_owned",
  "subject_commissioned",
  "subject_sponsored",
  "syndicated_from_subject"
]);
export type InterestFlag = z.infer<typeof interestFlagSchema>;

/** ARCHITECTURE.md §7.3 — allowed absence-of-evidence states. */
export const absenceStateSchema = z.enum([
  "not_found_after_search",
  "source_inaccessible",
  "evidence_conflicts",
  "confirmed_absence",
  "not_applicable"
]);
export type AbsenceState = z.infer<typeof absenceStateSchema>;

/** ARCHITECTURE.md §7.8 — grounding gate outcomes. */
export const groundingStatusSchema = z.enum([
  "ungrounded",
  "grounded_exact",
  "grounded_fuzzy",
  "grounding_failed"
]);
export type GroundingStatus = z.infer<typeof groundingStatusSchema>;

/** ARCHITECTURE.md §10 claims.claim_status lifecycle. */
export const claimStatusSchema = z.enum([
  "pending_grounding",
  "grounded",
  "grounding_failed",
  "pending_verification",
  "verified",
  "verification_failed",
  "verification_unresolved"
]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

/** Independent-verification outcome for a single claim_evidence row. */
export const verifierStatusSchema = z.enum([
  "not_selected",
  "pending",
  "verified",
  "failed",
  "unresolved",
  "grounding_failed"
]);
export type VerifierStatus = z.infer<typeof verifierStatusSchema>;

/** claim_evidence.support_type */
export const supportTypeSchema = z.enum(["support", "counter"]);
export type SupportType = z.infer<typeof supportTypeSchema>;

/** claims.subject_type — Phase 1 keeps this open-ended but typed. */
export const subjectTypeSchema = z.enum(["company", "product", "agent_offering", "market_lane"]);
export type SubjectType = z.infer<typeof subjectTypeSchema>;

/** sources.fetch_status */
export const fetchStatusSchema = z.enum([
  "pending",
  "fetched",
  "unchanged",
  "denied_by_policy",
  "manual_policy_required",
  "fetch_failed"
]);
export type FetchStatus = z.infer<typeof fetchStatusSchema>;

/** source_snapshots.access_policy_result */
export const accessPolicyResultSchema = z.enum([
  "allow",
  "deny",
  "manual_policy_required"
]);
export type AccessPolicyResult = z.infer<typeof accessPolicyResultSchema>;

/** source_snapshots.fetch_method */
export const fetchMethodSchema = z.enum(["http_static", "browser_rendered"]);
export type FetchMethod = z.infer<typeof fetchMethodSchema>;

/** source_families.family_type — which deterministic rule created/confirmed the family. */
export const familyTypeSchema = z.enum([
  "canonical_url",
  "wire_ancestry",
  "similarity_plus_fingerprint",
  "press_release_fingerprint",
  "explicit_syndication"
]);
export type FamilyType = z.infer<typeof familyTypeSchema>;

/** source_family_members.membership_rule — ARCHITECTURE.md §8.3 rules 1-5. */
export const membershipRuleSchema = z.enum([
  "rule_1_canonical_url",
  "rule_2_wire_ancestry",
  "rule_3_similarity_plus_fingerprint",
  "rule_4_press_release_fingerprint",
  "rule_5_explicit_syndication"
]);
export type MembershipRule = z.infer<typeof membershipRuleSchema>;

/** research_runs / agent_runs / verification_runs status. */
export const runStatusSchema = z.enum(["running", "completed", "partial", "failed"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

/** Permanent agent roles, ARCHITECTURE.md §5 / AGENT_CONTRACTS.md. */
export const agentRoleSchema = z.enum([
  "market_intelligence_director",
  "evidence_and_research",
  "competitive_intelligence",
  "gap_opportunity_hunter",
  "strategy_and_gauntlet"
]);
export type AgentRole = z.infer<typeof agentRoleSchema>;

/** Ephemeral worker kinds, ARCHITECTURE.md §6. */
export const workerKindSchema = z.enum([
  "scout",
  "extractor",
  "verifier",
  "diff",
  "specialist",
  "critic",
  "judge"
]);
export type WorkerKind = z.infer<typeof workerKindSchema>;

/** audit_events.actor_type */
export const actorTypeSchema = z.enum(["deterministic_service", "model", "human"]);
export type ActorType = z.infer<typeof actorTypeSchema>;

/** access_policy_registry.fetch_policy / browser_policy */
export const policyDecisionSchema = z.enum(["allow", "deny", "manual_review"]);
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

/** access_policy_registry.robots_mode */
export const robotsModeSchema = z.enum(["respect", "override_authorized", "not_applicable"]);
export type RobotsMode = z.infer<typeof robotsModeSchema>;

/** materiality_sensitivity_rules.field_type */
export const materialityFieldTypeSchema = z.enum([
  "pricing",
  "maturity",
  "availability",
  "buyer_fit",
  "capability_presence",
  "partnership_acquisition",
  "positioning",
  "hiring",
  "other"
]);
export type MaterialityFieldType = z.infer<typeof materialityFieldTypeSchema>;
