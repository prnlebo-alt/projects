# Market Intelligence & Opportunity Hunter
## Phase 0 Architecture and Build Specification — v1.0 Final

**Status:** FROZEN — implementation authorized for Phase 1  
**Date:** August 25, 2026  
**Purpose:** Production architecture for V1 competitive intelligence and opportunity hunting  
**V1 Market:** Agentic Salesforce solutions for PE-backed mid-market companies, emphasizing revenue-cycle and finance-adjacent workflows  
**Baseline reference:** Accordion Salesforce Practice Competitive Scan, August 23, 2026

---

## 1. Executive Decision

Build a persistent, evidence-first market-intelligence system rather than a report generator.

The system continuously discovers relevant competitors and adjacent threats, converts source material into grounded atomic claims, verifies material claims independently, maintains historical competitor state, detects meaningful changes, identifies market gaps, scores opportunities and threats, and recommends:

**BUILD / BUY / PARTNER / WATCH / IGNORE**

The architecture uses **five permanent agent roles** and elastic ephemeral workers. Permanent roles own bounded responsibilities. Workers provide temporary scale or independence. Deterministic services own calculations, state transitions, thresholds, corroboration, freshness, significance, velocity, and action gates wherever practical.

No model may promote an unsupported claim, fabricate evidence, or bypass an evidence/action gate by narrative persuasion.

---

## 2. Core Business Problem

Competitive intelligence is episodic and rapidly stale. A one-time research run can identify market structure, but it cannot preserve state, measure competitor movement, detect emerging entrants, re-evaluate whitespace, or continuously challenge whether a prior strategy still holds.

V1 must answer:

1. Where are we ahead or behind?
2. What changed since the last verified observation?
3. Which competitors are accelerating?
4. Which market lanes are saturating or opening?
5. Which customer problems remain poorly served?
6. Where does current agent technology reliably work versus fail?
7. Where do we have an evidence-backed right to win?
8. When should we BUILD versus PARTNER rather than recreate a mature external engine?
9. What evidence produced each score and recommendation?
10. What evidence or condition would invalidate the recommendation?

---

## 3. V1 Scope Boundary

### In scope

- Agentic Salesforce products and services.
- PE-backed mid-market buyer context.
- Revenue-cycle and finance-adjacent workflows.
- Salesforce-native offerings and substitutes competing for the same workflow or budget.
- Large SIs, Salesforce specialists, software vendors, and PE/CFO advisory competitors.
- Publicly accessible evidence plus explicitly curated internal capability facts.
- Discovery of new competitors/products/lanes.
- Source snapshots, claim verification, historical state, change detection, threat/opportunity scoring.
- Evidence-backed BUILD / BUY / PARTNER / WATCH / IGNORE recommendations.

### Out of scope for V1

- Unbounded general-AI market monitoring.
- Automated outreach to competitors or prospects.
- Competitive deception or impersonation.
- Bypassing paywalls, access controls, or authentication barriers.
- Automated scraping of authenticated sources without explicit authorization.
- Autonomous purchasing, contracting, or corporate strategy changes.
- Unsupported competitor revenue forecasting.
- UI-first product development before evidence quality passes.

---

## 4. Seed Market Universe

### Platform

- Salesforce

### Large consultancies / SIs

- Deloitte
- Accenture
- PwC
- IBM
- Cognizant
- Capgemini
- Infosys
- TCS
- Persistent
- KPMG
- EY

### Salesforce specialists

- NeuraFlash
- Coastal / TCS
- DemandBlue
- Mphasis Silverline
- Perficient
- Spaulding Ridge
- additional specialists discovered by the system

### Software vendors

- Clari
- DealHub
- Vendavo
- Zilliant
- HighRadius
- Sidetrade
- Conga
- PROS
- IBM watsonx sales/finance products
- additional adjacent vendors discovered by the system

### PE / CFO advisory competitors

- West Monroe
- Alvarez & Marsal
- Riveron
- FTI Consulting
- AlixPartners
- Crowe
- additional relevant firms discovered by the system

The watchlist is not closed. Discovery is a responsibility of Evidence & Research and is executed through Scout Workers.

---

## 5. Permanent Agent Architecture

### Agent 1 — Market Intelligence Director

**Mission:** Own objectives, orchestration, evidence gates, budgets, escalation, and final outputs.

**Responsibilities:**

- Convert strategic questions into bounded research plans.
- Decide when to run discovery, monitoring, deep research, verification, re-scoring, or Gauntlet challenge.
- Assign tasks to permanent roles and workers.
- Enforce budgets, stop conditions, and incomplete-run handling.
- Reject conclusions that fail deterministic evidence or action gates.
- Produce Market Brief, Change Brief, Opportunity Board, and decision memos.
- Maintain run auditability.

**Must not:** perform bulk extraction, invent facts, waive failed gates, or rewrite deterministic scores through prose.

### Agent 2 — Evidence & Research

**Mission:** Discover relevant entities/sources and convert public information into grounded, structured claims.

**Responsibilities:**

- Spawn Scout Workers for bounded discovery.
- Search, fetch, browse, and extract relevant source material.
- Generate atomic claims.
- Classify source/evidence type as a proposal subject to deterministic floors and validation.
- Capture provenance, dates, access caveats, and raw evidence locations.
- Identify contradiction candidates; never suppress potentially material contradictions.
- Route claims into deterministic materiality/verification flow.
- Propose entity aliases and merge/split candidates; never finalize ambiguous merges.

**Primary output:** candidate entities, source snapshots, claims, and evidence records.

