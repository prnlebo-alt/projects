import { describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/market_intelligence_test";

const { getDb } = await import("@mi/db");
const { AccessPolicyGatedBrowserAdapter } = await import("./gatedBrowserAdapter.js");
const { FixtureBrowserAdapter } = await import("../browser/fixtureBrowserAdapter.js");

/** Browser-navigation counterpart to gatedFetchAdapter.test.ts (defect #1). */
describe("AccessPolicyGatedBrowserAdapter", () => {
  const db = getDb();

  it("denies navigation to a denied domain and never calls the inner adapter", async () => {
    const inner = new FixtureBrowserAdapter([
      { url: "https://blocked.example.com/page", visibleText: "should never be reached" }
    ]);
    const navigateSpy = vi.spyOn(inner, "navigate");
    const gated = new AccessPolicyGatedBrowserAdapter(db, inner);

    const result = await gated.navigate({ url: "https://blocked.example.com/page" });

    expect(result.status).toBe("denied");
    expect(result.accessPolicyResult).toBe("deny");
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it("delegates to the inner adapter when the policy allows", async () => {
    const inner = new FixtureBrowserAdapter([
      { url: "https://sub.example.com/page", visibleText: "hello" }
    ]);
    const gated = new AccessPolicyGatedBrowserAdapter(db, inner);

    const result = await gated.navigate({ url: "https://sub.example.com/page" });

    expect(result.status).toBe("ok");
    expect(result.accessPolicyResult).toBe("allow");
    expect(result.visibleText).toBe("hello");
  });
});
