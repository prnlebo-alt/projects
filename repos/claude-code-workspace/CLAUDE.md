# Market Intelligence & Opportunity Hunter — Claude Code Operating Contract

**Architecture:** v1.0 Final — FROZEN
**Current authorized phase:** Phase 1 — Evidence Engine
**V1 market:** Agentic Salesforce for PE-backed mid-market companies, focused on revenue-cycle and finance-adjacent workflows.

## Mission

Build a persistent, evidence-first market-intelligence system that discovers and verifies competitive evidence, preserves historical state, detects meaningful market changes, finds whitespace, and eventually recommends BUILD / BUY / PARTNER / WATCH / IGNORE.

The system is not a report generator and must not become an AI confidence theater machine. Truth, provenance, independent verification, reproducibility, and deterministic gates take precedence over speed or impressive output.

## Constitutional rules

- No material conclusion without provenance.
- Vendor claims are not independent proof.
- Absence of evidence is not evidence of absence.
- Contradictions are retained.
- Material claims require independent verification selected deterministically.
- Every promoted excerpt must ground to the stored source snapshot.
- Syndication is not corroboration.
- Missing score inputs fail closed.
- Deterministic code owns formulas, thresholds, state transitions, access policy, hashing, audit sampling, action precedence, and budget enforcement.
- Models may propose but cannot override deterministic evidence/action gates.
- Secrets never enter prompts, source control, evidence snapshots, or logs.

## Permanent roles

1. Market Intelligence Director
2. Evidence & Research
3. Competitive Intelligence
4. Gap / Opportunity Hunter
5. Strategy + Gauntlet

Discovery is not a sixth permanent agent; Evidence & Research spawns Scout Workers.

## Current phase rule

Implement **Phase 1 only**. Do not build production Phase 2+ capabilities early. No polished dashboard. No production strategy recommendation. No production opportunity scoring.

Phase 1 objective: source adapters -> access policy -> immutable snapshots -> deterministic source-family clustering -> atomic claims -> grounding -> evidence classification/modifiers -> deterministic materiality/audit sampling -> blind independent verification -> audit trail -> benchmark gate.

## Model routing

All models sit behind `/packages/models`.

Qwen-class models: high-volume extraction, fixed-enum classification proposals, duplicate/source-family features, normalization proposals, summarization, contradiction candidates. Qwen does not finalize maturity, ambiguous entity merges, contradiction adjudication, or strategy.

Frontier models: ambiguous adjudication and later strategic synthesis/Gauntlet.

Core Phase 1 tests must run without a paid model/provider by using deterministic fixtures/fakes.

## Required repository shape

```text
/apps
  /web
  /worker
/packages
  /db
  /agents
  /models
  /tools
  /evidence
  /scoring
  /schemas
  /prompts
  /testing
/docs
  ARCHITECTURE.md
  EVIDENCE_DOCTRINE.md
  DATA_SCHEMA.md
  SCORING.md
  AGENT_CONTRACTS.md
  BENCHMARK.md
  TASK_BOARD.md
  /ADR
CLAUDE.md
PHASE1_BUILD_DIRECTIVE.md
```

## Engineering defaults

- TypeScript end-to-end.
- PostgreSQL + Drizzle.
- Separate Node worker process.
- pg-boss/equivalent for V1 durable jobs unless tests prove a blocker.
- Playwright browser adapter.
- S3-compatible object-storage abstraction.
- Next.js web/API shell only as required; UI is Phase 7.
- Provider-neutral adapters.

## Build discipline

Update `docs/TASK_BOARD.md` as work completes. Commit/evidence boundaries should correspond to coherent Phase 1 task groups. Do not mark PASS without machine-verifiable evidence.

Any proposed change to evidence doctrine, score math, action precedence, or architecture requires an ADR and relevant benchmark re-run. Do not casually "improve" frozen rules while implementing.

## Phase 1 known conditions already resolved

- Materiality uses static/versioned sensitivity mapping; do not counterfactually score an unverified claim to decide verification.
- Source-family high-text-similarity rule requires a secondary shared-origin fingerprint; similarity + time alone cannot merge independent reporting.

## Known later-phase ADRs

Do not implement these early. Track them:

- stronger counter-evidence penalty before Phase 4 sign-off;
- correlated cross-dimension evidence discount/cap;
- seed internal facts before PARTNER differentiation checks; absent fact -> WATCH, not "no differentiation";
- corroboration tier smoothing/minimum family-strength calibration.

## Gate discipline

Phase 1 cannot advance to Phase 2 until all applicable evidence gates in `docs/BENCHMARK.md` pass and `/docs/evidence/phase1-gate.md` exists with reproducible evidence.

Read `PHASE1_BUILD_DIRECTIVE.md` before changing code.
