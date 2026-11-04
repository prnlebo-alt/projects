import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));

// Stripe is mocked at the client the provider really calls, so no test reaches the network.
const stripeMock = vi.hoisted(() => ({
  customers: { create: vi.fn(async () => ({ id: "cus_new" })) },
  checkout: { sessions: { create: vi.fn(async (_params: unknown) => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" })) } },
}));
vi.mock("@/lib/billing/stripe", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/billing/stripe")>()), stripeClient: vi.fn(() => stripeMock) }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { db } = await import("@/lib/db");
const { grantCredit, balanceOf } = await import("@/lib/ledger/ledger");
const { balances, rateLimits, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const usage = await import("@/app/api/v1/usage/route");
const estimate = await import("@/app/api/v1/estimate/route");
const topUp = await import("@/app/api/v1/top-up-link/route");
const charts = await import("@/app/api/v1/charts/route");

let renderKey = "";
let readKey = "";

const get = (path: string, key: string | null) => new Request(`http://localhost:3000${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
const post = (path: string, key: string, body: unknown) => new Request(`http://localhost:3000${path}`, { method: "POST", body: JSON.stringify(body), headers: { authorization: `Bearer ${key}`, "content-type": "application/json" } });

beforeEach(() => {
  db.delete(users).run();
  db.delete(rateLimits).run();
  db.delete(balances).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner", passwordHash: "x", emailVerifiedAt: now, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "W", createdAt: now }).run();
  grantCredit({ workspaceId: "ws1", source: "plan_cycle", renders: 100 });
  renderKey = storeApiKey("ws1", "Render only").value;
  readKey = storeApiKey("ws1", "Reader", { scopes: ["usage:read"] }).value;
});

describe("GET /api/v1/usage", () => {
  it("requires a key", async () => {
    const response = await usage.GET(get("/api/v1/usage", null));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("invalid_api_key");
  });

  it("refuses a key without the usage:read scope", async () => {
    const response = await usage.GET(get("/api/v1/usage", renderKey));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("scope_denied");
  });

  it("returns the balance and spend for the caller's own workspace only", async () => {
    db.insert(workspaces).values({ id: "ws2", ownerId: "u1", name: "Other", createdAt: new Date().toISOString() }).run();
    const at = new Date().toISOString();
    db.insert(usageEvents).values({ id: "e1", workspaceId: "ws1", kind: "render", units: 2, status: "charged", format: "editorial", createdAt: at }).run();
    db.insert(usageEvents).values({ id: "e2", workspaceId: "ws2", kind: "render", units: 9, status: "charged", createdAt: at }).run();
    const response = await usage.GET(get("/api/v1/usage", readKey));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id") ?? response.headers.get("request-id")).toBeTruthy();
    const body = await response.json();
    expect(body).toMatchObject({ credits_remaining: 100, total: 2, by_format: [{ format: "editorial", renders: 2 }] });
    expect(body.by_day).toHaveLength(30);
    expect(body.credit).toEqual([{ source: "plan_cycle", renders: 100, expires_at: null }]);
  });
});

describe("POST /api/v1/estimate", () => {
  it("says one render costs one unit and does not spend it", async () => {
    const response = await estimate.POST(post("/api/v1/estimate", renderKey, sampleSpec));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ units: 1, billable: true, credits_remaining: 100, can_afford: true });
    expect(balanceOf("ws1")).toBe(100);
  });

  it("says no when the balance is empty", async () => {
    db.delete(balances).run();
    const body = await (await estimate.POST(post("/api/v1/estimate", renderKey, sampleSpec))).json();
    expect(body).toMatchObject({ credits_remaining: 0, can_afford: false });
  });

  it("rejects an invalid spec with the contract's code", async () => {
    const response = await estimate.POST(post("/api/v1/estimate", renderKey, { type: "nope" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_chart_spec");
  });

  it("requires the render scope", async () => {
    expect((await estimate.POST(post("/api/v1/estimate", readKey, sampleSpec))).status).toBe(403);
  });

  it("agrees with what the render route then charges", async () => {
    await charts.POST(post("/api/v1/charts", renderKey, sampleSpec));
    expect(balanceOf("ws1")).toBe(99);
  });
});

describe("GET /api/v1/top-up-link", () => {
  it("returns a URL the human can open, and moves no credit", async () => {
    const response = await topUp.GET(get("/api/v1/top-up-link", readKey));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ kind: "checkout", url: "https://checkout.stripe.com/c/pay/cs_1" });
    expect(stripeMock.checkout.sessions.create.mock.calls[0]?.[0]).toMatchObject({ mode: "payment", metadata: { workspaceId: "ws1", kind: "pack" } });
    expect(balanceOf("ws1")).toBe(100);
  });

  it("falls back to the top-up page when packs are not configured", async () => {
    vi.stubEnv("STRIPE_PRICE_PACK", "");
    const body = await (await topUp.GET(get("/api/v1/top-up-link", readKey))).json();
    expect(body).toMatchObject({ kind: "page" });
    expect(body.url).toContain("/dashboard/billing");
    vi.unstubAllEnvs();
  });

  it("requires usage:read", async () => {
    expect((await topUp.GET(get("/api/v1/top-up-link", renderKey))).status).toBe(403);
  });
});

describe("GET /c/{id}.{png|svg}", () => {
  it("serves the chart the render route stored, in either format", async () => {
    const created = await (await charts.POST(post("/api/v1/charts", renderKey, sampleSpec))).json();
    const short = await import("@/app/c/[file]/route");
    const call = (file: string) => short.GET(new Request(`http://localhost:3000/c/${file}`), { params: Promise.resolve({ file }) });
    const svg = await call(`${created.id}.svg`);
    expect(svg.status).toBe(200);
    expect(svg.headers.get("content-type")).toContain("image/svg+xml");
    const png = await call(`${created.id}.png`);
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toBe("image/png");
    expect((await call(`${created.id}`)).status).toBe(200);
  });

  it("404s on an unknown id or a malformed name, without touching the filesystem or the API path", async () => {
    const short = await import("@/app/c/[file]/route");
    const call = (file: string) => short.GET(new Request("http://localhost:3000/c/x"), { params: Promise.resolve({ file }) });
    expect((await call("nope.png")).status).toBe(404);
    expect((await call("..%2F..%2Fsecret.png")).status).toBe(404);
    expect((await call("a.exe")).status).toBe(404);
  });
});

describe("what a key may learn", () => {
  it("tells a key about its own spend only, not the workspace's other keys", async () => {
    const at = new Date().toISOString();
    const ids = db.select().from((await import("@/lib/db/schema")).apiKeys).all();
    const mine = ids.find((k) => k.name === "Reader")!;
    const other = ids.find((k) => k.name === "Render only")!;
    db.insert(usageEvents).values({ id: "m1", workspaceId: "ws1", keyId: mine.id, kind: "render", units: 1, status: "charged", createdAt: at }).run();
    db.insert(usageEvents).values({ id: "m2", workspaceId: "ws1", keyId: other.id, kind: "render", units: 4, status: "charged", createdAt: at }).run();
    const body = await (await usage.GET(get("/api/v1/usage", readKey))).json();
    expect(body.by_key).toEqual([{ key_id: mine.id, name: "Reader", renders: 1 }]);
  });
});

describe("top-up link rate limit", () => {
  it("allows a handful an hour, then says to reuse the last link", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await topUp.GET(get("/api/v1/top-up-link", readKey))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429]);
  });
});
