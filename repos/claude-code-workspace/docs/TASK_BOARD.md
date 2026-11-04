# Task Board — Market Intelligence & Opportunity Hunter

## Phase 0 — FROZEN

- [x] Architecture v1.0
- [x] First adversarial review
- [x] Adjudication register
- [x] Second adversarial review
- [x] PASS WITH NON-BLOCKING CONDITIONS
- [x] Freeze architecture
- [x] Generate Claude Code build package

## Phase 1 — Evidence Engine — GATE PASSED

See `/docs/evidence/phase1-gate.md` for the machine-generated evidence backing every checkbox below.

### P1-J Independent-review corrections (post-gate FAIL → fixed)

A Phase 1 independent review returned FAIL against 8 defects before Phase 2
was authorized to begin. All 8 are corrected, each with its own regression
test — see the "Phase 1 independent-review corrections" table in
`/docs/evidence/phase1-gate.md` for the defect-by-defect evidence mapping.

- [x] #1 Structural access-policy enforcement for all fetch/browser ops, including blind verification re-fetches
- [x] #2 Deterministic semantic claim identity/upsert + source-family-collapsed `claimConfidence()`
- [x] #3 Real `ageDays` from publication/observation time; same-source-refetch marked and discounted
- [x] #4 Source-family rule 2 requires shared wire item identity, not just wire-service name
- [x] #5 Idempotent claim/family/evidence persistence across reruns and overlapping queries (DB uniqueness constraints)
- [x] #6 `agent_runs` provenance for every model call in the evidence pipeline
- [x] #7 `robots_mode`/`auth_required`/ToS fields structurally participate in the access-policy gate
- [x] #8 Strengthened benchmark/integration tests (fabricated-URL proof, verifier policy enforcement, rerun idempotency, overlapping-query dedup, independent-vs-syndicated corroboration, stale-evidence freshness decay, same-wire-service negative case)

### P1-K Second independent-review round (targeted corrections)

A follow-up review returned FAIL against 5 further defects. All 5 are
corrected — see "Second review round" in `/docs/evidence/phase1-gate.md`.

- [x] #1 Incremental source-family reconciliation across separate monitoring runs (`reconcileSourceFamilies`, `sources.wireService`/`wireItemId`/`canonicalPublisherItemId`/`syndicatedFromUrl` persisted for cross-run comparison)
- [x] #2 Model-to-artifact provenance completed: `callModelWithProvenance` exposes `agentRunId`; `claim_evidence.extraction_agent_run_id`/`evidence_class_agent_run_id` link every row to its producing model run; returned `promptContentHash` validated against expected, mismatch fails/audits
- [x] #3 Robots-policy enforcement completed: `RobotsPolicyResolver` interface + fixture implementation; `evaluateAccessPolicy` denies on disallow, fails closed on unavailable/ambiguous even when reviewed, `override_authorized` stays human-configured/audited without consulting robots
- [x] #4 Repository CI: `.github/workflows/phase1-ci.yml` (install → migrate → seed → typecheck → lint → test → benchmark → gate → build against real PostgreSQL 16)
- [x] #5 Repository hygiene: Vercel integration investigated and documented (`/docs/evidence/vercel-integration-status.md`, no external changes made without authorization); PR #5 description updated to current test count/evidence

### P1-L Third independent-review round (evidence-consistency fix) — FROZEN

A final narrow review found stale claim confidence after a source-family
merge. Fixed — see "Third review round" in `/docs/evidence/phase1-gate.md`.
**Phase 1 is frozen as of this round.**

- [x] #1 `reconcileSourceFamilies` recomputes `claims.confidence` for every persisted claim citing a snapshot from a merged family, once membership convergence is complete, and audits the recomputation — even for a claim absent from the merging run

### P1-A Repository/Foundation
- [x] Initialize TypeScript monorepo/workspaces
- [x] Create `/apps/web`, `/apps/worker`, package directories, docs
- [x] Configure lint/typecheck/test/build commands
- [x] Add env validation with no secrets committed
- [x] Add structured logging + run IDs

