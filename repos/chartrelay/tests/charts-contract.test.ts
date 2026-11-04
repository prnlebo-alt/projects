import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests fix the balance by hand, so the monthly allowance is switched off here. tests/allowance.test.ts covers it.
vi.mock("@/lib/ledger/allowance", () => ({ ensureAllowance: () => {} }));
import type { ChartSpec } from "@/lib/charts/schema";

// The contract the API advertises: a chart that violates a documented rule is refused, not stored and
// silently repaired. Codex's audit found the opposite — a negative pie slice was accepted with 201, drawn
// as 0% and given a permanent public URL — and an agent that reads HTTP success as "publishable" shipped it.
vi.mock("@/lib/auth/session", () => ({ currentAccount: vi.fn(async () => null) }));

const { db } = await import("@/lib/db");
const { grantCredit, balanceOf } = await import("@/lib/ledger/ledger");
const { apiKeys, balances, rateLimits, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const { storeApiKey } = await import("@/lib/auth/api-keys");
const { sampleSpec } = await import("@/lib/charts/schema");
const { analyzeChart } = await import("@/lib/charts/qa");
const { renderChart } = await import("@/lib/charts/render");
const charts = await import("@/app/api/v1/charts/route");
const demo = await import("@/app/api/demo/render/route");

type Finding = { severity: string; code: string; message: string; suggestion: string; blocksPublish?: boolean };

const negativePie: ChartSpec = { ...sampleSpec, type: "pie", title: "Net change by region", series: [{ name: "Net change", data: [{ label: "North", value: 40 }, { label: "South", value: -10 }] }] };
const multiSeriesPie: ChartSpec = { ...sampleSpec, type: "pie", title: "Share by quarter", series: [{ name: "Q1", data: [{ label: "A", value: 3 }, { label: "B", value: 2 }] }, { name: "Q2", data: [{ label: "A", value: 4 }, { label: "B", value: 1 }] }] };

let apiKey = "";

beforeEach(() => {
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

const post = (body: string) => charts.POST(new Request("http://localhost:3000/api/v1/charts", { method: "POST", body, headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" } }));
const send = (payload: unknown) => post(JSON.stringify(payload));
const check = (payload: unknown, ip = "198.51.100.7") => demo.POST(new Request("http://localhost:3000/api/demo/render", { method: "POST", body: JSON.stringify(payload), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));
/**
 * What a rejected request left behind.
 *
 * `usage` counts only rows that were actually *charged*. A refused render still writes a usage row —
 * it is reserved, then refunded — and that row is the evidence the refund happened. Counting every
 * row would make a correct refund look like a charge, which is the opposite of what these tests are
 * checking.
 */
const stored = () => ({
  charts: db.select().from(renders).all().length,
  usage: db.select().from(usageEvents).all().filter((row) => row.status === "charged").length,
});

describe("QA enforcement on POST /api/v1/charts", () => {
  it("refuses a negative pie value with 422 and stores nothing", async () => {
    const response = await send(negativePie);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("quality-rejected");
    // The finding an agent has to act on arrives whole: code, message and the fix, not just a status.
    const blocking = body.blocking as Finding[];
    expect(blocking.map((issue) => issue.code)).toEqual(["pie-negative-value"]);
    expect(blocking[0]).toMatchObject({ severity: "error", message: expect.stringContaining("negative"), suggestion: expect.stringContaining("bar chart") });
    expect(body.override).toMatchObject({ field: "allowQualityErrors", value: true });
    expect(stored()).toEqual({ charts: 0, usage: 0 });
    // No public URL is invented for a chart that was never stored.
    expect(JSON.stringify(body)).not.toContain("/api/v1/charts/");
    expect(db.select({ lastUsedAt: apiKeys.lastUsedAt }).from(apiKeys).all().map((row) => row.lastUsedAt)).toEqual([null]);
  });

  it("refuses a pie with several series, listing every blocking finding", async () => {
    const response = await send(multiSeriesPie);
    expect(response.status).toBe(422);
    const body = await response.json();
    expect((body.blocking as Finding[]).map((issue) => issue.code)).toContain("pie-multiple-series");
    expect(stored()).toEqual({ charts: 0, usage: 0 });
  });

  it("does not consume credit for rejected charts", async () => {
    const before = balanceOf("ws1");
    for (let i = 0; i < 3; i++) expect((await send(negativePie)).status).toBe(422);
    expect(stored()).toEqual({ charts: 0, usage: 0 });
    // Three refusals cost nothing at all — the reservations were given back, not kept.
    expect(balanceOf("ws1")).toBe(before);
    // The first chart that passes is the first one actually paid for.
    const ok = await send(sampleSpec);
    expect(ok.status).toBe(201);
    expect((await ok.json()).credits_remaining).toBe(before - 1);
    expect(balanceOf("ws1")).toBe(before - 1);
  });

  it("reports exhausted credit before QA, and writes nothing either way", async () => {
    // Credit is checked before the spec is even looked at, so a caller with none is told the real
    // reason rather than being sent away with a validation complaint they cannot act on.
    db.delete(balances).run();
    const response = await send(negativePie);
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe("credits_exhausted");
    expect(db.select().from(renders).all()).toHaveLength(0);
  });

  it("keeps warnings and tips advisory", async () => {
    // An untitled chart is a warning, not a contract violation: it renders, it is stored, the finding rides along.
    const response = await send({ ...sampleSpec, title: "" });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect((body.warnings as Finding[]).map((issue) => issue.code)).toContain("missing-title");
    expect(stored()).toEqual({ charts: 1, usage: 1 });
  });

  it("stores the chart when the caller explicitly allows quality errors", async () => {
    const response = await send({ ...negativePie, allowQualityErrors: true });
    expect(response.status).toBe(201);
    const body = await response.json();
    // The findings are not suppressed — only the refusal is.
    expect((body.warnings as Finding[]).some((issue) => issue.code === "pie-negative-value" && issue.severity === "error")).toBe(true);
    expect(stored()).toEqual({ charts: 1, usage: 1 });
    // The option travels with the request, not with the chart: the stored spec is the chart alone.
    const spec = JSON.parse(db.select({ spec: renders.spec }).from(renders).all()[0].spec);
    expect(spec).not.toHaveProperty("allowQualityErrors");
    // Opting in is per request; the next one is enforced again.
    expect((await send(negativePie)).status).toBe(422);
  });

  it("rejects a non-boolean allowQualityErrors instead of ignoring it", async () => {
    const response = await send({ ...negativePie, allowQualityErrors: "yes" });
    expect(response.status).toBe(400);
    expect((await response.json()).details.issues.map((issue: { path: string }) => issue.path)).toContain("allowQualityErrors");
    expect(stored()).toEqual({ charts: 0, usage: 0 });
  });
});

describe("malformed request bodies", () => {
  it("says the body could not be parsed, rather than blaming a null field", async () => {
    const response = await post('{"type":"bar",');
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/could not be parsed as JSON/);
    expect(body.details.reason).toBeTruthy();
    // The old answer was "expected object, received null", which describes our own fallback, not the request.
    expect(JSON.stringify(body)).not.toContain("received null");
    expect(body.details.issues).toBeUndefined();
  });

  it("reports an empty body as unparseable, not as a missing field", async () => {
    const response = await post("");
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/could not be parsed as JSON/);
  });

  it("keeps field paths for a body that parses but fails validation", async () => {
    const response = await send({ type: "donut", series: [] });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid chart specification.");
    expect(body.details.issues.map((issue: { path: string }) => issue.path)).toEqual(expect.arrayContaining(["type", "series"]));
  });
});

describe("POST /api/demo/render", () => {
  it("renders a chart the API would refuse, and says so", async () => {
    const response = await check(negativePie);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.svg).toContain("<svg");
    const findings = body.warnings as Finding[];
    expect(findings.find((issue) => issue.code === "pie-negative-value")?.blocksPublish).toBe(true);
    expect(body.enforcement).toMatchObject({ enforced: false, wouldReject: true, blocking: ["pie-negative-value"] });
    expect(body.enforcement.note).toMatch(/422/);
    // The checker is a preview: it stores nothing and meters nothing.
    expect(stored()).toEqual({ charts: 0, usage: 0 });
  });

  it("marks a publishable chart as publishable", async () => {
    const body = await (await check({ ...sampleSpec, title: "" }, "198.51.100.8")).json();
    expect((body.warnings as Finding[]).every((issue) => issue.blocksPublish === false)).toBe(true);
    expect(body.enforcement).toMatchObject({ wouldReject: false, blocking: [] });
  });
});

describe("alt text for degenerate series", () => {
  it("describes a single point as a single point", () => {
    const { altText } = renderChart({ ...sampleSpec, title: "Signups", series: [{ name: "Signups", data: [{ label: "Sep", value: 42 }] }] });
    // Codex saw one point described as both the peak and the bottom, having "increased 0.0%".
    expect(altText).toBe("Signups. Signups has a single data point: 42 for Sep.");
    expect(altText).not.toMatch(/peaks|bottoms|increased|decreased/);
  });

  it("describes identical values as flat, not as a peak", () => {
    const { altText } = renderChart({ ...sampleSpec, title: "Seats", series: [{ name: "Seats", data: [{ label: "Jul", value: 7 }, { label: "Aug", value: 7 }, { label: "Sep", value: 7 }] }] });
    expect(altText).toBe("Seats. Seats stays flat at 7 across all 3 points.");
  });

  it("flags a one-point chart as a tip, and does not call it healthy", () => {
    const codes = analyzeChart({ ...sampleSpec, series: [{ name: "Signups", data: [{ label: "Sep", value: 42 }] }] }).map((issue) => issue.code);
    expect(codes).toContain("single-point");
    expect(codes).not.toContain("healthy");
  });
});
