import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));

const session = vi.hoisted(() => ({ currentAccount: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: session.currentAccount }));

const { db } = await import("@/lib/db");
const { apiKeys, balances, creditGrants, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { grantCredit, balanceOf } = await import("@/lib/ledger/ledger");
const charts = await import("@/app/api/v1/charts/route");
const { clearRateLimit } = await import("@/lib/security/rate-limit");

const WS = "ws-render";
const SPEC = { type: "bar", title: "T", series: [{ name: "S", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }] };

const post = (body: unknown, headers: Record<string, string> = {}) =>
  charts.POST(new Request("http://localhost:3000/api/v1/charts", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  for (const table of [usageEvents, creditGrants, balances, renders, apiKeys, workspaces, users]) db.delete(table).run();
  const at = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "a@example.com", passwordHash: "x", name: "T", emailVerifiedAt: at, createdAt: at }).run();
  db.insert(workspaces).values({ id: WS, ownerId: "u1", name: "W", plan: "developer", createdAt: at }).run();
  session.currentAccount.mockResolvedValue({
    workspace: db.select().from(workspaces).all()[0],
    user: db.select().from(users).all()[0],
  });
  for (const scope of ["render-key:session", `render-account:${WS}`]) clearRateLimit(scope);
});

describe("a render spends exactly one credit", () => {
  it("renders and reports the balance it left behind", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    const response = await post(SPEC);
    expect(response.status).toBe(201);
    expect(response.headers.get("x-chartrelay-credits-remaining")).toBe("4");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(balanceOf(WS)).toBe(4);
  });

  it("refuses with 402 and the full error contract when credit runs out", async () => {
    // The whole point of the prepaid model: when the money is gone the work stops, and the response
    // tells the caller's human where to buy more.
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 1 });
    expect((await post(SPEC)).status).toBe(201);
    const response = await post(SPEC);
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error.code).toBe("credits_exhausted");
    expect(body.error.type).toBe("billing_error");
    expect(body.error.top_up_url).toContain("/dashboard/billing");
    expect(body.error.doc_url).toContain("credits_exhausted");
    expect(body.request_id).toBeTruthy();
    expect(response.headers.get("x-chartrelay-credits-remaining")).toBe("0");
  });

  it("refuses an account that has never had credit", async () => {
    expect((await post(SPEC)).status).toBe(402);
  });
});

describe("work that was never done is never charged", () => {
  it("gives the credit back when the spec is rejected by QA", async () => {
    // A pie with several series breaks its own documented rules, so nothing is stored. Charging for
    // a chart that does not exist is the failure a customer forgives least.
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    const bad = { type: "pie", title: "T", series: [{ name: "A", data: [{ label: "a", value: 1 }] }, { name: "B", data: [{ label: "b", value: 2 }] }] };
    const response = await post(bad);
    expect(response.status).toBe(422);
    expect(balanceOf(WS)).toBe(5);
  });

  it("leaves no reserved row behind after a refusal", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    const bad = { type: "pie", title: "T", series: [{ name: "A", data: [{ label: "a", value: 1 }] }, { name: "B", data: [{ label: "b", value: 2 }] }] };
    await post(bad);
    expect(db.select().from(usageEvents).all().filter((row) => row.status === "reserved")).toHaveLength(0);
  });

  it("does not reserve anything for a spec that fails validation", async () => {
    // Validation happens before the ledger is touched, so a malformed request costs nothing at all.
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    expect((await post({ type: "nonsense" })).status).toBe(400);
    expect(balanceOf(WS)).toBe(5);
    expect(db.select().from(usageEvents).all()).toHaveLength(0);
  });
});

describe("credit is taken before the work, not after", () => {
  it("does not render at all once credit is gone", async () => {
    // The audit found the render ran first and the quota was checked second, so an exhausted account
    // could burn unbounded CPU on every request. A 402 must cost no rendering.
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 1 });
    await post(SPEC);
    const style = await import("@/lib/charts/style");
    const spy = vi.spyOn(style, "renderStyled");
    const response = await post(SPEC);
    expect(response.status).toBe(402);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("a retry after a timeout", () => {
  it("returns the first answer and spends nothing more", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    const first = await post(SPEC, { "idempotency-key": "idem-1" });
    expect(first.status).toBe(201);
    expect(balanceOf(WS)).toBe(4);
    const retry = await post(SPEC, { "idempotency-key": "idem-1" });
    expect(retry.status).toBe(200);
    expect((await retry.json()).replayed).toBe(true);
    expect(balanceOf(WS)).toBe(4);
  });

  it("treats a different idempotency key as a different request", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 5 });
    await post(SPEC, { "idempotency-key": "a" });
    await post(SPEC, { "idempotency-key": "b" });
    expect(balanceOf(WS)).toBe(3);
  });
});

describe("rate limits this route never had", () => {
  it("refuses a key that floods it, with Retry-After and RateLimit headers", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 1_000 });
    let limited: Response | null = null;
    for (let i = 0; i < 130 && !limited; i++) {
      const response = await post(SPEC);
      if (response.status === 429) limited = response;
    }
    expect(limited).not.toBeNull();
    const body = await limited!.json();
    expect(body.error.code).toBe("rate_limited");
    expect(limited!.headers.get("retry-after")).toBeTruthy();
    expect(limited!.headers.get("ratelimit-limit")).toBe("120");
  });

  it("does not charge for a request it rate-limited", async () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 1_000 });
    let limited = false;
    for (let i = 0; i < 130 && !limited; i++) limited = (await post(SPEC)).status === 429;
    const spentOnRenders = db.select().from(usageEvents).all().filter((row) => row.status === "charged").length;
    expect(1_000 - balanceOf(WS)).toBe(spentOnRenders);
  });
});
