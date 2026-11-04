import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

// Enum values are kept in lockstep with packages/schemas/src/enums.ts.
// Phase 1 tables only — see docs/DATA_SCHEMA.md.

export const fetchStatusEnum = pgEnum("fetch_status", [
  "pending",
  "fetched",
  "unchanged",
  "denied_by_policy",
  "manual_policy_required",
  "fetch_failed"
]);

export const accessPolicyResultEnum = pgEnum("access_policy_result", [
  "allow",
  "deny",
  "manual_policy_required"
]);

export const fetchMethodEnum = pgEnum("fetch_method", ["http_static", "browser_rendered"]);

export const familyTypeEnum = pgEnum("family_type", [
  "canonical_url",
  "wire_ancestry",
  "similarity_plus_fingerprint",
  "press_release_fingerprint",
  "explicit_syndication"
]);

export const membershipRuleEnum = pgEnum("membership_rule", [
  "rule_1_canonical_url",
  "rule_2_wire_ancestry",
  "rule_3_similarity_plus_fingerprint",
  "rule_4_press_release_fingerprint",
  "rule_5_explicit_syndication"
]);

export const subjectTypeEnum = pgEnum("subject_type", [
  "company",
  "product",
  "agent_offering",
  "market_lane"
]);

export const claimStatusEnum = pgEnum("claim_status", [
  "pending_grounding",
  "grounded",
  "grounding_failed",
  "pending_verification",
  "verified",
  "verification_failed",
  "verification_unresolved"
]);