### Agent 3 — Competitive Intelligence

**Mission:** Resolve verified claims into current and historical competitor state.

**Responsibilities:**

- Apply verified claims to normalized entity/product/offering state.
- Preserve unresolved contradictions.
- Maintain maturity, pricing, buyer, positioning, traction, hiring, acquisition, partnership, and capability attributes.
- Generate normalized competitor snapshots.
- Produce change events from normalized state diffs.
- Consume deterministic change significance and competitor velocity services.

**Primary output:** current state, historical state, and verified change events.

### Agent 4 — Gap / Opportunity Hunter

**Mission:** Identify underserved market problems where pain, whitespace, technical feasibility, strategic fit, repeatability, and advantage align.

**Responsibilities:**

- Compare customer pain to competitor coverage and maturity.
- Distinguish true whitespace from failed research.
- Assess whether the workflow is suitable for current agent technology.
- Identify build-vs-partner precedents.
- Consume internal capability facts for Strategic Fit and Competitive Advantage.
- Produce candidate opportunity scores from structured evidence links.

**Primary output:** scored opportunities with provenance and assumptions.

### Agent 5 — Strategy + Gauntlet

**Mission:** Convert intelligence into action while attempting to falsify the proposed action.

**Responsibilities:**

- Recommend BUILD / BUY / PARTNER / WATCH / IGNORE only after deterministic gates run.
- Produce strongest case and strongest counter-case.
- Search for evidence that could flip the action.
- Test data-readiness, governance, lock-in, cost, timing, and moat assumptions.
- Explicitly challenge PARTNER-vs-BUILD precedent.
- Define kill conditions.
- Escalate any BUILD exception around a mature external engine to human approval.

**Primary output:** decision memo, counter-case, kill conditions, and challenge outcome.

---

## 6. Ephemeral Worker Model

Workers are stateless by default. Durable state lives in PostgreSQL.

- **Scout Worker:** discovers sources/entities for one bounded query.
- **Extractor Worker:** converts already-located content into atomic claims.
- **Verifier Worker:** independently re-fetches and validates claims without seeing the original rationale.
- **Diff Worker:** compares normalized snapshots/source snapshots.
- **Specialist Worker:** investigates pricing, maturity, hiring, architecture, etc.
- **Critic Worker:** attacks an analysis without editing it.
- **Judge Worker:** grades evidence/process against a fixed rubric.

Qwen-class workers may propose classifications and contradictions but may not suppress downstream review or finalize sensitive judgments.

---

## 7. Evidence Doctrine

These are runtime rules, not prompt suggestions.

### 7.1 No conclusion without provenance

Every material factual claim must resolve to one or more source snapshots or curated internal facts.

### 7.2 Vendor claims are claims, not independent proof

A vendor source proves the vendor made the statement; it does not independently prove the claimed outcome.

### 7.3 Absence of evidence is not evidence of absence

Allowed states:

- `not_found_after_search`
- `source_inaccessible`
- `evidence_conflicts`
- `confirmed_absence`
- `not_applicable`

`confirmed_absence` requires an explicit rule for the predicate being tested; a failed search alone cannot create it.

### 7.4 Contradictions are retained

Conflicting claims remain linked until resolved. Models may surface contradictions but cannot silently delete the weaker side.

### 7.5 Every claim is timestamped

Store first observed, last verified, publication date when available, and effective date when different.

### 7.6 Evidence expires

Default TTLs:

- pricing: 14 days
- product availability/maturity: 30 days
- leadership/hiring: 30 days
- partnerships/acquisitions: 60 days after verification, then historical
- product positioning: 60 days
- customer sentiment: 90-day rolling window
- analyst market structure: 180 days
- historical event facts: no automatic expiry once verified

### 7.7 Strategic outputs expose assumptions

Weakly supported assumptions cannot silently dominate score/action logic.

### 7.8 Grounding gate

A claim cannot move from `unverified` to `verified` unless each cited supporting excerpt can be grounded to the stored source snapshot.

Grounding implementation:

1. exact normalized-text match where possible;
2. otherwise deterministic fuzzy/semantic-local match above configured threshold;
3. if still unmatched, verifier status is `grounding_failed` and claim cannot promote.

A model-provided quote/excerpt is never trusted without this check.

### 7.9 Self-interest is orthogonal to evidence class

Evidence records may carry interest flags:

- `subject_owned`
- `subject_commissioned`
- `subject_sponsored`
- `syndicated_from_subject`

These flags reduce reliability through an `interest_factor`; they do not replace evidence class.

### 7.10 Materiality is deterministic

A claim is `material=true` if any of the following apply:

- it changes pricing, maturity, availability, buyer fit, capability presence, partnership/acquisition status, or a current recommendation;
- its predicate/field type is mapped by the versioned `materiality_sensitivity_rules` table to a score dimension or action gate with `material=true`; live counterfactual scoring of an unverified claim is prohibited;
- it can move an opportunity/action across a configured gate/threshold;
- it creates a HIGH/CRITICAL change event;
- it supports or contradicts a kill condition;
- it is selected by the non-material audit sampler.

Non-material claims receive a deterministic random audit sample, default **10%**, seeded by claim ID/run ID for reproducibility.

The Evidence & Research agent cannot lower materiality to avoid verification.

---

## 8. Evidence Classes and Claim Confidence

### 8.1 Base reliability

