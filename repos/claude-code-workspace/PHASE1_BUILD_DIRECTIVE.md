# Claude Code Directive — Phase 1: Evidence Engine

You are the implementation agent. Architecture is frozen. Do not redesign the product, skip gates, or build UI beyond what is needed for testing/admin inspection.

## Authority order

1. `CLAUDE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/EVIDENCE_DOCTRINE.md`
4. `docs/AGENT_CONTRACTS.md`
5. `docs/SCORING.md`
6. `docs/BENCHMARK.md`
7. `docs/TASK_BOARD.md`
8. ADRs

If documents conflict, stop the conflicting task, record it in an ADR candidate, and follow the higher authority. Do not silently reconcile constitutional evidence rules.

## Objective

Implement Phase 1 only: a durable evidence pipeline that can discover/fetch permitted public sources, store immutable snapshots, atomize grounded claims, classify evidence, distinguish independent corroboration from syndication, deterministically select material/audited claims for independent verification, and preserve a complete audit trail.

## Mandatory pre-code resolutions

These are already decided and must be reflected in code:

1. **Materiality:** do not live-re-score an unverified claim. Use the versioned `materiality_sensitivity_rules` mapping plus static criteria.
2. **Source-family rule 3:** >=0.90 text similarity + <=7-day proximity cannot by itself merge sources. It must co-fire with a secondary shared-origin fingerprint.

## Hard Phase 1 boundaries

Do not implement production opportunity scoring, competitor velocity, final strategic recommendation, full monitoring scheduler, or polished UI. Stubs/interfaces are permitted only when required for Phase 1 boundaries/tests.

## Required implementation sequence

### 1. Foundation
Create TypeScript workspace; quality commands; env schema; test harness; deterministic IDs/hashes where appropriate.

### 2. Database + audit
Implement Phase 1 tables from `DATA_SCHEMA.md`; migrations; durable run states; prompt content hashes; audit events.

### 3. Interfaces
Implement provider-neutral Search/Fetch/Browser/Model contracts. Start with deterministic fixture/fake adapters so tests do not require paid APIs. Browser implementation uses Playwright. Qwen is behind ModelAdapter; no API key is required to complete core tests.

### 4. Access-policy gate
Every external fetch/browser call passes the deterministic policy gate. Models cannot override denial.

### 5. Snapshot pipeline
Canonicalize URL; fetch; hash; persist immutable snapshot metadata; skip unchanged content; object-storage abstraction.

### 6. Source-family clustering
Implement deterministic rules and emit membership reason. Create labeled tests including syndicated PR copies and two genuinely independent similar reports.

### 7. Claim extraction + grounding
Structured atomic claim output. Store source/excerpt location. Exact match first, deterministic local fuzzy fallback second. No grounding => no verification promotion.

### 8. Evidence classification
Implement evidence classes, interest flags, freshness/extraction/verification modifiers, claim-confidence calculation. Model may propose classification; deterministic floors must be enforced.

### 9. Materiality + audit sampling
Implement static materiality rules and seeded 10% audit sampler. Producer cannot modify result.

### 10. Independent verification
Verifier payload excludes original analysis/rationale. Re-fetch source independently where possible. Persist verified/failed/unresolved result. Only verified+grounded material claims may promote into strategic current-state eligibility.

### 11. Benchmark
Build frozen labeled fixtures and generate machine-readable plus Markdown Phase 1 gate report.

## Required tests before declaring Phase 1 PASS

- Grounding state-machine contract: 100%
- Materiality recall: >=95% on labeled corpus
- Fabricated URL/source identifiers: 0 accepted
- Vendor/self-interest labeling: >=95%
- Syndicated-vs-independent family accuracy: >=90%
- Material verification selection: 100% deterministic
- Audit sample reproducible from seed
- Model cannot override access-policy deny
- Vendor outcome claim cannot become independent proof
- Failed search cannot create confirmed absence
- Unresolved contradiction cannot be deleted
- Stale pricing cannot be treated current without refresh

## Evidence of completion

Do not say PASS based on prose. Produce:

- test command output
- typecheck/lint/build output
- migration/schema proof
- benchmark metrics
- sample provenance trace: source -> snapshot -> claim -> grounding -> materiality -> verifier
- sample syndicated-source-family trace
- audit log proof
- `/docs/evidence/phase1-gate.md`

## Stop condition

If any blocking Phase 1 gate fails, remain in Phase 1 and fix it. Do not start Phase 2.

## First response in Claude Code

Before editing files, inspect the package and return a concise implementation plan mapped to `TASK_BOARD.md`, note any hard environment dependency that cannot be mocked, and then proceed autonomously with Phase 1 unless a genuine credential/authorization boundary prevents the specific next operation.
