import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ currentAccount: vi.fn(), clearSession: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: session.currentAccount, clearSession: session.clearSession }));

const { db } = await import("@/lib/db");
const { apiKeys, rateLimits, renders, usageEvents, users, workspaces } = await import("@/lib/db/schema");
const exportRoute = await import("@/app/api/account/export/route");
const { EXPORT_PAGE_SIZE, MAX_EXPORT_BYTES, collectBounded } = exportRoute;

/**
 * A chart spec near the maximum the API accepts serializes to roughly 126 KB. These rows are larger
 * still, so a handful of them proves the point with a test that runs in well under a second: the
 * defect is that 5,000 rows is a row cap, not a memory cap.
 */
const HUGE_SPEC_BYTES = 1_000_000;
const hugeSpec = (index: number) => JSON.stringify({ type: "bar", title: `Spec ${index}`, filler: "x".repeat(HUGE_SPEC_BYTES) });

function seedAccount() {
  const now = new Date().toISOString();
  db.insert(users).values({ id: "u1", email: "owner@example.com", name: "Owner Person", passwordHash: "x", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_1", ownerId: "u1", name: "Owner workspace", plan: "scale", createdAt: now }).run();
  db.insert(apiKeys).values({ id: "key_1", workspaceId: "ws_1", name: "Production", keyHash: "hash_1", prefix: "crk_live_abc", createdAt: now }).run();
}

/** `count` renders whose stored spec is ~1 MB each, newest first by created_at. */
function seedHugeRenders(count: number) {
  for (let index = 0; index < count; index += 1) {
    db.insert(renders).values({
      id: `rnd_${String(index).padStart(3, "0")}`,
      workspaceId: "ws_1",
      apiKeyId: "key_1",
      spec: hugeSpec(index),
      svg: "<svg/>",
      altText: `Render ${index}`,
      warnings: "[]",
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }).run();
  }
}

function seedUsage(count: number) {
  for (let index = 0; index < count; index += 1) {
    db.insert(usageEvents).values({ id: `use_${index}`, workspaceId: "ws_1", kind: "render", quantity: 1, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString() }).run();
  }
}

function signIn() {
  session.currentAccount.mockResolvedValue({
    user: db.select().from(users).all()[0],
    workspace: db.select().from(workspaces).all()[0],
  });
}

const exportRequest = (ip = "203.0.113.5") => new Request("http://localhost:3000/api/account/export", { headers: { "x-forwarded-for": ip } });

beforeEach(() => {
  vi.clearAllMocks();
  db.delete(rateLimits).run();
  db.delete(usageEvents).run();
  db.delete(renders).run();
  db.delete(apiKeys).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  seedAccount();
});

describe("collectBounded", () => {
  /** A fake table that records exactly what the collector asked it for. */
  function fakeTable(rowCount: number, rowText: string) {
    const requests: Array<{ offset: number; limit: number }> = [];
    let rowsMaterialized = 0;
    const readPage = (offset: number, limit: number) => {
      requests.push({ offset, limit });
      const page = Array.from({ length: Math.max(0, Math.min(limit, rowCount - offset)) }, (_, index) => ({ n: offset + index, text: rowText }));
      rowsMaterialized += page.length;
      return page;
    };
    return { readPage, requests, materialized: () => rowsMaterialized };
  }

  it("never materializes more than one page, however large the table is", () => {
    // 10,000 rows of 1 KB is 10 MB in the table; the collector may hold only a page of them at a time.
    const table = fakeTable(10_000, "y".repeat(1_000));
    const budget = { remaining: 64 * 1024 };
    const result = collectBounded(table.readPage, (row) => JSON.stringify(row), budget, { pageSize: 10 });

    expect(table.requests.every((request) => request.limit === 10)).toBe(true);
    // Everything read is at most what was accepted plus the page the collector stopped inside.
    expect(table.materialized()).toBeLessThanOrEqual(result.included + 10);
    expect(table.materialized()).toBeLessThan(100);
    expect(result.truncated).toBe(true);
    expect(result.reason).toBe("byte-budget");
  });

  it("stops at the first row that would exceed the budget and leaves the remainder for the next collection", () => {
    const table = fakeTable(100, "z".repeat(90));
    const budget = { remaining: 1_000 };
    const result = collectBounded(table.readPage, (row) => JSON.stringify(row), budget, { pageSize: 25 });

    const bytes = Buffer.byteLength(result.chunks.join(",\n"), "utf8");
    expect(bytes).toBeLessThanOrEqual(1_000);
    expect(budget.remaining).toBe(1_000 - bytes);
    expect(budget.remaining).toBeGreaterThanOrEqual(0);
    expect(result.included).toBe(result.chunks.length);
    expect(result.reason).toBe("byte-budget");
  });

  it("reports the row cap and a complete read as distinct outcomes", () => {
    const capped = collectBounded(fakeTable(50, "a").readPage, (row) => JSON.stringify(row), { remaining: MAX_EXPORT_BYTES }, { maxRows: 4, pageSize: 3 });
    expect(capped).toMatchObject({ included: 4, truncated: true, reason: "row-limit" });

    const exact = collectBounded(fakeTable(4, "a").readPage, (row) => JSON.stringify(row), { remaining: MAX_EXPORT_BYTES }, { maxRows: 4, pageSize: 3 });
    expect(exact).toMatchObject({ included: 4, truncated: false, reason: "complete" });

    const empty = collectBounded(fakeTable(0, "a").readPage, (row) => JSON.stringify(row), { remaining: MAX_EXPORT_BYTES }, { pageSize: 3 });
    expect(empty).toMatchObject({ included: 0, truncated: false, reason: "complete" });
  });

  it("defaults to a page size that bounds one read, not the whole table", () => {
    expect(EXPORT_PAGE_SIZE).toBeLessThanOrEqual(100);
    const table = fakeTable(5_000, "b".repeat(100));
    collectBounded(table.readPage, (row) => JSON.stringify(row), { remaining: 10_000 });
    expect(table.requests[0].limit).toBe(EXPORT_PAGE_SIZE);
  });
});

describe("GET /api/account/export under a byte budget", () => {
  it("stops at the byte budget instead of allocating the whole table, and says so exactly", async () => {
    // 12 MB of renders in the table: the old row cap of 5,000 would have accepted every one of them,
    // pretty-printed the result and held ~24 MB in memory to answer one request.
    seedHugeRenders(12);
    signIn();

    const response = await exportRoute.GET(exportRequest());
    expect(response.status).toBe(200);
    const raw = await response.text();
    const bytes = Buffer.byteLength(raw, "utf8");

    // Memory-bounded: the response is capped by the byte budget, not by 12 MB of stored specs.
    expect(bytes).toBeLessThanOrEqual(MAX_EXPORT_BYTES + 64 * 1024);
    expect(bytes).toBeLessThan(12 * HUGE_SPEC_BYTES);

    const body = JSON.parse(raw);
    expect(body.truncated.renders).toBe(true);
    expect(body.stoppedBecause.renders).toBe("byte-budget");
    // The count is honest: it matches the rows actually in the file, and it is short of the table.
    expect(body.included.renders).toBe(body.renders.length);
    expect(body.included.renders).toBeGreaterThan(0);
    expect(body.included.renders).toBeLessThan(12);
    expect(body.byteBudgetForRowsInBytes).toBe(MAX_EXPORT_BYTES);
    expect(body.truncationNote).toContain("8 MiB");
    expect(body.truncationNote).toContain("byte-budget");
    expect(body.truncationNote).toContain("5,000");
    // Newest first, and no row is repeated or skipped by the paging.
    expect(body.renders[0].id).toBe("rnd_011");
    expect(new Set(body.renders.map((row: { id: string }) => row.id)).size).toBe(body.renders.length);
  });

  it("does not pretty-print the document", async () => {
    seedHugeRenders(3);
    signIn();
    const raw = await (await exportRoute.GET(exportRequest())).text();
    // Pretty-printing indents every nested value and builds a second copy of the whole document.
    expect(raw).not.toContain('\n  "format"');
    expect(raw).toContain('{"format":');
    // One row per line keeps the file readable without that cost.
    expect(raw.split("\n").length).toBeGreaterThan(3);
  });

  it("spends the budget on the large list, so the small lists are still complete", async () => {
    seedHugeRenders(12);
    seedUsage(25);
    signIn();

    const body = JSON.parse(await (await exportRoute.GET(exportRequest())).text());
    expect(body.usageEvents).toHaveLength(25);
    expect(body.truncated.usageEvents).toBe(false);
    expect(body.stoppedBecause.usageEvents).toBe("complete");
    expect(body.apiKeys).toHaveLength(1);
    expect(body.stoppedBecause.apiKeys).toBe("complete");
    expect(body.truncated.renders).toBe(true);
  });

  it("reports a small account as complete, with counts that match the file", async () => {
    db.insert(renders).values({ id: "rnd_small", workspaceId: "ws_1", apiKeyId: "key_1", spec: JSON.stringify({ title: "Revenue", type: "bar" }), svg: "<svg/>", altText: "Bar chart", warnings: "[]", createdAt: new Date().toISOString() }).run();
    seedUsage(3);
    signIn();

    const body = JSON.parse(await (await exportRoute.GET(exportRequest())).text());
    expect(body.truncated).toEqual({ apiKeys: false, renders: false, usageEvents: false });
    expect(body.stoppedBecause).toEqual({ apiKeys: "complete", renders: "complete", usageEvents: "complete" });
    expect(body.included).toEqual({ apiKeys: 1, renders: 1, usageEvents: 3 });
    expect(body.renders[0].spec).toEqual({ title: "Revenue", type: "bar" });
  });
});