| Evidence class | Base reliability |
|---|---:|
| independently audited / regulatory / primary dataset | 1.00 |
| direct customer primary statement | 0.95 |
| independent analyst / academic / reputable research | 0.90 |
| implementation partner reporting named deployment | 0.75 |
| vendor primary product/documentation claim | 0.65 |
| vendor case study / vendor-reported outcome | 0.55 |
| demo / roadmap / launch announcement without availability proof | 0.40 |
| marketing-only assertion | 0.25 |
| unverified / inaccessible | 0.00 |

### 8.2 Modifiers

All modifiers are deterministic and bounded 0–1.

`freshness_factor` — derived from TTL and age. 1.00 while fresh, then decays to 0.50 at 2×TTL; current-state predicates cannot use sources beyond 2×TTL without refresh.

`extraction_certainty` — 1.00 for exact grounded structured extraction, 0.90 for grounded free text, maximum 0.75 for screenshot-only extraction unless independently corroborated.

`verification_factor`:

- independently verified and grounded: 1.00
- verified by same-source re-fetch only: 0.90
- unverified but permitted for non-material storage: 0.70
- failed/unresolved material verification: 0.00 for promotion into current strategic state

`interest_factor`:

- no self-interest flag: 1.00
- subject-sponsored/commissioned: 0.85
- subject-owned marketing/case study already reflected in class; additional modifier floor 0.90 to avoid double-penalizing unless explicitly syndicated from subject
- syndicated-from-subject copy: 0.80 and cannot count as independent corroboration

### 8.3 Deterministic source-family / syndication clustering

Before corroboration is computed, source snapshots are grouped into `source_families`.

Two snapshots belong to the same family if any deterministic rule fires:

1. same canonical URL or canonical publisher item ID;
2. known wire/source ancestry matches;
3. normalized-text similarity >= 0.90 with publication timestamps within 7 days **and** at least one secondary shared-origin fingerprint (shared distinctive quote attribution, uncommon numeric/factual fingerprint, wire/source marker, or matching release identifier); similarity-and-time alone cannot finalize family membership;
4. >= 0.80 similarity plus a shared unique press-release fingerprint/quoted lead within 7 days;
5. explicit `syndicated_from` metadata identifies common origin.

LLMs may propose candidate relationships, but only deterministic rules finalize family membership.

Independent corroboration counts unique source families, not URLs/domains.

### 8.4 Corroboration factor

For a claim, after source-family grouping:

- top-tier primary/audited evidence with base reliability >= 0.95: 1.00 even if single-source;
- 1 independent family: 0.85
- 2 independent families: 0.93
- 3 independent families: 0.97
- 4+ independent families: 1.00

Syndicated copies do not increment the count.

### 8.5 Claim confidence formula

For each evidence item:

`evidence_item_confidence = base_reliability × freshness_factor × extraction_certainty × verification_factor × interest_factor`

For each source family supporting the same atomic claim, retain the maximum evidence-item confidence from that family.

Let `family_confidence_i` be those maxima and `corroboration_factor` be §8.4:

`claim_confidence = clamp01((1 - Π(1 - family_confidence_i)) × corroboration_factor)`

This gives diminishing returns to additional independent sources while preventing syndicated duplicates from inflating confidence.

### 8.6 Score-dimension evidence confidence

Every score dimension has explicit `score_evidence` links. Each link has:

- evidence reference (`claim_id` or `internal_fact_id`)
- direction (`support` / `counter`)
- influence weight 0.0–1.0
- rationale code

Within each dimension, duplicate source families are collapsed before aggregation.

`support_strength = 1 - Π(1 - claim_confidence_i × influence_weight_i)`

`counter_strength = 1 - Π(1 - claim_confidence_j × influence_weight_j)`

`dimension_evidence_confidence = clamp01(support_strength × (1 - 0.5 × counter_strength))`

A strong unresolved counter-case therefore lowers directional confidence rather than disappearing.

### 8.7 Opportunity/threat evidence-confidence rollup

Overall evidence confidence uses a weighted geometric mean of dimension evidence confidences so one weak critical dimension cannot be hidden by several strong ones:

`overall_evidence_confidence = 100 × exp( Σ(w_i × ln(max(c_i, 0.01))) / Σ(w_i) )`

where `c_i` is the 0–1 dimension evidence confidence and `w_i` is the dimension's scoring weight.

For opportunities, Customer Pain, Market Whitespace, Technical Feasibility, Strategic Fit, and Competitive Advantage are **critical dimensions**. If any critical dimension confidence is below 0.50, final action cannot exceed WATCH regardless of the geometric mean.

---

## 9. Maturity Taxonomy and Evidentiary Floors

### Maturity states

- **GA** — currently available/licensable product usable without requiring a consultancy engagement to operate it.
- **Packaged** — named repeatable service delivered through a consulting engagement.
- **Accelerator / Demo** — demo-ready/reusable accelerator without sufficient evidence of general availability.
- **Marketing Only** — announced/described without enough evidence of current availability or repeatable delivery.
- **Pilot / Beta** — explicitly preview, pilot, beta, or limited availability.
- **Unknown** — insufficient evidence.

### Deterministic evidentiary floors

**GA may be asserted only if:**

- at least one current source is vendor primary documentation, marketplace listing, contractual/terms material, or equivalent primary availability evidence; and
- the source indicates current availability/licensing independent of mandatory consultancy operation; and
- the evidence passes grounding/freshness checks.

A public self-service signup page is helpful but **not required** for enterprise GA.

**Packaged may be asserted only if:** primary vendor/consultancy evidence describes a named, repeatable engagement or offering.

**Pilot/Beta** takes precedence over GA when current primary evidence explicitly limits availability.

Launch announcements alone cannot upgrade maturity to GA.

