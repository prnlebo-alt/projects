/**
 * Opportunity/threat scoring (ARCHITECTURE.md §13-§17: raw dimensions,
 * evidence-confidence gates, change significance, competitor velocity,
 * BUILD/BUY/PARTNER/WATCH/IGNORE precedence).
 *
 * Deliberately empty in Phase 1. PHASE1_BUILD_DIRECTIVE.md hard boundary:
 * "Do not implement production opportunity scoring, competitor velocity,
 * final strategic recommendation... Stubs/interfaces are permitted only
 * when required for Phase 1 boundaries/tests" — none of this package's
 * subject matter is required to pass the Phase 1 gate, so nothing is
 * stubbed out ahead of need. This package exists (per the frozen
 * repository shape, ARCHITECTURE.md §24) so Phase 4/5 code has a home
 * without restructuring the monorepo.
 */
export const PHASE_1_SCOPE_NOTE =
  "packages/scoring is unimplemented in Phase 1 by design — see docs/ARCHITECTURE.md §13-17, unlocked in Phase 4.";
