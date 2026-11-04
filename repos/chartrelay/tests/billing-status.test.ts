import { describe, expect, it } from "vitest";
import { describeBilling } from "@/lib/billing/status";

const free = { plan: "free", stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, currentPeriodEnd: null, cancelAt: null };

describe("describeBilling", () => {
  it("reports the limit the owner actually has on the Free plan", () => {
    // An unverified free workspace has no credit at all under the four-tier ladder, so the dashboard
    // must say 0 rather than the advertised figure.
    expect(describeBilling(free, false).detail).toContain("0 renders per month");
    expect(describeBilling(free, false).detail).toContain("Confirm your email to raise it to 250.");
    expect(describeBilling(free, true).detail).toContain("250 renders per month");
    expect(describeBilling(free, true).detail).not.toContain("Confirm your email");
  });

  it("labels every rung of the ladder, including rows still carrying the retired plan name", () => {
    expect(describeBilling({ ...free, plan: "developer" }).planLabel).toBe("Developer");
    expect(describeBilling({ ...free, plan: "pro" }).planLabel).toBe("Pro");
    expect(describeBilling({ ...free, plan: "business" }).planLabel).toBe("Business");
    // Rows written before the rename still say "scale"; they are Business, never Free.
    expect(describeBilling({ ...free, plan: "scale" }).planLabel).toBe("Business");
  });
});
