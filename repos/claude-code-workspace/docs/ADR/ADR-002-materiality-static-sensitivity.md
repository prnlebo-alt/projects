# ADR-002 — Materiality Uses Static Sensitivity Rules

**Status:** Accepted

Do not determine materiality by counterfactually rescoring an unverified claim. Use versioned predicate/field-to-dimension/action-gate mappings plus explicit static criteria and deterministic audit sampling. This removes a circular verification dependency.