### P1-B Database/Audit
- [x] Implement Phase 1 Drizzle schema and migrations
- [x] Implement research/agent/verification/audit run records
- [x] Implement prompt content hashing
- [x] Add transaction boundaries for partial runs — per-item try/catch in
      `runEvidencePipeline` with `research_runs.status` set to `partial` +
      `partialReason` on any caught failure (not full nested SQL
      transactions per item; see `packages/agents/src/evidenceAndResearch/pipeline.ts`)

### P1-C Provider interfaces
- [x] SearchAdapter contract + fixture implementation
- [x] FetchAdapter contract + fixture/local implementation
- [x] BrowserAdapter contract + Playwright implementation
- [x] ModelAdapter contract + fake/test adapter
- [x] Qwen adapter stub/config path; no hard dependency

### P1-D Access policy
- [x] Implement domain policy registry
- [x] robots/access/auth checks
- [x] deny/manual-policy-required states
- [x] contract tests proving models cannot override deny

### P1-E Snapshots/source families
- [x] URL canonicalization
- [x] Content hashing + unchanged skip
- [x] Snapshot persistence/object-storage interface
- [x] Deterministic source-family rules
- [x] Implement secondary shared-origin fingerprint requirement for similarity rule
- [x] Calibrate against labeled corpus to >=90% accuracy (100% on the frozen 10-pair corpus)

### P1-F Claims/grounding
- [x] Atomic claim schema
- [x] Claim-evidence linkage
- [x] Exact grounding
- [x] Local fuzzy/semantic grounding fallback
- [x] `grounding_failed` terminal state
- [x] Evidence-class/interest modifiers

### P1-G Materiality/verification
- [x] Create versioned `materiality_sensitivity_rules`
- [x] Implement deterministic materiality service
- [x] Implement seeded 10% audit sample
- [x] Independent verifier task payload excludes original rationale
- [x] Verified material claim promotion state machine

### P1-H Benchmark/evidence fixtures
- [x] Create frozen labeled corpus
- [x] Test fabricated URL/source-ID rejection
- [x] Test vendor/self-interest labels
- [x] Test source-family independence
- [x] Test materiality recall >=95% (100% on the frozen corpus)
- [x] Test deterministic audit sampling

### P1-I Phase 1 Evidence Gate
- [x] All applicable Phase 1 benchmark gates PASS
- [x] Evidence report written to `/docs/evidence/phase1-gate.md`
- [x] No Phase 2 implementation before gate PASS

## Phase 2 — Competitor Memory — BLOCKED BY P1
- [ ] Entity/product/offering model
- [ ] Capability taxonomy
- [ ] Entity resolution
- [ ] Maturity rules
- [ ] Internal facts
- [ ] Normalized competitor state

## Phase 3 — Change Detection — BLOCKED
- [ ] Normalized diffs
- [ ] Change significance
- [ ] Continuous-clock velocity formula
- [ ] Burn-in false-positive metric

## Phase 4 — Opportunity Engine — BLOCKED
- [ ] ADR: counter-evidence penalty
- [ ] ADR: cross-dimension correlated evidence
- [ ] Seed internal facts before differentiation checks
- [ ] Opportunity/threat scoring
- [ ] PARTNER preemption
- [ ] Held-out generalization

## Phase 5 — Strategy + Gauntlet — BLOCKED
- [ ] Recommendation engine
- [ ] Counter-case/kill conditions
- [ ] BUILD exception + human approval

## Phase 6 — Continuous Monitoring — BLOCKED
- [ ] Scheduler/adaptive TTL
- [ ] Per-role budgets/graceful partial runs
- [ ] Cost per decision-relevant insight
- [ ] Signal/noise metrics

## Phase 7 — UI — BLOCKED
- [ ] Market Brief
- [ ] Change Feed
- [ ] Opportunity Board
- [ ] Competitor Profile
- [ ] Evidence Drill-down
