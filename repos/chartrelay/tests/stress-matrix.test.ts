import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The spec's stress-test table (docs/BILLING_SPEC.md, "Stress test"), one `describe` per row it names, for the rows
 * that no other file pins down. Rows that another file already proves are listed in docs/VERIFIER_REPORT.md with the
 * file that does, so a reader can find all eighteen from here without this file repeating them.
 */
const failure = vi.hoisted(() => ({ ledgerDown: false }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));
vi.mock("@/lib/ledger/ledger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ledger/ledger")>();
  return { ...actual, reserve: (...args: Parameters<typeof actual.reserve>) => { if (failure.ledgerDown) throw new Error("SQLITE_IOERR: disk I/O error"); return actual.reserve(...args); } };
});

const { db } = await import("@/lib/db");
const { balances, rateLimits, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { balanceOf, expireGrants, grantCredit } = await import("@/lib/ledger/ledger");
const { ensureAllowance } = await import("@/lib/ledger/allowance");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const charts = await import("@/app/api/v1/charts/route");

let key = "";
const render = (body: BodyInit = JSON.stringify(sampleSpec), headers: Record<string, string> = {}) =>
  charts.POST(new Request("http://localhost:3000/api/v1/charts", { method: "POST", body, headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...headers } }));

function seed(options: { plan?: "free" | "developer"; verified?: boolean } = {}) {
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "o@example.com", name: "O", passwordHash: "x", emailVerifiedAt: options.verified === false ? null : now, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "W", plan: options.plan ?? "free", createdAt: now }).run();
  key = storeApiKey("ws1").value;
}

beforeEach(() => {
  failure.ledgerDown = false;
  db.delete(users).run(); db.delete(balances).run(); db.delete(rateLimits).run(); db.delete(usageEvents).run(); db.delete(renders).run();
});

describe("50 MB payload or 10M points → 413 before any credit moves", () => {
  it("refuses a declared-huge body without reading it or spending a unit", async () => {
    seed({ plan: "developer" });
    ensureAllowance("ws1");
    const before = balanceOf("ws1");
    const response = await render("{}", { "content-length": String(50 * 1024 * 1024) });
    expect(response.status).toBe(413);
    expect(balanceOf("ws1")).toBe(before);
    expect(db.select().from(usageEvents).all()).toHaveLength(0);
  });

  it("refuses a body that streams past the limit even when it lies about its length", async () => {
    seed({ plan: "developer" });
    ensureAllowance("ws1");
    const before = balanceOf("ws1");
    const response = await render("x".repeat(6 * 1024 * 1024), { "content-length": "10" });
    expect(response.status).toBe(413);
    expect(balanceOf("ws1")).toBe(before);
  });
});

describe("database down → fail closed: 503 and no free renders", () => {
  it("answers 503 service_unavailable, renders nothing, stores nothing", async () => {
    seed({ plan: "developer" });
    failure.ledgerDown = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await render();
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("service_unavailable");
    expect(response.headers.get("retry-after")).toBe("5");
    expect(db.select().from(renders).all()).toHaveLength(0);
  });
});

describe("1,000 signups from one network → signup cap and email verification stop key use", () => {
  it("an account that never confirmed its email holds a key that cannot render", async () => {
    seed({ verified: false });
    const response = await render();
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe("credits_exhausted");
    expect(balanceOf("ws1")).toBe(0);
  });
});

describe("plan downgrade mid-cycle → effective next cycle", () => {
  it("keeps this month's paid allowance after the plan drops to free, and gives the free figure next month", () => {
    seed({ plan: "developer" });
    const october = new Date("2026-10-09T12:00:00Z");
    ensureAllowance("ws1", october);
    expect(balanceOf("ws1")).toBe(5_000);
    db.update(workspaces).set({ plan: "free" }).run();
    ensureAllowance("ws1", october);
    // Nothing was taken back: the customer paid for the month.
    expect(balanceOf("ws1")).toBeGreaterThanOrEqual(5_000);
    expireGrants(new Date("2026-11-01T00:00:01Z"));
    expect(balanceOf("ws1")).toBe(0);
    ensureAllowance("ws1", new Date("2026-11-02T00:00:00Z"));
    expect(balanceOf("ws1")).toBe(250);
  });
});

describe("pay-as-you-go account hits zero → 402 with top_up_url, nothing charged, no mark removed without credit", () => {
  it("answers 402 with the top-up URL, and the free workspace's chart stays marked until it holds pack credit", async () => {
    seed();
    db.delete(balances).run();
    db.update(users).set({ emailVerifiedAt: null }).run();
    const refused = await render();
    expect(refused.status).toBe(402);
    expect((await refused.json()).error.top_up_url).toContain("/dashboard/billing");
    db.update(users).set({ emailVerifiedAt: new Date().toISOString() }).run();
    const marked = (await (await render()).json()).svg as string;
    expect(marked).toContain("chartrelay.dev</text>");
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 3, expiresAt: "2099-01-01T00:00:00.000Z", paymentEventId: "stripe:pi_x" });
    expect((await (await render()).json()).svg).not.toContain("chartrelay.dev</text>");
  });
});
