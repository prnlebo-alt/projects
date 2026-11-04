/**
 * Deterministic robots-directive resolver (second review round, defect #3).
 * `access_policy_registry.robots_mode = "respect"` previously existed as a
 * schema field the gate never actually consulted — it capped an unreviewed
 * "allow" but never evaluated an actual robots directive. This interface is
 * the seam a real robots.txt fetcher/parser plugs into later; Phase 1 ships
 * only a fixture implementation — no live network dependency required for
 * the core gate tests.
 */
export type RobotsDirective = "allow" | "disallow" | "unavailable";

export interface RobotsPolicyResolver {
  resolve(url: string): Promise<RobotsDirective>;
}

/** Fixture-backed resolver, keyed by hostname. Unknown host = "unavailable" (ambiguous), never a silent allow. */
export class FixtureRobotsPolicyResolver implements RobotsPolicyResolver {
  private readonly index: Map<string, RobotsDirective>;

  constructor(entries: Array<{ domain: string; directive: RobotsDirective }>) {
    this.index = new Map(entries.map((e) => [e.domain.toLowerCase(), e.directive]));
  }

  async resolve(url: string): Promise<RobotsDirective> {
    const domain = new URL(url).hostname.toLowerCase();
    return this.index.get(domain) ?? "unavailable";
  }
}

/** Safe default when no resolver is supplied: always "unavailable" — the gate fails closed under respect mode, never silently allows. */
export const defaultRobotsPolicyResolver: RobotsPolicyResolver = {
  async resolve(): Promise<RobotsDirective> {
    return "unavailable";
  }
};
