# Architectural Decisions Log
**Project Plant · Running document**

---

## Decision format
Each entry: what was decided, why, and what it closes off.

---

### ADR-001 — Zero-knowledge read boundary
**Date:** 2026-05-13
**Decision:** The Genetic Scorer reads structural metadata only. `value`, `innerText`, `textContent`, `innerHTML` are permanently off-limits with no exceptions.
**Why:** Enables the "zero-knowledge" claim in enterprise security reviews. Makes the extension legally distinguishable from a keylogger or scraper.
**Closes off:** Any future feature that requires reading user-typed content (e.g. auto-complete suggestions, prompt history). Those features are permanently out of scope.

---

### ADR-002 — B2B first, B2C second
**Date:** 2026-05-13
**Decision:** Primary commercial target is the B2B single-line injection script. B2C extension is a marketing surface and proof-of-concept, not the revenue engine.
**Why:** B2B has higher ACV, lower churn, and stickier installs. Once a `<script>` tag is in a production header, it rarely gets removed.
**Closes off:** Optimizing the product roadmap around B2C feature requests (custom themes, social sharing, etc.) until B2B is proven.

---

### ADR-003 — Pilot is the 90s music shop
**Date:** 2026-05-13
**Decision:** First B2B client is a known entity (friend's store). No cold outreach until the pilot produces a documented case study.
**Why:** Controls variables. Known stakeholder. Failure is recoverable. Produces real evidence for the enterprise pitch.
**Closes off:** Skipping the pilot and going straight to enterprise sales.

---

### ADR-004 — Remote payload is data, not code
**Date:** 2026-05-13
**Decision:** `selectors.json` contains attribute strings and weights only. No functions, no eval, no dynamic script loading.
**Why:** MV3 compliance. Chrome Web Store explicitly bans remotely hosted code. Violating this gets the extension removed.
**Closes off:** Any "smart" server-side logic that gets executed client-side.

---

### ADR-005 — Legal consult before production code
**Date:** 2026-05-13
**Decision:** No production extension submitted to any store until a tech attorney reviews ToS exposure and trademark boundaries.
**Why:** The accessibility framing is positioning, not legal armor. Need an actual opinion before commercial launch.
**Closes off:** Rushing to publish before legal review is complete.
