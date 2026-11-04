import { afterEach, describe, expect, it, vi } from "vitest";
import { billingConfigProblems, packPriceId, planForPrice, priceForPlan, stripeClient, BillingConfigError } from "@/lib/billing/stripe";
import { describeBilling } from "@/lib/billing/status";

const validEnv = {
  STRIPE_SECRET_KEY: "rk_test_abc123",
  STRIPE_WEBHOOK_SECRET: "whsec_abc123",
  STRIPE_PRICE_DEVELOPER: "price_developer",
  STRIPE_PRICE_PRO: "price_pro",
  STRIPE_PRICE_BUSINESS: "price_business",
  STRIPE_PRICE_PACK: "price_pack",
};

afterEach(() => vi.unstubAllEnvs());

describe("billing configuration", () => {
  it("maps every paid plan to its configured price and back", () => {
    expect(priceForPlan("developer")).toBe("price_test_developer");
    expect(priceForPlan("pro")).toBe("price_test_pro");
    expect(priceForPlan("business")).toBe("price_test_business");
    expect(planForPrice("price_test_developer")).toBe("developer");
    expect(planForPrice("price_test_pro")).toBe("pro");
    expect(planForPrice("price_test_business")).toBe("business");
    expect(planForPrice("price_somebody_else")).toBeNull();
    expect(planForPrice(undefined)).toBeNull();
  });

  it("reads the render pack's price separately, because a pack is not a plan", () => {
    expect(packPriceId()).toBe("price_test_pack");
    // A pack price must never resolve to a plan: buying one grants credit, not a subscription.
    expect(planForPrice("price_test_pack")).toBeNull();
  });

  it("treats a missing or malformed price as unconfigured", () => {
    vi.stubEnv("STRIPE_PRICE_DEVELOPER", "");
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    vi.stubEnv("STRIPE_PRICE_BUSINESS", "prod_notAPrice");
    vi.stubEnv("STRIPE_PRICE_PACK", "prod_notAPrice");
    expect(priceForPlan("developer")).toBeNull();
    expect(priceForPlan("pro")).toBeNull();
    expect(priceForPlan("business")).toBeNull();
    expect(packPriceId()).toBeNull();
  });

  it("accepts a complete test-mode configuration", () => {
    expect(billingConfigProblems(validEnv)).toEqual([]);
    expect(billingConfigProblems({ ...validEnv, STRIPE_SECRET_KEY: "sk_test_abc123" })).toEqual([]);
  });

  it("reports missing and malformed values without echoing them", () => {
    const problems = billingConfigProblems({ STRIPE_SECRET_KEY: "pk_test_secretvalue", STRIPE_WEBHOOK_SECRET: "nope-secretvalue" });
    // Two malformed secrets plus the four missing price IDs: three plans and the render pack.
    expect(problems).toHaveLength(6);
    expect(problems.join(" ")).not.toContain("secretvalue");
  });

  it("refuses live-mode keys unless live mode is explicitly enabled", () => {
    expect(billingConfigProblems({ ...validEnv, STRIPE_SECRET_KEY: "sk_live_abc123" })).toHaveLength(1);
    expect(billingConfigProblems({ ...validEnv, STRIPE_SECRET_KEY: "sk_live_abc123", STRIPE_LIVE_MODE: "enabled" })).toEqual([]);
  });

  it("throws a configuration error instead of constructing a client without a key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(() => stripeClient()).toThrow(BillingConfigError);
  });
});

describe("billing summary", () => {
  const base = { plan: "free", stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, currentPeriodEnd: null, cancelAt: null };
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString();

  it("describes a free workspace", () => {
    expect(describeBilling(base)).toMatchObject({ planLabel: "Free", statusLabel: "No subscription", canManage: false, hasLiveSubscription: false });
  });

  it("describes an active subscription with its renewal date", () => {
    const summary = describeBilling({ ...base, plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active", currentPeriodEnd: future });
    expect(summary).toMatchObject({ planLabel: "Pro", statusLabel: "Active", tone: "good", canManage: true, hasLiveSubscription: true });
    expect(summary.detail).toMatch(/^Renews on /);
  });

  it("warns when a subscription is scheduled to cancel", () => {
    const summary = describeBilling({ ...base, plan: "business", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active", cancelAt: future });
    expect(summary).toMatchObject({ planLabel: "Business", statusLabel: "Cancels soon", tone: "warning", hasLiveSubscription: true });
    expect(summary.detail).toContain("returns to Free");
  });

  it("flags failed payments and ended subscriptions", () => {
    expect(describeBilling({ ...base, plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "past_due" })).toMatchObject({ tone: "danger", hasLiveSubscription: true });
    expect(describeBilling({ ...base, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" })).toMatchObject({ statusLabel: "Canceled", canManage: true, hasLiveSubscription: false });
  });
});
