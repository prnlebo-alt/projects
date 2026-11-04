import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { eq } = await import("drizzle-orm");
const { db } = await import("@/lib/db");
const { balances, creditGrants, rateLimits, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { balanceOf, expireGrants, grantCredit, refund, reserve, reverseGrant, settleCharged } = await import("@/lib/ledger/ledger");
const { ensureAllowance } = await import("@/lib/ledger/allowance");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const charts = await import("@/app/api/v1/charts/route");

function seed(options: { plan?: "free" | "developer" | "pro" | "business"; verified?: boolean } = {}) {
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "a@example.com", name: "A", passwordHash: "x", emailVerifiedAt: options.verified === false ? null : now, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "W", plan: options.plan ?? "free", createdAt: now }).run();
}
let n = 0;
const spend = (units = 1) => { const r = reserve({ workspaceId: "ws1", requestId: `r${++n}`, units }); settleCharged(r.id); return r; };

beforeEach(() => {
  db.delete(users).run(); db.delete(balances).run(); db.delete(rateLimits).run(); db.delete(usageEvents).run();
});

describe("monthly allowance", () => {
  it("a verified free workspace with no pack has 250 renders, and can render (the 402-for-everyone regression)", async () => {
    seed();
    const key = storeApiKey("ws1").value;
    const response = await charts.POST(new Request("http://localhost:3000/api/v1/charts", { method: "POST", body: JSON.stringify(sampleSpec), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } }));
    expect(response.status).toBe(201);
    expect(balanceOf("ws1")).toBe(249);
  });

  it("gives an unverified free workspace nothing until the email is confirmed, then 250, once", () => {
    seed({ verified: false });
    ensureAllowance("ws1");
    expect(balanceOf("ws1")).toBe(0);
    db.update(users).set({ emailVerifiedAt: new Date().toISOString() }).where(eq(users.id, "u1")).run();
    ensureAllowance("ws1");
    ensureAllowance("ws1");
    expect(balanceOf("ws1")).toBe(250);
  });

  it("gives each paid plan its own figure", () => {
    for (const [plan, renders] of [["developer", 5_000], ["pro", 25_000], ["business", 100_000]] as const) {
      db.delete(users).run();
      seed({ plan });
      ensureAllowance("ws1");
      expect(balanceOf("ws1")).toBe(renders);
    }
  });

  it("is idempotent: asking again, even many times, grants nothing more", () => {
    seed({ plan: "developer" });
    for (let i = 0; i < 20; i++) ensureAllowance("ws1");
    expect(balanceOf("ws1")).toBe(5_000);
    expect(db.select().from(creditGrants).all()).toHaveLength(1);
  });

  it("grants again next month, and the month's grant expires at the month's end", () => {
    seed({ plan: "developer" });
    ensureAllowance("ws1", new Date("2026-10-09T12:00:00Z"));
    ensureAllowance("ws1", new Date("2026-11-02T12:00:00Z"));
    const grants = db.select().from(creditGrants).all().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    expect(grants.map((g) => g.expiresAt)).toEqual(["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z"]);
  });

  it("does nothing for a workspace that does not exist", () => {
    expect(() => ensureAllowance("ghost")).not.toThrow();
    expect(db.select().from(creditGrants).all()).toHaveLength(0);
  });
});

describe("per-grant accounting", () => {
  it("spends the credit that expires first, so a pack is untouched while the allowance lasts", () => {
    seed({ plan: "developer" });
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 2_000, expiresAt: "2027-10-09T00:00:00.000Z", paymentEventId: "stripe:pi_1" });
    ensureAllowance("ws1");
    spend(3);
    const byId = Object.fromEntries(db.select().from(creditGrants).all().map((g) => [g.source, g.consumed]));
    expect(byId).toEqual({ pack: 0, plan_cycle: 3 });
  });

  it("expiring a fully spent allowance leaves an untouched pack alone (the pooled-balance bug)", () => {
    seed({ plan: "developer" });
    ensureAllowance("ws1", new Date("2026-10-09T12:00:00Z"));
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 2_000, expiresAt: "2099-01-01T00:00:00.000Z", paymentEventId: "stripe:pi_1" });
    spend(5_000);
    expect(balanceOf("ws1")).toBe(2_000);
    expireGrants(new Date("2026-11-02T00:00:00Z"));
    expect(balanceOf("ws1")).toBe(2_000);
  });

  it("refunding one of two packs takes back only that pack's unspent credit", () => {
    seed();
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 1_000, expiresAt: "2027-01-01T00:00:00.000Z", paymentEventId: "stripe:pa" });
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 1_000, expiresAt: "2028-01-01T00:00:00.000Z", paymentEventId: "stripe:pb" });
    spend(1_000); // drains pack A, which expires first
    const result = reverseGrant("stripe:pa", "refund");
    expect(result).toEqual({ reversed: true, clawedBack: 0, shortfall: 1_000 });
    expect(balanceOf("ws1")).toBe(1_000);
  });

  it("a refunded render gives its unit back to the grant it came from", () => {
    seed({ plan: "developer" });
    ensureAllowance("ws1");
    const r = reserve({ workspaceId: "ws1", requestId: "x", units: 1 });
    expect(refund(r.id, "failed")).toBe(true);
    expect(db.select().from(creditGrants).get()?.consumed).toBe(0);
    expect(balanceOf("ws1")).toBe(5_000);
  });
});
