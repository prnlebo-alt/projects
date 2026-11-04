# Evidence Doctrine — v1.0

This document is constitutional. Code and prompts must conform to it. Changes require an ADR plus relevant benchmark re-run.

## Core rules

1. **No material conclusion without provenance.** Every factual input to current strategic state resolves to stored source snapshots or provenanced internal facts.
2. **Vendor claims prove the vendor said it, not that the outcome is independently true.**
3. **Absence of evidence is not evidence of absence.** Failed search maps to `not_found_after_search`, never `confirmed_absence`.
4. **Contradictions persist.** Support and counter-evidence remain linked until resolved.
5. **Every claim is timestamped and freshness-aware.**
6. **Material claims require independent verification.** Evidence & Research cannot exempt its own claims.
7. **Every quoted/extracted excerpt must ground to the stored source snapshot before verification can promote the claim.**
8. **Self-interest is an orthogonal modifier.** Track `subject_owned`, `subject_commissioned`, `subject_sponsored`, `syndicated_from_subject`.
9. **Syndication is not corroboration.** Unique URLs/domains do not imply independent source families.
10. **Missing strategic evidence fails closed.** No score/action may silently omit a required dimension.

## Materiality

Materiality is deterministic. `material=true` when a claim:

- changes pricing, maturity, availability, buyer fit, capability presence, partnership/acquisition status, or a current recommendation;
- maps through the versioned `materiality_sensitivity_rules` table to a score dimension/action gate designated material;
- can move an opportunity/action across a configured gate;
- creates a HIGH/CRITICAL change event;
- supports/contradicts a kill condition; or
- is selected by deterministic audit sampling.

Do **not** run live counterfactual scoring on an unverified claim to decide whether it deserves verification.

Non-material audit sampling defaults to 10%, seeded by claim ID + run ID.

## Grounding gate

Promotion from `unverified` to `verified` requires:

1. exact normalized-text match, else
2. deterministic local fuzzy/semantic match above configured threshold, else
3. terminal `grounding_failed`.

A model-created quote is never trusted by itself.

## Evidence classes

| Class | Base reliability |
|---|---:|
| Audited/regulatory/primary dataset | 1.00 |
| Direct customer primary statement | 0.95 |
| Independent analyst/academic/reputable research | 0.90 |
| Implementation partner, named deployment | 0.75 |
| Vendor primary product/documentation | 0.65 |
| Vendor case study/outcome | 0.55 |
| Demo/roadmap/launch without availability proof | 0.40 |
| Marketing-only assertion | 0.25 |
| Unverified/inaccessible | 0.00 |

## Maturity

- `GA`: currently available/licensable without requiring a consultancy engagement to operate it.
- `Packaged`: named repeatable service delivered through consulting.
- `Accelerator/Demo`: reusable/demo-ready but not sufficiently proven GA.
- `Marketing Only`: described/announced without enough availability/repeatability evidence.
- `Pilot/Beta`: explicitly limited availability.
- `Unknown`: insufficient evidence.

Launch language alone never upgrades to GA. Public self-service signup is not required for enterprise GA; credible current primary availability/licensing evidence is.

## Source-family independence

Source families are finalized deterministically. Text similarity + time proximity **alone is insufficient**; the 0.90 similarity rule must co-fire with a secondary shared-origin fingerprint such as distinctive quote attribution, uncommon numeric/factual fingerprint, wire marker, or release identifier.

## TTL defaults

Pricing 14d; maturity/availability 30d; leadership/hiring 30d; product positioning 60d; customer sentiment 90d rolling; analyst market structure 180d; historical verified events do not auto-expire.