export const evidenceClassEnum = pgEnum("evidence_class", [
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

export const supportTypeEnum = pgEnum("support_type", ["support", "counter"]);

export const groundingStatusEnum = pgEnum("grounding_status", [
  "ungrounded",
  "grounded_exact",
  "grounded_fuzzy",
  "grounding_failed"
]);

export const verifierStatusEnum = pgEnum("verifier_status", [
  "not_selected",
  "pending",
  "verified",
  "failed",
  "unresolved",
  "grounding_failed"
]);

export const runStatusEnum = pgEnum("run_status", ["running", "completed", "partial", "failed"]);

export const agentRoleEnum = pgEnum("agent_role", [
  "market_intelligence_director",
  "evidence_and_research",
  "competitive_intelligence",
  "gap_opportunity_hunter",
  "strategy_and_gauntlet"
]);

export const actorTypeEnum = pgEnum("actor_type", ["deterministic_service", "model", "human"]);

export const policyDecisionEnum = pgEnum("policy_decision", ["allow", "deny", "manual_review"]);

export const robotsModeEnum = pgEnum("robots_mode", [
  "respect",
  "override_authorized",
  "not_applicable"
]);

export const materialityFieldTypeEnum = pgEnum("materiality_field_type", [
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

// --- sources -----------------------------------------------------------

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey(),
  canonicalUrl: text("canonical_url").notNull().unique(),
  domain: text("domain").notNull(),
  sourceType: text("source_type").notNull(),
  publisher: text("publisher"),
  title: text("title"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  firstFetchedAt: timestamp("first_fetched_at", { withTimezone: true }).notNull(),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).notNull(),
  fetchStatus: fetchStatusEnum("fetch_status").notNull(),
  contentHash: text("content_hash"),
  // Persisted so incremental source-family reconciliation (defect #1, second
  // review round) can compare a new run's snapshot against already-clustered
  // snapshots from a prior run — this metadata previously lived only in
  // transient DiscoverySourceMeta and was lost after the run that first saw it.
  wireService: text("wire_service"),
  wireItemId: text("wire_item_id"),
  canonicalPublisherItemId: text("canonical_publisher_item_id"),
  syndicatedFromUrl: text("syndicated_from_url")
});

// --- source_snapshots -----------------------------------------------------

export const sourceSnapshots = pgTable(
  "source_snapshots",
  {
    id: uuid("id").primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    contentHash: text("content_hash").notNull(),
    rawContentLocation: text("raw_content_location").notNull(),
    normalizedTextLocation: text("normalized_text_location").notNull(),
    screenshotLocation: text("screenshot_location"),
    fetchMethod: fetchMethodEnum("fetch_method").notNull(),
    accessPolicyResult: accessPolicyResultEnum("access_policy_result").notNull()
  },
  (table) => ({
    // Idempotency (defect #5): re-fetching a source whose content is
    // unchanged must reuse the existing snapshot, never insert a duplicate.
    sourceContentHashUnique: uniqueIndex("source_snapshots_source_id_content_hash_key").on(
      table.sourceId,
      table.contentHash
    )
  })
);

// --- source_families --------------------------------------------------

export const sourceFamilies = pgTable("source_families", {
  id: uuid("id").primaryKey(),
  familyType: familyTypeEnum("family_type").notNull(),
  canonicalOriginSourceId: uuid("canonical_origin_source_id").references(() => sources.id),
  fingerprint: text("fingerprint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

// --- source_family_members ----------------------------------------------

export const sourceFamilyMembers = pgTable(
  "source_family_members",
  {
    sourceSnapshotId: uuid("source_snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "cascade" }),
    sourceFamilyId: uuid("source_family_id")
      .notNull()
      .references(() => sourceFamilies.id, { onDelete: "cascade" }),
    membershipRule: membershipRuleEnum("membership_rule").notNull(),
    similarityScore: doublePrecision("similarity_score")
  },
  (table) => ({
    // Idempotency (defect #5): a snapshot is clustered into exactly one
    // family, once. Re-running clustering over a snapshot that already has
    // a persisted membership must never insert a second row for it.
    sourceSnapshotUnique: uniqueIndex("source_family_members_source_snapshot_id_key").on(
      table.sourceSnapshotId
    )
  })
);

// --- claims --------------------------------------------------------------

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey(),
    subjectType: subjectTypeEnum("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    predicate: text("predicate").notNull(),
    objectValue: text("object_value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    claimStatus: claimStatusEnum("claim_status").notNull(),
    material: boolean("material"),
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    confidence: doublePrecision("confidence")
  },
  (table) => ({
    // Semantic claim identity (defect #2): the same subject+predicate+
    // normalized value is one claim, ever — multiple supporting sources
    // attach as additional claim_evidence rows via findOrCreateClaim(),
    // never as a second claims row.
    semanticIdentityUnique: uniqueIndex("claims_semantic_identity_key").on(
      table.subjectType,
      table.subjectId,
      table.predicate,
      table.normalizedValue
    )
  })
);

// --- claim_evidence --------------------------------------------------------

export const claimEvidence = pgTable(
  "claim_evidence",
  {
    id: uuid("id").primaryKey(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    sourceSnapshotId: uuid("source_snapshot_id")
      .notNull()
      .references(() => sourceSnapshots.id, { onDelete: "cascade" }),
    evidenceClass: evidenceClassEnum("evidence_class").notNull(),
    supportType: supportTypeEnum("support_type").notNull(),
    excerptLocation: text("excerpt_location").notNull(),
    excerptText: text("excerpt_text").notNull(),
    groundingStatus: groundingStatusEnum("grounding_status").notNull(),
    extractorConfidence: doublePrecision("extractor_confidence").notNull(),
    verifierStatus: verifierStatusEnum("verifier_status").notNull(),
    interestFlagsJson: jsonb("interest_flags_json").notNull().$type<string[]>(),
    evidenceItemConfidence: doublePrecision("evidence_item_confidence"),
    // Defect #3: a blind verification re-fetch in Phase 1 always re-fetches
    // the *same* source URL — it is never an independently-discovered
    // second source. This must be recorded, not just folded silently into
    // the confidence math, so `verification_factor` can apply the
    // same-source-re-fetch discount and the fact is auditable later.
    sameSourceRefetch: boolean("same_source_refetch").notNull().default(false),
    // Model-to-artifact provenance (second review round, defect #2): the two
    // model calls that produced this row's excerpt/predicate/value and its
    // evidence_class. Given a claim_evidence row, an auditor traces straight
    // to the exact agent_runs row (provider, model, prompt version + hash).
    extractionAgentRunId: uuid("extraction_agent_run_id").references(() => agentRuns.id),
    evidenceClassAgentRunId: uuid("evidence_class_agent_run_id").references(() => agentRuns.id)
  },
  (table) => ({
    // Idempotency (defect #5): the same excerpt from the same snapshot,
    // supporting the same claim, is one evidence row even under a repeated
    // identical run — never a duplicate that could skew a (future) summed
    // rollup or inflate audit/evidence counts.
    claimSnapshotExcerptUnique: uniqueIndex("claim_evidence_claim_snapshot_excerpt_key").on(
      table.claimId,
      table.sourceSnapshotId,
      table.excerptLocation
    )
  })
);

// --- research_runs ----------------------------------------------------

export const researchRuns = pgTable("research_runs", {
  id: uuid("id").primaryKey(),
  objective: text("objective").notNull(),
  runType: text("run_type").notNull(),
  status: runStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  tokenBudget: integer("token_budget").notNull(),
  monetaryBudget: doublePrecision("monetary_budget").notNull(),
  sourceBudget: integer("source_budget").notNull(),
  partialReason: text("partial_reason")
});

// --- agent_runs -------------------------------------------------------

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey(),
  researchRunId: uuid("research_run_id")
    .notNull()
    .references(() => researchRuns.id, { onDelete: "cascade" }),
  agentRole: agentRoleEnum("agent_role").notNull(),
  modelProvider: text("model_provider").notNull(),
  modelName: text("model_name").notNull(),
  promptVersion: text("prompt_version").notNull(),
  promptContentHash: text("prompt_content_hash").notNull(),
  status: runStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  costEstimate: doublePrecision("cost_estimate")
});

// --- verification_runs -------------------------------------------------

export const verificationRuns = pgTable("verification_runs", {
  id: uuid("id").primaryKey(),
  researchRunId: uuid("research_run_id")
    .notNull()
    .references(() => researchRuns.id, { onDelete: "cascade" }),
  claimCount: integer("claim_count").notNull(),
  verifiedCount: integer("verified_count").notNull(),
  failedCount: integer("failed_count").notNull(),
  unresolvedCount: integer("unresolved_count").notNull(),
  auditedNonmaterialCount: integer("audited_nonmaterial_count").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});

// --- audit_events -------------------------------------------------------

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  actorType: actorTypeEnum("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  eventType: text("event_type").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

// --- access_policy_registry ---------------------------------------------

export const accessPolicyRegistry = pgTable("access_policy_registry", {
  id: uuid("id").primaryKey(),
  domainPattern: text("domain_pattern").notNull(),
  fetchPolicy: policyDecisionEnum("fetch_policy").notNull(),
  browserPolicy: policyDecisionEnum("browser_policy").notNull(),
  authRequired: boolean("auth_required").notNull(),
  robotsMode: robotsModeEnum("robots_mode").notNull(),
  tosNote: text("tos_note"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true })
});

// --- materiality_sensitivity_rules --------------------------------------

export const materialitySensitivityRules = pgTable("materiality_sensitivity_rules", {
  id: uuid("id").primaryKey(),
  predicatePattern: text("predicate_pattern").notNull(),
  fieldType: materialityFieldTypeEnum("field_type").notNull(),
  affectedDimensions: jsonb("affected_dimensions").notNull().$type<string[]>(),
  affectedActionGate: boolean("affected_action_gate").notNull(),
  material: boolean("material").notNull(),
  ruleVersion: integer("rule_version").notNull(),
  active: boolean("active").notNull()
});
