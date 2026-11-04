import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb } = await import("@mi/db");
const { evaluateAccessPolicy, evaluateAccessPolicyWithAudit } = await import("./gate.js");
const { FixtureRobotsPolicyResolver } = await import("./robotsPolicy.js");

describe("access policy gate", () => {
  const db = getDb();

  beforeAll(async () => {
    // Sanity: the seed script (packages/db/src/seed.ts) must have run against
    // this database before this suite executes.
    const decision = await evaluateAccessPolicy(db, "https://blocked.example.com/page", "fetch");
    if (decision.matchedDomainPattern === null) {
      throw new Error(
        "access_policy_registry looks unseeded. Run `npm run db:seed -w @mi/db` first."
      );
    }
  });

  it("denies a domain explicitly marked deny", async () => {
    const decision = await evaluateAccessPolicy(db, "https://blocked.example.com/page", "fetch");
    expect(decision.result).toBe("deny");
  });

  it("allows a domain matched by a wildcard allow pattern", async () => {
    const decision = await evaluateAccessPolicy(db, "https://sub.example.com/page", "fetch");
    expect(decision.result).toBe("allow");
  });

  it("fails closed to manual_policy_required for a domain with no rule", async () => {
    const decision = await evaluateAccessPolicy(
      db,
      "https://never-configured.test/page",
      "fetch"
    );
    expect(decision.result).toBe("manual_policy_required");
    expect(decision.matchedDomainPattern).toBeNull();
  });

  it("routes an authenticated domain to manual_policy_required, not allow", async () => {
    const decision = await evaluateAccessPolicy(db, "https://authwall.example.com/page", "fetch");
    expect(decision.result).toBe("manual_policy_required");
  });

  it("caps a misconfigured auth-required allow rule to manual_policy_required (defect #7: auth_required participates in the gate)", async () => {
    const decision = await evaluateAccessPolicy(
      db,
      "https://misconfigured-auth.example.com/page",
      "fetch"
    );
    expect(decision.result).toBe("manual_policy_required");
    expect(decision.reason).toContain("auth_required=true");
  });

  it("caps an unreviewed robots override to manual_policy_required (defect #7: robots_mode participates in the gate)", async () => {
    const decision = await evaluateAccessPolicy(
      db,
      "https://unreviewed-robots-override.example.com/page",
      "fetch"
    );
    expect(decision.result).toBe("manual_policy_required");
    expect(decision.reason).toContain("robots_mode=override_authorized");
  });

  it("genuinely allows a reviewed auth-required domain (auth_required does not always fail closed — review unlocks it)", async () => {
    // robots_mode=respect on this fixture too, so a robots-allow answer must
    // be supplied or the new robots check would fail closed on its own.
    const robots = new FixtureRobotsPolicyResolver([{ domain: "reviewed-auth.example.com", directive: "allow" }]);
    const decision = await evaluateAccessPolicy(db, "https://reviewed-auth.example.com/page", "fetch", robots);
    expect(decision.result).toBe("allow");
  });

  it("defect #3 (second review round): robots disallow denies the fetch regardless of stored policy/review", async () => {
    const robots = new FixtureRobotsPolicyResolver([{ domain: "robots-disallow.example.com", directive: "disallow" }]);
    const decision = await evaluateAccessPolicy(db, "https://robots-disallow.example.com/page", "fetch", robots);
    expect(decision.result).toBe("deny");
    expect(decision.reason).toContain("disallow");
  });

  it("defect #3: robots allow lets a reviewed rule proceed to allow", async () => {
    const robots = new FixtureRobotsPolicyResolver([{ domain: "robots-disallow.example.com", directive: "allow" }]);
    // Same fixture row, opposite resolver answer — proves the directive,
    // not the domain name, decides the outcome.
    const decision = await evaluateAccessPolicy(db, "https://robots-disallow.example.com/page", "fetch", robots);
    expect(decision.result).toBe("allow");
  });

  it("defect #3: ambiguous/unavailable robots directive under respect mode fails closed even when reviewed", async () => {
    // No fixture entry for this domain at all — resolver returns "unavailable".
    const robots = new FixtureRobotsPolicyResolver([]);
    const decision = await evaluateAccessPolicy(db, "https://robots-ambiguous.example.com/page", "fetch", robots);
    expect(decision.result).toBe("manual_policy_required");
    expect(decision.reason).toContain("unavailable");
  });

  it("defect #3: the default resolver (none supplied) is itself fail-closed under respect mode", async () => {
    // No robots resolver argument at all — must not silently default to allow.
    const decision = await evaluateAccessPolicy(db, "https://robots-ambiguous.example.com/page", "fetch");
    expect(decision.result).toBe("manual_policy_required");
  });

  it("defect #3: robots_mode=override_authorized bypasses robots lookup but still needs a recorded human review", async () => {
    // Explicit authorized override stays human-configured/audited — already
    // covered by "caps an unreviewed robots override..." above; this
    // confirms it doesn't even consult the robots resolver (override implies
    // the human already accounted for robots, not that robots says allow).
    const robots = new FixtureRobotsPolicyResolver([
      { domain: "unreviewed-robots-override.example.com", directive: "disallow" }
    ]);
    const decision = await evaluateAccessPolicy(
      db,
      "https://unreviewed-robots-override.example.com/page",
      "fetch",
      robots
    );
    // Still manual_policy_required for lack of review — not "deny" from a
    // robots check that override_authorized mode should skip entirely.
    expect(decision.result).toBe("manual_policy_required");
    expect(decision.reason).toContain("robots_mode=override_authorized");
  });

  it("a model's suggestion cannot override an access-policy deny", async () => {
    const decision = await evaluateAccessPolicyWithAudit(
      db,
      "https://blocked.example.com/page",
      "fetch",
      "allow" // a model proposing to override — must be ignored
    );
    expect(decision.result).toBe("deny");
  });

  it("evaluateAccessPolicy's own signature accepts no model-override parameter", () => {
    // Function.length only counts parameters before the first default —
    // the optional robotsResolver (a deterministic policy dependency, not a
    // model-suggestion channel) has a default, so this stays 3.
    expect(evaluateAccessPolicy.length).toBe(3);
  });
});