Ambiguous maturity finalization requires frontier-model adjudication plus evidentiary-floor checks; Qwen may only propose.

---

## 10. Core Data Model

PostgreSQL is the system of record. JSONB is used for raw/audit payloads, not as the authoritative source for strategic diffs.

### Market/entity tables

**markets**
- id
- name
- description
- status
- created_at

**market_lanes**
- id
- market_id
- name
- description
- parent_lane_id
- active

**companies**
- id
- canonical_name
- company_type
- website_domain
- status
- first_seen_at
- last_seen_at

**company_aliases**
- id
- company_id
- alias
- source_id

**products**
- id
- company_id
- name
- description
- product_type
- current_maturity
- first_seen_at
- last_verified_at

**agent_offerings**
- id
- product_id
- company_id
- name
- description
- maturity
- buyer_role
- salesforce_native_level
- first_seen_at
- last_verified_at

**capabilities**
- id
- name
- description
- market_lane_id
- canonical_key

**offering_capabilities**
- id
- offering_id
- capability_id
- support_level
- derived_from_claim_id
- last_verified_at

### Source/evidence tables

**sources**
- id
- canonical_url
- domain
- source_type
- publisher
- title
- published_at
- first_fetched_at
- last_fetched_at
- fetch_status
- content_hash

**source_snapshots**
- id
- source_id
- fetched_at
- content_hash
- raw_content_location
- normalized_text_location
- screenshot_location
- fetch_method
- access_policy_result

**source_families**
- id
- family_type
- canonical_origin_source_id
- fingerprint
- created_at

**source_family_members**
- source_snapshot_id
- source_family_id
- membership_rule
- similarity_score

**claims**
- id
- subject_type
- subject_id
- predicate
- object_value
- normalized_value
- claim_status
- material
- first_observed_at
- last_verified_at
- confidence

**claim_evidence**
- id
- claim_id
- source_snapshot_id
- evidence_class
- support_type
- excerpt_location
- grounding_status
- extractor_confidence
- verifier_status
- interest_flags_json
- evidence_item_confidence

### Internal capability facts

**internal_facts**
- id
- subject_key
- fact_type
- fact_value
- status
- first_confirmed_at
- last_confirmed_at
- confidence
- assumption_sensitive

**internal_fact_evidence**
- id
- internal_fact_id
- source_kind (`internal_document`, `human_confirmed`, `public_source`)
- source_reference
- confirmed_by
- confirmed_at
- confidence

Strategic Fit and Competitive Advantage may consume only `internal_facts` with provenance. If a required fact is missing/stale, the associated dimension is `assumption_sensitive=true` and its evidence confidence is capped at 0.49.

### Change/history tables

**competitor_snapshots**
- id
- company_id
- snapshot_date
- state_json
- state_hash
- confidence

`state_json` is an audit artifact. Diffs operate on normalized relational fields.

**change_events**
- id
- company_id
- product_id
- market_lane_id
- event_type
- old_value
- new_value
- detected_at
- significance_level
- significance_weight
- confidence
- evidence_claim_id

### Opportunity/threat/scoring tables

**opportunities**
- id
- market_lane_id
- title
- problem_statement
- status
- created_at
- last_scored_at

**opportunity_scores**
- id
- opportunity_id
- pain
- whitespace
- technical_feasibility
- strategic_fit
- competitive_advantage
- repeatability
- revenue_potential
- market_velocity
- evidence_confidence
- raw_score
- decision_eligibility
- assumption_sensitive
- calculated_at

**threats**
- id
- company_id
- market_lane_id
- description
- status
- created_at

**threat_scores**
- id
- threat_id
- overlap
- competitor_velocity
- distribution_reach
- maturity
- buyer_fit
- evidence_confidence
- raw_score
- calculated_at

**score_evidence**
- id
- score_type (`opportunity`, `threat`)
- score_id
- dimension
- evidence_type (`claim`, `internal_fact`)
- evidence_id
- direction (`support`, `counter`)
- influence_weight
- rationale_code
- created_at

### Recommendation/run/audit tables

**recommendations**
- id
- target_type
- target_id
- action
- rationale
- counter_case
- confidence
- kill_conditions
- partner_preemption_applied
- exception_reason
- status
- approved_by
- created_at

**research_runs**
- id
- objective
- run_type
- status
- started_at
- completed_at
- token_budget
- monetary_budget
- source_budget
- partial_reason

**agent_runs**
- id
- research_run_id
- agent_role
- model_provider
- model_name
- prompt_version
- prompt_content_hash
- status
- started_at
- completed_at
- cost_estimate

**verification_runs**
- id
- research_run_id
- claim_count
- verified_count
- failed_count
- unresolved_count
- audited_nonmaterial_count
- completed_at

**alerts**
- id
- alert_type
- severity
- entity_type
- entity_id
- reason
- status
- created_at

**audit_events**
- id
- actor_type
- actor_id
- event_type
- object_type
- object_id
- payload
- created_at

The v0.1 `observations` table is removed.

---

## 11. Tool/Provider Abstraction

All external providers sit behind replaceable interfaces.

### Search adapter

Supports web/semantic/domain-restricted search, freshness filters, and result deduplication.

Candidate providers: Exa, Tavily, Parallel, general web search.

### Fetch/extraction adapter

Supports static fetch, clean text, structured extraction, content hashes, and fetch status.

Candidate provider: Firecrawl or equivalent.

### Browser adapter

Supports JavaScript-rendered pages, visible-text capture, screenshots, and controlled navigation.

