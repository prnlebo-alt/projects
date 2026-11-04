# Agent Contracts — v1.0

Five permanent roles. Workers are ephemeral and stateless by default. Durable state lives in PostgreSQL.

## 1. Market Intelligence Director

**Input:** strategic objective, run budget, watchlist/market scope, current state.

**Output:** bounded research plan, delegated tasks, escalation decisions, final briefs/recommendations only after gates.

**May:** orchestrate; enforce budgets; trigger research/re-score/Gauntlet; stop incomplete runs.

**Must not:** bulk-extract; invent facts; waive evidence/action gates; overwrite deterministic scores in prose.

## 2. Evidence & Research

**Input:** bounded queries/entities/sources.

**Output:** candidate entities, source snapshots, atomic claims, provenance, contradiction candidates.

**May:** spawn Scout/Extractor/Specialist workers; propose evidence classes, aliases, merge/split candidates.

**Must not:** finalize ambiguous entity merges; suppress contradictions; lower materiality; promote ungrounded/unverified material claims.

## 3. Competitive Intelligence

**Input:** verified claims, normalized entity/product schema.

**Output:** current/historical competitor state, normalized snapshots, change events.

**May:** apply verified claims; preserve unresolved contradictions; consume deterministic significance/velocity.

**Must not:** update strategic state from unverified material claims; diff raw JSONB as authoritative state.

## 4. Gap / Opportunity Hunter

**Input:** verified market state, customer pain evidence, internal facts, technical feasibility evidence.

**Output:** candidate opportunities/threats, dimension scores with `score_evidence`, assumption flags.

**May:** identify whitespace, contested lanes, BUILD/PARTNER precedents.

**Must not:** infer missing internal capability facts; publish aggregate score with an unpopulated/unflagged dimension; bypass PARTNER preemption.

## 5. Strategy + Gauntlet

**Input:** scored opportunity/threat, evidence links, action-gate result.

**Output:** recommended action, strongest counter-case, kill conditions, challenge outcome.

**May:** search for disconfirming evidence; reopen research; request BUILD exception.

**Must not:** issue BUILD when deterministic preemption blocks it; approve its own BUILD exception; convert missing evidence into favorable assumptions.

## Ephemeral workers

### Scout Worker
Discover sources/entities for one bounded query. No durable strategic decisions.

### Extractor Worker
Atomize already-located content into claim candidates. Every claim requires source snapshot + excerpt location.

### Verifier Worker
Blindly re-fetch/validate selected claims. Must not see original rationale. Returns grounded/failed/unresolved.

### Diff Worker
Compare normalized relational states/snapshots. Raw JSON is audit-only.

### Specialist Worker
Narrow investigation: pricing, maturity, hiring, architecture, buyer, etc.

### Critic Worker
Attack analysis without editing it.

### Judge Worker
Grade process/evidence against fixed rubric, blind to desired conclusion.

## Model routing

Qwen-class models may extract, classify fixed enums, propose duplicates/aliases, summarize, surface contradiction candidates. They are **proposal-only** for maturity, entity merge/split, contradiction adjudication, and strategy.

Frontier reasoning handles ambiguous adjudication, opportunity synthesis, Gauntlet, and executive output. Deterministic code owns gates, formulas, state transitions, audit, and budgets.
