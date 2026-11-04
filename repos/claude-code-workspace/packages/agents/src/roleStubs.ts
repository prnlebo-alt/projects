/**
 * AGENT_CONTRACTS.md defines five permanent roles. Phase 1
 * (PHASE1_BUILD_DIRECTIVE.md) implements only Evidence & Research
 * concretely (see evidenceAndResearch/pipeline.ts). The other four are
 * typed stubs: their contracts exist so later phases slot in without
 * reshaping this package, but calling them before their phase unlocks is a
 * build-discipline error, not a silent no-op.
 */
export class PhaseNotUnlockedError extends Error {
  constructor(role: string, requiredPhase: number) {
    super(
      `${role} is not implemented until Phase ${requiredPhase} ` +
        "(CLAUDE.md: \"Implement Phase 1 only. Do not build production Phase 2+ capabilities early.\")"
    );
    this.name = "PhaseNotUnlockedError";
  }
}

/** AGENT_CONTRACTS.md #1 — Phase 1-5 orchestrator; full authority unlocks progressively. */
export class MarketIntelligenceDirectorStub {
  planResearch(): never {
    throw new PhaseNotUnlockedError("Market Intelligence Director full orchestration", 2);
  }
}

/** AGENT_CONTRACTS.md #3 — resolves verified claims into competitor state. */
export class CompetitiveIntelligenceStub {
  applyVerifiedClaims(): never {
    throw new PhaseNotUnlockedError("Competitive Intelligence", 2);
  }
}

/** AGENT_CONTRACTS.md #4 — opportunity/threat scoring. */
export class GapOpportunityHunterStub {
  scoreOpportunity(): never {
    throw new PhaseNotUnlockedError("Gap / Opportunity Hunter", 4);
  }
}

/** AGENT_CONTRACTS.md #5 — BUILD/BUY/PARTNER/WATCH/IGNORE recommendation + Gauntlet. */
export class StrategyAndGauntletStub {
  recommend(): never {
    throw new PhaseNotUnlockedError("Strategy + Gauntlet", 5);
  }
}