Candidate implementation: Playwright locally; remote browser infrastructure only if required.

### Access-policy pre-fetch gate

Before any automated fetch/browser action, deterministic policy evaluates:

- configured domain allow/deny state;
- robots directives where applicable to the selected fetch method;
- authentication/paywall/access-control status;
- known contractual/ToS restrictions recorded by a human-administered policy registry.

An LLM may not override a deny decision. Legal ambiguity is not automatically interpreted by an LLM; the adapter returns `manual_policy_required`.

---

## 12. Model Routing

The model layer is provider-neutral.

### Qwen-class role — high-volume labor

Allowed:

- atomizing already-located text into claims
- fixed-enum field/category classification
- candidate source-family/near-duplicate feature generation
- source relevance proposal
- entity normalization proposal
- low-risk summarization
- candidate contradiction surfacing
- screenshot extraction with lower confidence ceiling

Not allowed as final authority:

- suppressing a candidate contradiction
- final GA/Packaged/Accelerator classification
- ambiguous entity merge/split
- final strategic recommendation
- BUILD/PARTNER exception
- final contradiction adjudication

### Frontier-model role

Use for:

- research-plan decomposition
- ambiguous entity resolution
- maturity/contradiction adjudication after deterministic checks
- opportunity synthesis
- Gauntlet challenge
- executive brief and counter-case

### Deterministic code

Required for:

- hashing
- source-family clustering finalization
- excerpt grounding check
- TTL/freshness
- materiality
- audit sampling
- score calculations
- evidence-confidence rollups
- change significance
- competitor velocity
- action precedence/threshold gates
- budget enforcement
- database transitions
- audit logging

No provider-specific model API may exist outside the model-adapter package.

---

## 13. Opportunity Scoring

### Raw dimensions and weights

- Customer Pain — 18%
- Market Whitespace — 18%
- Technical Feasibility — 14%
- Strategic Fit — 12%
- Competitive Advantage — 12%
- Repeatability — 10%
- Revenue Potential — 8%
- Market Velocity — 8%

`raw_opportunity_score` is the weighted arithmetic mean of those 0–100 dimensions.

Evidence Confidence is a separate gate computed by §8.7.

### Score provenance

No dimension receives a final score unless it has `score_evidence` rows or an explicit `assumption_sensitive` flag.

**Fail closed:** if any required dimension has neither evidence links nor an explicit assumption-sensitive state, the opportunity/threat receives `decision_eligibility = incomplete` and no aggregate score or action may be published. Missing dimensions are never silently removed from `Σw_i`.

Every score explanation must be reproducible by querying the evidence links used at calculation time.

### Evidence gates

- overall evidence confidence < 60: cannot exceed WATCH
- 60–74: provisional only
- 75–84: actionable with explicit risks
- 85+: high-confidence eligible
- any critical dimension confidence < 50: cannot exceed WATCH

### Assumption safeguards

If Revenue Potential, Strategic Fit, or Competitive Advantage materially depends on unsourced/stale facts:

- set `assumption_sensitive=true`
- cap that dimension's evidence confidence at 49
- block high-confidence BUILD until resolved

Revenue Potential also has its effective weight contribution capped at 50% of nominal when assumption-sensitive.

---

## 14. Threat Scoring

- Capability Overlap — 30%
- Competitor Velocity — 20%
- Distribution / Buyer Access — 15%
- Product Maturity — 15%
- Buyer Fit — 10%
- Evidence Confidence — 10%

Threat score cannot be driven by company size alone.

Capability Overlap is derived from normalized capability taxonomy and verified offering-capability links.

---

## 15. Deterministic Change Significance

`change_events.significance_level` and `significance_weight` come from a versioned rule table, not model prose.

Initial rule weights:

### CRITICAL — 1.00

- acquisition/merger materially changing competitor capability or buyer access
- new GA offering in a priority market lane with >= 70 capability overlap
- competitor moves from non-GA to GA in a priority lane
- material platform-native feature that directly eliminates/commoditizes a tracked opportunity
- verified pricing/business-model change likely to alter economics by >= 20%

### HIGH — 0.75

- new named product/agent in a tracked lane
- major partnership/integration materially expanding distribution or capability
- new verified enterprise/customer proof materially strengthening maturity/traction
- explicit packaging shift from bespoke to repeatable packaged offering

### MEDIUM — 0.45

- meaningful positioning/ICP shift
- significant hiring cluster indicating strategic direction
- new case study without independently verified outcome
- secondary integration or packaging change

### LOW — 0.20

- copy/style changes
- low-signal content updates
- isolated hiring or promotional activity without strategic implication

Unknown events default to LOW until a frontier reviewer maps them to a versioned rule; no LLM may assign arbitrary numeric significance.

---

## 16. Competitor Velocity

Velocity measures verified strategic movement, not raw content volume.

For each competitor:

Use one continuous decay clock across the full 180-day lookback so an event cannot gain weight merely by crossing a window boundary.

`decayed_weight_e = significance_weight_e × exp(-days_since_event / 45)`

`current_intensity = Σ(decayed_weight_e)` for verified events age 0–90 days.

`prior_intensity = Σ(decayed_weight_e)` for verified events age 91–180 days.

Because the prior bucket is older and therefore naturally more decayed, compare normalized daily intensities rather than resetting the decay clock:

`current_daily = current_intensity / 90`

`prior_daily = prior_intensity / 90`

`activity_score = 100 × (1 - exp(-current_intensity / 3))`

`acceleration_ratio = (current_daily - prior_daily) / max(prior_daily, 0.01)`

