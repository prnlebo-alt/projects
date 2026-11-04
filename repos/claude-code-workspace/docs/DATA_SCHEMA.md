# Data Schema — v1.0

PostgreSQL is authoritative. JSONB is for audit/raw payloads, not strategic diffs. Drizzle migrations are generated in Phase 1/2.

## Phase 1 tables

### `sources`
`id, canonical_url, domain, source_type, publisher, title, published_at, first_fetched_at, last_fetched_at, fetch_status, content_hash`

### `source_snapshots`
`id, source_id, fetched_at, content_hash, raw_content_location, normalized_text_location, screenshot_location, fetch_method, access_policy_result`

### `source_families`
`id, family_type, canonical_origin_source_id, fingerprint, created_at`

### `source_family_members`
`source_snapshot_id, source_family_id, membership_rule, similarity_score`

Unique on `source_snapshot_id` — a snapshot is clustered into exactly one
family, once; re-running clustering never forks or duplicates membership
(defect #5). `source_snapshots` itself is unique on `(source_id,
content_hash)` for the same reason.

### `claims`
`id, subject_type, subject_id, predicate, object_value, normalized_value, claim_status, material, first_observed_at, last_verified_at, confidence`

Unique on `(subject_type, subject_id, predicate, normalized_value)` — semantic
claim identity (independent-review defect #2). A second supporting source
attaches as another `claim_evidence` row on the existing claim via
`findOrCreateClaim`, never as a second `claims` row; `claim_status` only
ever moves forward (`pending_grounding` → `grounded`/`grounding_failed` →
`verified`/`verification_failed`/`verification_unresolved`), so one new
piece of evidence can never silently regress an already-stronger claim.

### `claim_evidence`
`id, claim_id, source_snapshot_id, evidence_class, support_type, excerpt_location, grounding_status, extractor_confidence, verifier_status, interest_flags_json, evidence_item_confidence, same_source_refetch`

Unique on `(claim_id, source_snapshot_id, excerpt_location)` — idempotent
under reruns and overlapping-query dedup (defect #5). `same_source_refetch`
(defect #3) records that Phase 1's blind verification re-fetch re-fetched
the *same* source URL rather than an independently discovered second
source; `evidenceConfidence.verificationFactor` applies its discount from
this flag, not from an assumption. Claim-level `confidence` is recomputed
from *all* of a claim's persisted `claim_evidence`, collapsed by
`source_family` (max per family, via `recomputeClaimConfidence`) — not from
whichever evidence item most recently arrived.

### `research_runs`
`id, objective, run_type, status, started_at, completed_at, token_budget, monetary_budget, source_budget, partial_reason`

### `agent_runs`
`id, research_run_id, agent_role, model_provider, model_name, prompt_version, prompt_content_hash, status, started_at, completed_at, cost_estimate`

### `verification_runs`
`id, research_run_id, claim_count, verified_count, failed_count, unresolved_count, audited_nonmaterial_count, completed_at`

### `audit_events`
`id, actor_type, actor_id, event_type, object_type, object_id, payload, created_at`

### `access_policy_registry`
V1 implementation table required by the pre-fetch gate: `id, domain_pattern, fetch_policy, browser_policy, auth_required, robots_mode, tos_note, reviewed_by, reviewed_at, expires_at`

### `materiality_sensitivity_rules`
Required to avoid circular materiality scoring: `id, predicate_pattern, field_type, affected_dimensions, affected_action_gate, material, rule_version, active`

## Phase 2+ tables

`markets, market_lanes, companies, company_aliases, products, agent_offerings, capabilities, offering_capabilities, internal_facts, internal_fact_evidence, competitor_snapshots, change_events, opportunities, opportunity_scores, threats, threat_scores, score_evidence, recommendations, alerts`.

See `docs/ARCHITECTURE.md` §10 for full field inventory and relationships.

## State rules

- Material strategic state consumes verified grounded claims only.
- Raw page/screenshot data lives in object storage; DB stores hashes/locations.
- Prompt content hash is mandatory for model-produced artifacts.
- `competitor_snapshots.state_json` is audit-only; normalized relational fields drive diffs.
- Missing data never silently changes scoring denominators.
- Every model call in the evidence pipeline writes an `agent_runs` row
  (research run, agent role, provider, model, prompt version + content
  hash, status, timing) before its proposal is used (defect #6) —
  provenance is never reconstructed after the fact from logs.
- Access-policy enforcement is structural, not call-site discipline:
  `AccessPolicyGatedFetchAdapter`/`AccessPolicyGatedBrowserAdapter`
  (`packages/tools`) are the only adapters pipeline code ever holds, so
  discovery and independent-verification re-fetches cannot diverge in
  policy treatment (defect #1). The gate itself never trusts a stored
  `allow` at face value when `auth_required` or `robots_mode` signals a
  restriction without a recorded human review (defect #7).
