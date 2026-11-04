import { beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb } = await import("@mi/db");
const { AccessPolicyGatedFetchAdapter } = await import("./gatedFetchAdapter.js");
const { FixtureFetchAdapter } = await import("../fetch/fixtureFetchAdapter.js");
const { FixtureRobotsPolicyResolver } = await import("./robotsPolicy.js");

/**
 * Defect #1 (Phase 1 independent review): access-policy enforcement must be
 * structural for every fetch, including a blind independent-verification
 * re-fetch — proved here directly against the wrapper both call sites
 * actually use (packages/agents pipeline.ts wraps `adapters.fetch` in this
 * exact class once, for both discovery and verification).
 */
describe("AccessPolicyGatedFetchAdapter", () => {
  const db = getDb();

  beforeAll(async () => {
    const decision = await (
      await import("./gate.js")
    ).evaluateAccessPolicy(db, "https://blocked.example.com/page", "fetch");
    if (decision.matchedDomainPattern === null) {
      throw new Error("access_policy_registry looks unseeded. Run `npm run db:seed -w @mi/db` first.");
    }
  });

  it("denies a fetch to a denied domain and never calls the inner adapter (discovery call shape)", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://blocked.example.com/page", rawContent: "should never be reached" }
    ]);
    const innerFetchSpy = vi.spyOn(inner, "fetch");
    const gated = new AccessPolicyGatedFetchAdapter(db, inner);

    const result = await gated.fetch({ url: "https://blocked.example.com/page" });

    expect(result.status).toBe("denied");
    expect(result.accessPolicyResult).toBe("deny");
    expect(result.rawContent).toBeNull();
    expect(innerFetchSpy).not.toHaveBeenCalled();
  });

  it("denies the exact same way on a second call against the same instance (verification re-fetch call shape)", async () => {
    // Verification re-fetches call `.fetch()` on the *same* adapter instance
    // discovery used, with the same URL. This proves there is no special
    // "second call" path that skips the gate.
    const inner = new FixtureFetchAdapter([
      { url: "https://blocked.example.com/page", rawContent: "should never be reached" }
    ]);
    const innerFetchSpy = vi.spyOn(inner, "fetch");
    const gated = new AccessPolicyGatedFetchAdapter(db, inner);

    await gated.fetch({ url: "https://blocked.example.com/page" }); // simulated discovery call
    const verifyResult = await gated.fetch({ url: "https://blocked.example.com/page" }); // simulated verifier re-fetch

    expect(verifyResult.status).toBe("denied");
    expect(verifyResult.accessPolicyResult).toBe("deny");
    expect(innerFetchSpy).not.toHaveBeenCalled();
  });

  it("routes an auth-required, unreviewed domain to denied/manual_policy_required, not allow", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://misconfigured-auth.example.com/page", rawContent: "should never be reached" }
    ]);
    const innerFetchSpy = vi.spyOn(inner, "fetch");
    const gated = new AccessPolicyGatedFetchAdapter(db, inner);

    const result = await gated.fetch({ url: "https://misconfigured-auth.example.com/page" });

    expect(result.status).toBe("denied");
    expect(result.accessPolicyResult).toBe("manual_policy_required");
    expect(innerFetchSpy).not.toHaveBeenCalled();
  });

  it("routes an unreviewed robots-override domain to denied/manual_policy_required, not allow", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://unreviewed-robots-override.example.com/page", rawContent: "should never be reached" }
    ]);
    const gated = new AccessPolicyGatedFetchAdapter(db, inner);

    const result = await gated.fetch({ url: "https://unreviewed-robots-override.example.com/page" });

    expect(result.status).toBe("denied");
    expect(result.accessPolicyResult).toBe("manual_policy_required");
  });

  it("delegates to the inner adapter and returns its content when the policy allows", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://sub.example.com/page", rawContent: "PRICING_MODEL: $10/month" }
    ]);
    const gated = new AccessPolicyGatedFetchAdapter(db, inner);

    const result = await gated.fetch({ url: "https://sub.example.com/page" });

    expect(result.status).toBe("ok");
    expect(result.accessPolicyResult).toBe("allow");
    expect(result.rawContent).toBe("PRICING_MODEL: $10/month");
  });

  it("defect #3 (second review round): robots disallow means the underlying fetch adapter never runs", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://robots-disallow.example.com/page", rawContent: "should never be reached" }
    ]);
    const innerFetchSpy = vi.spyOn(inner, "fetch");
    const robots = new FixtureRobotsPolicyResolver([{ domain: "robots-disallow.example.com", directive: "disallow" }]);
    const gated = new AccessPolicyGatedFetchAdapter(db, inner, robots);

    const result = await gated.fetch({ url: "https://robots-disallow.example.com/page" });

    expect(result.status).toBe("denied");
    expect(result.accessPolicyResult).toBe("deny");
    expect(innerFetchSpy).not.toHaveBeenCalled();
  });

  it("defect #3: robots allow lets the underlying fetch adapter run", async () => {
    const inner = new FixtureFetchAdapter([
      { url: "https://robots-disallow.example.com/page", rawContent: "PRICING_MODEL: $10/month" }
    ]);
    const robots = new FixtureRobotsPolicyResolver([{ domain: "robots-disallow.example.com", directive: "allow" }]);
    const gated = new AccessPolicyGatedFetchAdapter(db, inner, robots);

    const result = await gated.fetch({ url: "https://robots-disallow.example.com/page" });

    expect(result.status).toBe("ok");
    expect(result.rawContent).toBe("PRICING_MODEL: $10/month");
  });

  it("has no parameter for a model (or anything else) to pass a policy override through", () => {
    const gated = new AccessPolicyGatedFetchAdapter(db, new FixtureFetchAdapter([]));
    expect(gated.fetch.length).toBe(1);
  });
});