`acceleration_score = clamp(50 + 25 × acceleration_ratio, 0, 100)`

`competitor_velocity = round(0.70 × activity_score + 0.30 × acceleration_score)`

The constants are calibration defaults and must be versioned. They may change only through a documented scoring ADR and benchmark re-run.

---

## 17. BUILD / PARTNER / BUY / WATCH / IGNORE Decision Rules

Deterministic precedence runs before model-generated rationale.

### 17.1 PARTNER preempts BUILD

Define:

- `capability_overlap` = 0–100 overlap between the proposed proprietary engine and existing verified GA external capabilities.
- `mature_ga_competitor_count` = number of independent companies with GA maturity and overlap >= 70 in the same core capability.

PARTNER preempts BUILD when:

`capability_overlap >= 70 AND mature_ga_competitor_count >= 2`

OR when one external specialist has:

- capability_overlap >= 85,
- verified GA maturity,
- meaningful production/customer evidence,
- and the proposed proprietary build does not possess a unique internal capability fact supporting differentiation.

When preemption fires, BUILD is blocked regardless of raw opportunity score.

### 17.2 BUILD exception

A blocked BUILD may be reconsidered only when all are true:

- Competitive Advantage >= 85
- Strategic Fit >= 80
- both dimensions have evidence confidence >= 80 and are backed by current internal facts
- the build differentiates at the engine/IP level, not merely by wrapper/branding
- Strategy + Gauntlet explicitly passes the mature-specialist challenge
- human approver records an exception rationale

### 17.3 BUILD default eligibility

If no preemption applies:

- opportunity score >= 75
- evidence confidence >= 75
- technical feasibility >= 70
- strategic fit >= 70
- competitive advantage >= 65
- no critical dimension confidence < 50

### 17.4 PARTNER default

Use when the customer problem is attractive but a mature specialist owns the hard engine and our advantage is integration, orchestration, governance, buyer access, advisory, or a detection/inspection layer.

If the relevant internal-capability facts required to evaluate proprietary differentiation are absent or stale, do **not** interpret absence as "no differentiation." Route to WATCH / human review until facts are seeded.

### 17.5 BUY default

Use for commodity/infrastructure capabilities with minimal strategic differentiation **only when PARTNER conditions do not independently apply**. Action precedence after BUILD preemption is: `PARTNER > BUY > WATCH > IGNORE` unless a documented deterministic rule states otherwise.

### 17.6 WATCH default

Use for insufficient evidence, fast-changing maturity, unresolved contradictions, or uncertain feasibility/timing.

### 17.7 IGNORE default

Use when strategic fit is low, the lane is saturated without differentiated advantage, economics depend on unsupported assumptions, technical reliability is below threshold, or buyer access is weak.

Any manual override is auditable.

---

## 18. Orchestration

### Surveillance loop

1. Scheduler selects due sources/entities by TTL and priority.
2. Evidence & Research spawns Scout Workers for bounded discovery.
3. Access-policy gate evaluates fetch eligibility.
4. Sources are fetched/snapshotted.
5. Extractor Workers create atomic claims.
6. Grounding gate validates excerpts.
7. Deterministic materiality marks claims and samples 10% of non-material claims for audit.
8. Material/audited claims go to independent Verifier Workers.
9. Only verified grounded material claims may update strategic current state.
10. Competitive Intelligence updates normalized state.
11. Normalized diffs produce change events.
12. Deterministic significance/velocity recalculate.
13. HIGH/CRITICAL changes trigger targeted research.

### Intelligence loop

1. Aggregate verified change events by competitor/lane.
2. Recalculate competitor velocity and lane saturation.
3. Recalculate threats.
4. Generate Change Brief with score-evidence trace.

### Opportunity loop

1. Gap Hunter evaluates pain, whitespace, feasibility, internal fit/advantage, repeatability, revenue, and market velocity.
2. Every dimension writes score-evidence links.
3. Evidence-confidence rollup runs.
4. PARTNER-vs-BUILD precedence runs.
5. Strategy + Gauntlet produces recommendation/counter-case/kill conditions.
6. Failed challenge returns to research.
7. Passed recommendation enters Opportunity Board pending human approval.

### Monthly moat-erosion check

Phase 4 onward, run a standing objective:

> Identify competitors or combinations of firms that increasingly replicate the assumed moat: PE/CFO advisory access + Salesforce/Agentforce delivery + repeatable agent/product capability.

Any evidence of moat erosion feeds Strategic Fit/Competitive Advantage and can reopen prior BUILD recommendations.

---

## 19. Monitoring Cadence

### Daily

- priority launches
- pricing/business-model changes
- acquisitions/partnerships
- sources attached to active WATCH items

### Multiple times per week

- product pages
- docs/changelogs
- selected competitor news
- marketplace/availability signals where practical

### Weekly

- hiring signals
- reviews/community sentiment
- positioning pages
- case studies
- partner ecosystem changes

### Monthly

- deep market rescan
- opportunity reranking
- score calibration review
- watchlist expansion/retirement
- source-quality review
- moat-erosion objective

---

## 20. Outputs

### Market Brief

- market structure
- major competitors
- lane saturation
- top threats
- top openings
- evidence confidence

### Change Brief

- verified change
- significance
- why it matters
- evidence
- affected threats/opportunities
- whether prior action should reopen

### Opportunity Board

Each item includes:

- title/lane
- raw opportunity score
- evidence confidence
- assumption-sensitive status
- threat context
- PARTNER-preemption status
- recommended action
- supporting evidence links
- counter-evidence links
- kill conditions
- next research action

