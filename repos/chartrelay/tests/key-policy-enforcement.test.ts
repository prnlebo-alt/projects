import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));

vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { db } = await import("@/lib/db");
const { apiKeys, balances, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { grantCredit, balanceOf } = await import("@/lib/ledger/ledger");
const { sampleSpec } = await import("@/lib/charts/schema");
const { clearRateLimit } = await import("@/lib/security/rate-limit");
const charts = await import("@/app/api/v1/charts/route");

const post = (key: string, headers: Record<string, string> = {}) =>
  charts.POST(new Request("http://localhost:3000/api/v1/charts", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
    body: JSON.stringify(sampleSpec),
  }));

beforeEach(() => {
  db.delete(users).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "o@example.com", name: "O", passwordHash: "x", emailVerifiedAt: now, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "W", plan: "pro", createdAt: now }).run();
  grantCredit({ workspaceId: "ws1", source: "plan_cycle", renders: 1_000 });
  for (const scope of ["render-key", "render-account"]) for (const id of ["ws1", "session"]) clearRateLimit(`${scope}:${id}`);
});

const body = async (response: Response) => (await response.json()) as { error: { code: string } };

describe("what a key is allowed to do", () => {
  it("refuses a key without the render scope, and charges nothing", async () => {
    const key = storeApiKey("ws1", "readonly", { scopes: ["usage:read"] });
    clearRateLimit(`render-key:${key.id}`);
    const response = await post(key.value);
    expect(response.status).toBe(403);
    expect((await body(response)).error.code).toBe("scope_denied");
    expect(balanceOf("ws1")).toBe(1_000);
  });

  it("allows a key that carries the render scope", async () => {
    const key = storeApiKey("ws1", "renderer", { scopes: ["render"] });
    clearRateLimit(`render-key:${key.id}`);
    expect((await post(key.value)).status).toBe(201);
    expect(balanceOf("ws1")).toBe(999);
  });
});

describe("an IP allowlist", () => {
  it("refuses an address outside it", async () => {
    const key = storeApiKey("ws1", "pinned", { ipAllowlist: ["203.0.113.0/24"] });
    clearRateLimit(`render-key:${key.id}`);
    const response = await post(key.value, { "x-forwarded-for": "198.51.100.7" });
    expect(response.status).toBe(403);
    expect((await body(response)).error.code).toBe("ip_not_allowed");
    expect(balanceOf("ws1")).toBe(1_000);
  });

  it("allows an address inside it", async () => {
    const key = storeApiKey("ws1", "pinned", { ipAllowlist: ["203.0.113.0/24"] });
    clearRateLimit(`render-key:${key.id}`);
    expect((await post(key.value, { "x-forwarded-for": "203.0.113.9" })).status).toBe(201);
  });

  it("leaves a key with no allowlist unrestricted", async () => {
    const key = storeApiKey("ws1", "open");
    clearRateLimit(`render-key:${key.id}`);
    expect((await post(key.value, { "x-forwarded-for": "198.51.100.7" })).status).toBe(201);
  });
});

describe("a per-key monthly budget", () => {
  it("stops that key without touching the workspace's credit", async () => {
    // A separate 402 from credits_exhausted on purpose: the workspace has plenty, and the remedy is
    // to raise this key's budget rather than to buy anything.
    const key = storeApiKey("ws1", "small", { monthlyBudget: 2 });
    clearRateLimit(`render-key:${key.id}`);
    for (let i = 0; i < 2; i++) expect((await post(key.value)).status).toBe(201);
    const response = await post(key.value);
    expect(response.status).toBe(402);
    expect((await body(response)).error.code).toBe("key_budget_exhausted");
    expect(balanceOf("ws1")).toBe(998);
  });

  it("does not limit a different key in the same workspace", async () => {
    const limited = storeApiKey("ws1", "small", { monthlyBudget: 1 });
    const other = storeApiKey("ws1", "other");
    for (const key of [limited, other]) clearRateLimit(`render-key:${key.id}`);
    await post(limited.value);
    expect((await post(limited.value)).status).toBe(402);
    expect((await post(other.value)).status).toBe(201);
  });
});

describe("a test key", () => {
  it("renders without spending anything", async () => {
    // Test keys are free and watermarked so a playground and a customer's own smoke tests cost
    // nobody anything.
    const key = storeApiKey("ws1", "sandbox", { mode: "test" });
    clearRateLimit(`render-key:${key.id}`);
    const response = await post(key.value);
    expect(response.status).toBe(201);
    expect(balanceOf("ws1")).toBe(1_000);
    expect(db.select().from(usageEvents).all()).toHaveLength(0);
  });

  it("still renders when the workspace has no credit at all", async () => {
    db.delete(balances).run();
    const key = storeApiKey("ws1", "sandbox", { mode: "test" });
    clearRateLimit(`render-key:${key.id}`);
    expect((await post(key.value)).status).toBe(201);
  });

  it("is distinguishable from a live key by its prefix", async () => {
    expect(storeApiKey("ws1", "t", { mode: "test" }).value.startsWith("cr_test_")).toBe(true);
    expect(storeApiKey("ws1", "l").value.startsWith("cr_live_")).toBe(true);
  });
});

describe("a revoked or expired key", () => {
  it("is refused outright", async () => {
    const key = storeApiKey("ws1", "gone");
    clearRateLimit(`render-key:${key.id}`);
    db.update(apiKeys).set({ revokedAt: new Date().toISOString() }).run();
    expect((await post(key.value)).status).toBe(401);
  });

  it("stops working after its expiry", async () => {
    const key = storeApiKey("ws1", "temp", { expiresAt: new Date(Date.now() + 60_000).toISOString() });
    clearRateLimit(`render-key:${key.id}`);
    expect((await post(key.value)).status).toBe(201);
    db.update(apiKeys).set({ expiresAt: new Date(Date.now() - 1_000).toISOString() }).run();
    expect((await post(key.value)).status).toBe(401);
  });
});
