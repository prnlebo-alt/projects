import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));

/**
 * Codex's reproduction, kept and moved onto the ledger.
 *
 * The original bug: a workspace one render below its monthly limit, N requests fired concurrently
 * through the real route handler, every one of them observing the same pre-insert count and all of
 * them admitted. The counter it raced against is gone — renders are prepaid now — so the same race is
 * run against the credit balance, which is the thing that can now be oversold.
 *
 * This exercises the route end to end. tests/ledger-concurrency.test.ts races the reserve statement
 * itself across real OS threads, which is the part a single-threaded caller cannot prove.
 */
vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { db } = await import("@/lib/db");
const { renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { clearRateLimit } = await import("@/lib/security/rate-limit");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const { balanceOf, grantCredit } = await import("@/lib/ledger/ledger");
const charts = await import("@/app/api/v1/charts/route");

let apiKey = "";

beforeEach(() => {
  db.delete(users).run(); // cascades to workspaces, api keys, renders and usage events
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner", passwordHash: "x", emailVerifiedAt: null, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "Owner's workspace", plan: "free", createdAt: now }).run();
  apiKey = storeApiKey("ws1").value;
  // The per-key and per-account ceilings would otherwise refuse the tail of a 40-request burst for a
  // reason this test is not about.
  for (const scope of ["render-key", "render-account"]) for (const id of [db.select().from(workspaces).all()[0].id, "session"]) clearRateLimit(`${scope}:${id}`);
});

/** Credit the race is run against. */
const fund = (renders: number) => grantCredit({ workspaceId: "ws1", source: "plan_cycle", renders });

/** Units actually charged — a refunded row is evidence of a refusal, not of a sale. */
const chargedRenders = () =>
  db.select().from(usageEvents).all().filter((row) => row.workspaceId === "ws1" && row.status === "charged").length;

const post = () => new Request("http://localhost:3000/api/v1/charts", { method: "POST", body: JSON.stringify(sampleSpec), headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" } });
const fire = (n: number) => Promise.all(Array.from({ length: n }, () => charts.POST(post())));

describe("prepaid credit under concurrency", () => {
  it("admits exactly one of 20 concurrent requests when one credit remains", async () => {
    fund(1);
    const responses = await fire(20);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 402)).toHaveLength(19);
    expect(chargedRenders()).toBe(1);
    expect(balanceOf("ws1")).toBe(0);
  });

  it("never sells more renders than were paid for when 40 requests race for 10", async () => {
    fund(10);
    const responses = await fire(40);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(10);
    expect(chargedRenders()).toBe(10);
    expect(balanceOf("ws1")).toBe(0);
    expect(db.select().from(renders).all()).toHaveLength(10);
  });

  it("keeps the refusal shape unchanged in a race", async () => {
    // Under contention the body must still be the documented error contract, not a bare string: an
    // agent branches on `code`, and a race is exactly when it most needs to.
    fund(1);
    const responses = await fire(10);
    const refused = responses.find((response) => response.status === 402)!;
    const body = await refused.json();
    expect(body.error.code).toBe("credits_exhausted");
    expect(body.error.top_up_url).toBeTruthy();
    expect(body.request_id).toBeTruthy();
  });

  it("charges nothing at all when there was never any credit", async () => {
    const responses = await fire(20);
    expect(responses.every((response) => response.status === 402)).toBe(true);
    expect(chargedRenders()).toBe(0);
    expect(db.select().from(renders).all()).toHaveLength(0);
  });
});