---

## 21. Cost and Operational Controls

### Phase 1 baseline controls

- per-run money/token/source budgets
- per-domain fetch cap
- TTL and caching
- content-hash unchanged skip
- URL canonicalization/dedup
- evidence-saturation early stop
- cheap-model-first routing
- premium escalation only for material ambiguity/strategy
- global worker concurrency cap

### Phase 6 required controls

- per-role budget ceilings
- graceful budget exhaustion: finish in-flight durable writes, mark run `partial`, never publish half-calculated final scores/recommendations
- cost per decision-relevant insight
- false-positive change-event rate
- monitoring signal/noise ratio

### Queue/database separation trigger

Revisit pg-boss sharing the primary Postgres when any sustained condition occurs:

- p95 queue wait > 60 seconds for 15 minutes,
- DB CPU > 70% for 15 minutes attributable to worker/queue load,
- > 50 concurrent workers required,
- or queue tables materially degrade OLTP p95 query latency.

This is an operational trigger, not a prediction that V1 needs separate infrastructure.

### Snapshot retention

- retain full source snapshots according to evidence/audit policy
- competitor `state_json` snapshots: retain daily detail 90 days, then monthly compaction while normalized historical change events remain permanent
- legal/compliance retention may override compaction

---

## 22. Security and Governance

- Secrets only in environment/secret management.
- Never persist API keys in prompts/logs/screenshots/evidence.
- No automated competitor login without explicit authorization.
- No access-control bypass or impersonation.
- Access-policy pre-fetch gate is mandatory.
- Preserve raw evidence separately from model interpretation.
- Final recommendations require human approval in V1.
- Material model decisions must be auditable to model, prompt version, prompt content hash, evidence set, scoring version, and timestamp.

---

## 23. Tech Stack

### Language

TypeScript end-to-end for V1.

### Web/API

- Next.js
- TypeScript
- minimal admin UI after intelligence passes

### Database

- PostgreSQL
- pgvector only where semantic retrieval is specifically required
- Drizzle ORM

Managed option: Supabase or Neon.

### Durable execution

- separate Node worker process
- pg-boss or equivalent Postgres-backed durable queue for V1

### Browser

- Playwright

### Storage

- S3-compatible object storage for raw pages/screenshots/artifacts
- database stores metadata/references

### Deployment

- web/API: Vercel or equivalent
- worker: Railway/Fly.io/Render/container equivalent
- managed Postgres
- S3-compatible storage

Architecture remains container-friendly and provider-neutral.

---

## 24. Repository Shape

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
  SCORING.md
  AGENT_CONTRACTS.md
  BENCHMARK.md
  ADR/
  TASK_BOARD.md
