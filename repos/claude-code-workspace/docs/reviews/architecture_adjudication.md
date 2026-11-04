# Market Intelligence & Opportunity Hunter
## Architecture Adjudication Register — v0.1 → v1.0

**Date:** 2026-08-25  
**Input:** Claude Code adversarial architecture review  
**Decision authority:** Architecture owner  
**Outcome:** Architecture v0.1 is not frozen. The blocking defects are accepted and corrected in v1.0. A second-pass validation is required before implementation.

---

## Executive Adjudication

Claude's FAIL verdict is accepted.

The review identified genuine implementation ambiguity in the exact mechanisms that are supposed to prevent bad intelligence from becoming strategic recommendations. The most important defects are not stylistic: undefined evidence-confidence rollup, undefined corroboration/syndication detection, non-independent materiality selection, undefined competitor velocity/change significance, missing score-to-evidence traceability, and no hard BUILD-vs-PARTNER precedence rule.

Architecture v1.0 therefore makes the following structural changes:

- Reduce permanent roles from six to five by folding Discovery into Evidence & Research.
- Move materiality, grounding, corroboration, maturity floors, change significance, velocity, scoring, and action precedence into deterministic code/rules wherever practical.
- Add explicit score-to-evidence provenance.
- Add a curated internal-facts model for Strategic Fit and Competitive Advantage.
- Replace the circular strategic benchmark with process-fidelity plus held-out generalization.
- Add a hard PARTNER-preempts-BUILD rule when mature external engines already own the core capability.
- Treat Qwen as high-volume proposal/extraction labor, never as final authority on maturity, entity merge/split, contradiction resolution, or strategic action.

---

## Defect-by-Defect Decisions

| # | Claude Finding | Decision | v1.0 Treatment |
|---|---|---|---|
| 1 | Evidence-confidence rollup undefined | ACCEPT | Deterministic claim → cluster → dimension → opportunity/threat confidence formulas added in `/packages/scoring`. |
| 2 | No deterministic syndication/corroboration detection | ACCEPT | Add source-family clustering using canonical URL, wire/source ancestry, normalized text similarity, and publication-time clustering before corroboration is counted. |
| 3 | Verification is not actually independent | ACCEPT | Materiality is deterministic; Evidence Agent cannot choose which of its own claims avoid verification. Random audit sampling added. |
| 4 | No BUILD-vs-PARTNER precedence | ACCEPT | Hard PARTNER preemption added when mature external capability overlap crosses threshold; BUILD exception requires elevated advantage + Gauntlet + human approval. |
| 5 | Benchmark is circular | ACCEPT | Replace conclusion-matching benchmark with process-fidelity corpus plus held-out generalization test. Baseline report remains a reference, not answer key. |
| 6 | Discovery Agent duplicates Scout Worker | ACCEPT | Discovery folded into Evidence & Research; five permanent roles. |
| 7 | Competitor velocity/change significance undefined | ACCEPT | Deterministic event significance table, decayed event intensity, and acceleration formula added. |
| 8 | No internal capability data model | ACCEPT | Add `internal_facts` and `internal_fact_evidence`; Strategic Fit/Competitive Advantage cannot be high-confidence without provenance. |
| 9 | No score-to-evidence linkage | ACCEPT | Add `score_evidence` join table linking each score dimension to claim/internal-fact IDs, direction, and influence weight. |
| 10 | No hallucination-grounding gate | ACCEPT | Claim promotion requires excerpt/source grounding match before verification can pass. |
| 11 | Commissioned/self-interested research not distinct | ACCEPT WITH MODIFICATION | Add orthogonal `interest_flags` and reliability modifier rather than a new mutually exclusive evidence class. |
| 12 | No standing moat-premise check | ACCEPT / DEFER TO PHASE 4 | Add recurring `moat_erosion` research objective to monthly opportunity rescans. |
| 13 | Acceptance gates gameable | ACCEPT | Materiality defined, maturity/evidence classification graded on labeled corpus, and Gauntlet weakness must map to a kill condition or score-changing input. |
| 14 | No minimum evidentiary floor per maturity level | ACCEPT WITH MODIFICATION | GA requires current primary availability/licensing evidence independent of consultancy engagement; public self-service signup is not required. |
| 15 | Snapshot JSONB diff false positives | ACCEPT | Diff normalized relational state; JSON snapshot is audit artifact only. |
| 16 | Cost controls lack per-role ceilings/graceful degradation | ACCEPT / DEFER TO PHASE 6 IMPLEMENTATION | Schema/config reserved now; execution behavior specified for Phase 6. |
| 17 | robots/ToS compliance not enforced | ACCEPT WITH MODIFICATION | Deterministic adapter/domain access policy + robots parsing where applicable; no LLM may decide to bypass controls. Legal/ToS ambiguity remains a human-configured allow/deny policy, not pretend-automated legal interpretation. |

---

## Unnecessary Complexity Adjudication

### `observations`

**CUT from V1.** It duplicates claims/change events without a defined consumer.

### `capabilities` / `offering_capabilities`

**RETAIN, simplified.** Claude's critique was valid under v0.1 because nothing consumed the tables. In v1.0 they are now required by deterministic capability-overlap and BUILD-vs-PARTNER precedence logic. `capabilities` remains a controlled taxonomy; `offering_capabilities` is evidence-derived and links back to claims.

### Prompt provenance

**ACCEPT.** Every agent run stores both a human-readable `prompt_version` and immutable `prompt_content_hash`.

---

## Blocking vs. Backlog

### Blocking before Phase 1 implementation

The following must exist in v1.0 before Claude Code writes production implementation:

- deterministic confidence aggregation
- syndication/corroboration clustering
- deterministic materiality and audit sampling
- hard PARTNER-vs-BUILD precedence
- non-circular benchmark
- five-role agent model
- deterministic significance/velocity formulas
- internal-facts provenance model
- score-to-evidence linkage
- grounding gate
- self-interest evidence modifier
- tightened acceptance gates
- maturity evidentiary floor
- prompt content hashing

### ADR-linked backlog, not Phase 1 blockers

- recurring moat-erosion scan implementation (Phase 4)
- snapshot retention/compaction tuning (Phase 3/6)
- per-role runtime budgets and graceful degradation (Phase 6)
- queue/database separation trigger (Phase 6)
- value-per-dollar monitoring metric (Phase 6)
- deeper domain access-policy catalog (Phase 1 onward)

---

## Freeze Decision

Architecture v0.1 remains **REJECTED / SUPERSEDED**.

Architecture v1.0 may be marked **CANDIDATE FOR FREEZE**, not final PASS, until Claude Code performs a second-pass adversarial validation against the corrected document.

Implementation is still prohibited until that second-pass verdict is PASS or PASS WITH NON-BLOCKING CONDITIONS.
