import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));

// Counts real sharp calls, and lets a test make the renderer or the usage insert fail, without changing either implementation.
const probes = vi.hoisted(() => ({ sharpCalls: 0, renderFails: false, usageInsertFails: false, fixedId: null as string | null }));
// nanoid is mocked so a test can make the render insert collide with a row that already exists, which
// is a real failure inside the transaction rather than a mock of something the route never calls.
vi.mock("nanoid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nanoid")>();
  return { ...actual, nanoid: (size?: number) => probes.fixedId ?? actual.nanoid(size) };
});
vi.mock("sharp", async (importOriginal) => {
  type Sharp = typeof import("sharp").default;
  const actual = (await importOriginal<{ default: Sharp }>()).default;
  const counted = ((...args: Parameters<Sharp>) => { probes.sharpCalls++; return actual(...args); }) as Sharp;
  return { default: counted };
});
// The route renders through the style chooser, so that is where a failing renderer has to be injected —
// mocking renderChart would miss the editorial path entirely and the test would pass while proving nothing.
vi.mock("@/lib/charts/style", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/charts/style")>();
  return { ...actual, renderStyled: (...args: Parameters<typeof actual.renderStyled>) => { if (probes.renderFails) throw new Error("SQLITE_FULL: database or disk is full"); return actual.renderStyled(...args); } };
});
// Fails the usage insert only — the last write in the route's transaction, after the render row and the key
// timestamp have already been written. Anything that survives is a write the transaction failed to roll back.
vi.mock("@/lib/usage/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage/limits")>();
  return { ...actual };
});
vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { eq } = await import("drizzle-orm");
const { db } = await import("@/lib/db");
const { grantCredit, balanceOf } = await import("@/lib/ledger/ledger");
const { apiKeys, balances, renders, usageEvents, users, workspaces, rateLimits } = await import("@/lib/db/schema");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const charts = await import("@/app/api/v1/charts/route");
const asset = await import("@/app/api/v1/charts/[id]/route");
const demo = await import("@/app/api/demo/render/route");

let apiKey = "";

beforeEach(() => {
  probes.sharpCalls = 0;
  probes.renderFails = false;
  probes.fixedId = null;
  db.delete(users).run();
  db.delete(rateLimits).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner", passwordHash: "x", emailVerifiedAt: now, createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws1", ownerId: "u1", name: "Owner's workspace", createdAt: now }).run();
  // Renders are prepaid now: a workspace with no credit cannot render at all, so these fixtures grant
  // enough that the thing each test is actually about is what decides the outcome.
  grantCredit({ workspaceId: "ws1", source: "plan_cycle", renders: 10_000 });
  apiKey = storeApiKey("ws1").value;
});

const post = (body: string, headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/v1/charts", { method: "POST", body, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", ...headers } });
const get = (id: string, query: string) => asset.GET(new Request(`http://localhost:3000/api/v1/charts/${id}?${query}`), { params: Promise.resolve({ id }) });

async function createChart() {
  const response = await charts.POST(post(JSON.stringify(sampleSpec)));
  expect(response.status).toBe(201);
  return (await response.json()).id as string;
}

