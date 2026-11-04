# Scoring and Decision Specification — v1.0

All calculations live in `/packages/scoring`. Prompts may explain scores but may not calculate or override authoritative values.

## Claim confidence

`item = base_reliability × freshness × extraction_certainty × verification × interest`

Collapse duplicates within each deterministic source family by retaining that family's maximum item confidence.

`claim_confidence = clamp01((1 - Π(1-family_confidence_i)) × corroboration_factor)`

Corroboration counts independent source families, not URLs/domains.

## Dimension evidence confidence

Each dimension records `score_evidence` links with direction and influence. Duplicate families collapse within a dimension.

Current v1 formula:

`support = 1 - Π(1 - claim_confidence_i × influence_i)`

`counter = 1 - Π(1 - claim_confidence_j × influence_j)`

`dimension_confidence = clamp01(support × (1 - 0.5 × counter))`

**ADR-004 required before Phase 4 sign-off:** recalibrate the counter-evidence ceiling so near-total well-grounded contradiction can dominate rather than only halve confidence.

## Overall evidence confidence

Weighted geometric mean:

`100 × exp(Σ(w_i × ln(max(c_i,0.01))) / Σw_i)`

Critical opportunity dimensions: Pain, Whitespace, Technical Feasibility, Strategic Fit, Competitive Advantage. Any critical confidence < 0.50 caps action at WATCH.

**Fail closed:** any required dimension lacking evidence links and lacking an explicit assumption-sensitive state makes the score `incomplete`. Do not re-normalize weights around missing dimensions.

## Opportunity score weights

Pain 18; Whitespace 18; Technical Feasibility 14; Strategic Fit 12; Competitive Advantage 12; Repeatability 10; Revenue Potential 8; Market Velocity 8.

Evidence Confidence is a separate gate.

## Threat weights

Capability Overlap 30; Competitor Velocity 20; Distribution/Buyer Access 15; Product Maturity 15; Buyer Fit 10; Evidence Confidence 10.

## Change significance

CRITICAL 1.00; HIGH 0.75; MEDIUM 0.45; LOW 0.20 using the versioned event rule table in Architecture §15.

## Competitor velocity — frozen formula

Use a single continuous decay clock over 180 days:

`decayed_weight_e = significance_weight_e × exp(-days_since_event/45)`

`current_intensity = Σ(decayed_weight_e)` for ages 0–90.

`prior_intensity = Σ(decayed_weight_e)` for ages 91–180.

`current_daily = current_intensity/90`

`prior_daily = prior_intensity/90`

`activity_score = 100 × (1 - exp(-current_intensity/3))`

`acceleration_ratio = (current_daily-prior_daily)/max(prior_daily,0.01)`

`acceleration_score = clamp(50 + 25×acceleration_ratio,0,100)`

`competitor_velocity = round(0.70×activity_score + 0.30×acceleration_score)`

The same event must never gain weight merely by aging across a bucket boundary.

## Action precedence

1. Evaluate PARTNER preemption before BUILD.
2. If preemption applies, BUILD is blocked unless the explicit BUILD exception passes and receives human approval.
3. If internal differentiation facts are missing/stale, route to WATCH/human review; absence is not evidence of no differentiation.
4. Remaining non-BUILD precedence: `PARTNER > BUY > WATCH > IGNORE`.

### PARTNER preemption

Preempt BUILD if overlap >=70 and >=2 independent GA competitors overlap >=70; OR one specialist has overlap >=85 + GA + meaningful production/customer evidence + no proven unique internal differentiation.

### BUILD exception

Requires Competitive Advantage >=85; Strategic Fit >=80; both confidence >=80 backed by current internal facts; engine/IP-level differentiation; Gauntlet pass; human approval.

### BUILD default

No preemption; opportunity >=75; evidence confidence >=75; feasibility >=70; strategic fit >=70; advantage >=65; no critical dimension confidence <50.

## Assumptions

Unsourced/stale Revenue Potential, Strategic Fit, or Competitive Advantage => `assumption_sensitive=true`; dimension evidence confidence capped at 49. Revenue Potential effective weight is additionally halved when assumption-sensitive.

## Correlated evidence

**ADR-005 required before Phase 4 sign-off:** cap total influence from a single claim/source family reused across multiple dimensions or apply a correlation discount to the overall rollup.