CLAUDE.md
```

---

## 25. Testing Strategy

### Unit

- confidence aggregation
- evidence modifiers
- source-family/syndication clustering
- grounding
- freshness
- materiality/audit sampling
- significance
- velocity
- action precedence/gates
- cost-budget enforcement

### Contract

Each agent role receives fixtures and must emit schema-valid outputs.

### Evidence

- vendor claim cannot become independent proof
- failed search cannot become confirmed absence
- contradiction cannot silently disappear
- stale pricing cannot masquerade as current
- syndicated PR copies cannot count as independent corroboration
- material claim cannot bypass independent verification
- ungrounded excerpt cannot promote

### Maturity

- marketing announcement cannot produce GA
- enterprise GA does not require public self-service signup
- consulting-only offering classifies Packaged
- explicit beta/pilot overrides launch language

### Integration

- discover/search → fetch → snapshot → claim → grounding → materiality → verify → state update
- normalized state → change event → significance → velocity
- opportunity → score evidence → confidence → partner/build precedence → Gauntlet → recommendation

### Adversarial

- PR syndication masquerading as corroboration
- stale page vs new announcement
- rename/acquisition/entity merge
- marketing-only product presented as GA
- unsupported market-size assumption
- hallucinated source excerpt
- source inaccessible after initial verification
- high opportunity score in a lane already owned by mature GA specialists
- self-commissioned research masquerading as independent analyst evidence

---

## 26. Non-Circular Benchmark / Acceptance

The August 23 report remains a methodological reference and source of labeled examples; its strategic conclusions are **not** the answer key.

### Test A — Process Fidelity

Freeze a human-labeled corpus derived from a sample of the verified evidence set.

Labels include:

- factual claim accuracy
- evidence class
- interest flags
- maturity
- syndicated vs independent source family
- grounding validity
- contradiction status

The pipeline is graded against factual/process labels, not the report's recommended strategy.

### Test B — Held-Out Generalization

Before Phase 4 is declared complete, run the architecture on a bounded market not covered by the August 23 report, or a genuinely time-shifted evidence set not present in the baseline.

Default immediate test if no later time-shift is available:

> Agentic NetSuite / ERP finance automation for PE-backed mid-market companies, bounded to the same evidence/maturity/BUILD-vs-PARTNER reasoning pattern.

A Judge Worker or human evaluator must be blind to any target strategic conclusion and grades reasoning quality, provenance, contested-lane avoidance, maturity discipline, and counter-evidence handling.

### Phase 1/2 acceptance gates

1. 100% of claims reaching `verified` satisfy the grounding/provenance state-machine contract, and materiality recall on the frozen labeled corpus is >= 95%.
2. Zero fabricated URLs/source identifiers in the frozen test corpus.
3. >= 95% correct vendor-reported/self-interested labeling on labeled corpus.
4. >= 90% agreement on maturity taxonomy on labeled corpus.
5. >= 90% accuracy distinguishing syndicated vs independent source families on labeled corpus.
6. 100% of material claims follow deterministic verification selection; non-material audit sample is reproducible.
7. Every score dimension in benchmark fixtures has queryable `score_evidence` provenance.
8. Unsourced Strategic Fit/Competitive Advantage inputs are capped and cannot produce high-confidence BUILD.

### Phase 3 acceptance gates

9. Seeded material changes are detected with >= 95% recall.
10. False-positive HIGH/CRITICAL change-event rate <= 5% on labeled burn-in fixtures.
11. Competitor velocity is reproducible from the same event history.

### Phase 4/5 acceptance gates

12. PARTNER preemption fires on labeled mature-specialist scenarios, including generic quoting/collections-style fixtures.
13. A BUILD exception cannot pass without elevated advantage, evidence, Gauntlet, and human approval.
14. Held-out generalization test receives PASS from blind evaluator on process/reasoning rubric.
15. Gauntlet must identify at least one weakness tied to a concrete kill condition or a score input that, if changed, could materially alter the recommendation; cosmetic caveats do not satisfy the gate.

If any blocking gate fails, do not proceed to UI-first development.

---

## 27. Build Phases

### Phase 0 — Architecture Freeze

Deliverables:

- architecture v1.0
- adjudication register
- agent contracts
- evidence doctrine
- scoring specification
- benchmark specification
- second-pass Claude validation
- final freeze

### Phase 1 — Evidence Engine

Build:

- source adapters
- access-policy pre-fetch gate
- source snapshots
- source-family clustering
- claim schema/extraction
- grounding gate
- evidence classification/modifiers
- deterministic materiality/audit sampling
- independent verification
- prompt hashing/audit trail

**Gate:** Phase 1/2 evidence-process gates applicable to this phase pass.

### Phase 2 — Competitor Memory

Build:

- entity/product/offering model
- capability taxonomy
- entity resolution
- maturity rules
- internal-facts model
- normalized competitor state/snapshots

**Gate:** labeled market entities/maturity reconstruct correctly from evidence.

### Phase 3 — Change Detection

Build:

- normalized diffs
- change events
- significance
- velocity
- burn-in false-positive measurement

**Gate:** Phase 3 gates pass.

### Phase 4 — Opportunity Engine

Build:

- lane saturation/whitespace
- score-evidence provenance
- opportunity/threat scoring
- evidence-confidence rollups
- moat-erosion objective
- PARTNER/BUILD precedence

**Gate:** held-out generalization prepared and scoring/action fixtures pass.

### Phase 5 — Strategy + Gauntlet

Build:

- recommendation engine
- counter-case
- kill conditions
- challenge loop
- BUILD exception workflow
- human approval

**Gate:** Phase 4/5 gates pass.

### Phase 6 — Continuous Monitoring

Build:

- scheduling/adaptive TTL
- per-role budgets
- graceful degradation
- alerts
- incremental re-analysis
- cost-per-insight and signal/noise metrics

**Gate:** repeated runs update only changed evidence, stay within budget, and meet configured value/signal thresholds.

### Phase 7 — UI

Only after intelligence quality passes.

Build:

- Market Brief
- Change Feed
- Opportunity Board
- Competitor Profile
- Evidence Drill-down
- Score Explanation

---

## 28. ADR-Linked Backlog

Track but do not block Phase 1:

- calibration of confidence/corroboration constants after labeled corpus results
- Phase 4 ADR: allow strong counter-evidence to reduce dimension confidence by more than the current 50% ceiling
- Phase 4 ADR: correlation discount / total influence cap for the same claim or source family reused across multiple score dimensions
- Phase 4 contract: seed/current `internal_facts` for active capability areas before PARTNER differentiation checks go live; missing facts route to WATCH
- Phase 4 ADR: smooth or minimum-strength requirement for corroboration-family tier contribution
- calibration of event significance/velocity constants against burn-in fixtures
- snapshot compaction tuning
- domain-policy catalog expansion
- queue/database split if operational trigger fires
- richer customer-voice source adapters
- commercial reuse/multi-tenant architecture if productization becomes a goal

Any change to constitutional evidence rules, score math, or action precedence requires an ADR and benchmark re-run.

---

## 29. Phase 1 Operating Posture — Frozen Defaults

The following defaults are authorized for Phase 1. They may be changed later by ADR/configuration without weakening evidence rules:

1. **Ownership/product posture:** internal pilot first, designed so commercial reuse is not structurally blocked.
2. **V1 boundary:** agentic Salesforce + PE-backed mid-market remains unchanged.
3. **Internal facts policy:** manually curated, provenanced internal facts first; internal connectors are a later capability.
4. **Budget posture:** low-cost proof-of-concept with hard per-run/source/concurrency caps; no unbounded monitoring spend.
5. **Qwen posture:** hosted API first behind provider-neutral model adapters; self-hosting/open-weight deployment is optional later.

No API key belongs in architecture documents, prompts, source files, or chat messages. Missing internal facts must fail closed to WATCH/incomplete rather than infer a negative.

---

## 30. Freeze Rule

This document is **v1.0 Final** and is implementation-authorized for **Phase 1 only**.

Second-pass Claude Code verdict on August 25, 2026: **PASS WITH NON-BLOCKING CONDITIONS — ARCHITECTURE MAY FREEZE**.

Known later-phase defects are tracked through ADRs and phase gates. Phase 1 may not expand into Phase 2+ merely because code is convenient to write. Each phase advances only after its applicable evidence/benchmark gates pass.