describe("POST /api/v1/charts", () => {
  it("records the render and the credit it spent together", async () => {
    await createChart();
    expect(db.select().from(renders).all()).toHaveLength(1);
    expect(db.select().from(usageEvents).all().map((row) => row.status)).toEqual(["charged"]);
    expect(balanceOf("ws1")).toBe(9_999);
  });

  it("returns a generic 500, not 429, when rendering fails, and records nothing", async () => {
    probes.renderFails = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await charts.POST(post(JSON.stringify(sampleSpec)));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("SQLITE");
    expect(error).toHaveBeenCalled();
    expect(db.select().from(renders).all()).toHaveLength(0);
    // The reservation is not erased, it is refunded — the row is the evidence the credit came back,
    // and the balance is what proves the customer did not pay for a render that never happened.
    expect(db.select().from(usageEvents).all().map((row) => row.status)).toEqual(["refunded"]);
    expect(balanceOf("ws1")).toBe(10_000);
  });

  it("rolls the render back when the chart row cannot be written", async () => {
    // A primary-key collision on the render insert: the first write in the transaction succeeds for
    // the key timestamp, and this one fails, so the whole thing must roll back.
    probes.fixedId = "collide-with-me";
    db.insert(renders).values({ id: "collide-with-me", workspaceId: "ws1", apiKeyId: null, spec: "{}", svg: "<svg/>", altText: "", warnings: "[]", createdAt: new Date().toISOString() }).run();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await charts.POST(post(JSON.stringify(sampleSpec)));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("SQLITE");
    expect(error).toHaveBeenCalled();
    // Only the row the test planted survives; the request's own writes are all gone and the credit
    // is back where it started.
    expect(db.select().from(renders).all().map((row) => row.id)).toEqual(["collide-with-me"]);
    expect(balanceOf("ws1")).toBe(10_000);
    expect(db.select({ lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).all().map((row) => row.lastUsedAt)).toEqual([null]);
    // A later request still works: the failed transaction left no lock or half-open state behind.
    probes.fixedId = null;
    await createChart();
    expect(db.select().from(renders).all()).toHaveLength(2);
    // Two attempts, two rows: the one that failed was refunded, the one that worked was charged.
    expect(db.select().from(usageEvents).all().map((row) => row.status).sort()).toEqual(["charged", "refunded"]);
    expect(balanceOf("ws1")).toBe(9_999);
  });

  it("returns 402 when the credit is gone, naming where to buy more", async () => {
    // This used to be a 429 against a monthly counter. Renders are prepaid now, so running out is a
    // billing answer rather than a rate-limiting one, and the body carries the link the caller's
    // human needs — an agent cannot buy credit for itself.
    db.delete(balances).run();
    const response = await charts.POST(post(JSON.stringify(sampleSpec)));
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.error.code).toBe("credits_exhausted");
    expect(body.error.top_up_url).toContain("/dashboard/billing");
    expect(db.select().from(renders).all()).toHaveLength(0);
  });

  it("refuses oversized bodies with 413 before parsing them", async () => {
    expect((await charts.POST(post("x".repeat(5 * 1024 * 1024)))).status).toBe(413);
    // Without a Content-Length header (chunked upload), reading stops at the cap.
    const stream = new ReadableStream({ start(controller) { for (let i = 0; i < 20; i++) controller.enqueue(new TextEncoder().encode("x".repeat(256 * 1024))); controller.close(); } });
    const chunked = new Request("http://localhost:3000/api/v1/charts", { method: "POST", body: stream, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, duplex: "half" } as RequestInit);
    expect((await charts.POST(chunked)).status).toBe(413);
  });

  it("returns validation issues with field paths", async () => {
    const response = await charts.POST(post(JSON.stringify({ type: "donut", series: [] })));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.details.issues.map((issue: { path: string }) => issue.path)).toEqual(expect.arrayContaining(["type", "series"]));
  });
});

describe("GET /api/v1/charts/:id", () => {
  it("rasterizes a PNG once, then serves the stored copy", async () => {
    const id = await createChart();
    const responses = await Promise.all(Array.from({ length: 8 }, () => get(id, "format=png")));
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
    }
    expect((await get(id, "format=png")).status).toBe(200);
    expect(probes.sharpCalls).toBe(1);
    expect(db.select({ png: renders.png }).from(renders).where(eq(renders.id, id)).get()?.png?.length).toBeGreaterThan(100);
  });

  it("rejects cache-busting query parameters", async () => {
    const id = await createChart();
    expect((await get(id, "format=png&n=1")).status).toBe(400);
    expect(probes.sharpCalls).toBe(0);
  });

  it("serves SVG with a sandboxing content security policy", async () => {
    const id = await createChart();
    const response = await get(id, "format=svg");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(await response.text()).toContain("<svg");
  });

  it("returns a controlled 500 when rasterization fails", async () => {
    const id = await createChart();
    const broken = `<svg xmlns="http://www.w3.org/2000/svg"><text>${String.fromCharCode(1)}</text></svg>`;
    db.update(renders).set({ svg: broken }).where(eq(renders.id, id)).run();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await get(id, "format=png");
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/SVG URL/);
  });
});

describe("POST /api/demo/render", () => {
  const demoRequest = (body: string, xff = "203.0.113.20") => new Request("http://localhost:3000/api/demo/render", { method: "POST", body, headers: { "content-type": "application/json", "x-forwarded-for": xff } });

  it("refuses oversized bodies with 413", async () => {
    expect((await demo.POST(demoRequest("x".repeat(5 * 1024 * 1024)))).status).toBe(413);
  });

  it("limits by the proxy-appended address, not a spoofed leftmost one", async () => {
    const body = JSON.stringify(sampleSpec);
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await demo.POST(demoRequest(body, `10.0.0.${i}, 203.0.113.21`))).status);
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});

describe("what a retry returns, and what is marked", () => {
  const withKey = (key: string, headers: Record<string, string> = {}) => post(JSON.stringify(sampleSpec), { "idempotency-key": key, ...headers });

  it("returns the chart that request made, not the latest chart in the workspace", async () => {
    const first = await (await charts.POST(withKey("same"))).json();
    await charts.POST(post(JSON.stringify({ ...sampleSpec, title: "A later, different chart" })));
    const retry = await charts.POST(withKey("same"));
    expect(retry.status).toBe(200);
    expect((await retry.json()).id).toBe(first.id);
  });

  it("charges for the first attempt only", async () => {
    const before = balanceOf("ws1");
    await charts.POST(withKey("once"));
    await charts.POST(withKey("once"));
    expect(balanceOf("ws1")).toBe(before - 1);
  });

  it("treats a retry after a failed attempt as a fresh request, and renders it", async () => {
    probes.renderFails = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await charts.POST(withKey("retry-me"))).status).toBe(500);
    probes.renderFails = false;
    const retried = await charts.POST(withKey("retry-me"));
    expect(retried.status).toBe(201);
  });

  it("says a duplicate is still in progress rather than rendering twice", async () => {
    db.insert(usageEvents).values({ id: "inflight", workspaceId: "ws1", keyId: null, kind: "render", units: 1, status: "reserved", idempotencyKey: "busy", idempotencyScope: (db.select().from(apiKeys).get()!).id, createdAt: new Date().toISOString() }).run();
    const response = await charts.POST(withKey("busy"));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("request_in_progress");
  });

  const svgOf = async (response: Response) => (await response.json()).svg as string;

  it("marks a free workspace's chart, and does not mark a paid one", async () => {
    expect(await svgOf(await charts.POST(post(JSON.stringify(sampleSpec))))).toContain("chartrelay.dev");
    db.update(workspaces).set({ plan: "developer" }).where(eq(workspaces.id, "ws1")).run();
    expect(await svgOf(await charts.POST(post(JSON.stringify(sampleSpec))))).not.toContain("chartrelay.dev</text>");
  });

  it("removes the mark from a free workspace while it holds unspent pack credit", async () => {
    grantCredit({ workspaceId: "ws1", source: "pack", renders: 5, expiresAt: "2099-01-01T00:00:00.000Z", paymentEventId: "stripe:pi_mark" });
    expect(await svgOf(await charts.POST(post(JSON.stringify(sampleSpec))))).not.toContain("chartrelay.dev</text>");
  });

  it("always marks a test key's chart, whatever the workspace has paid for", async () => {
    db.update(workspaces).set({ plan: "business" }).where(eq(workspaces.id, "ws1")).run();
    const testKey = storeApiKey("ws1", "Test", { mode: "test" }).value;
    const response = await charts.POST(new Request("http://localhost:3000/api/v1/charts", { method: "POST", body: JSON.stringify(sampleSpec), headers: { authorization: `Bearer ${testKey}`, "content-type": "application/json" } }));
    expect(await svgOf(response)).toContain("chartrelay.dev</text>");
  });
});
