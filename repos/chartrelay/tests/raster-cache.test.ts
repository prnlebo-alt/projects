import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

const { db } = await import("@/lib/db");
const { renders, users, workspaces } = await import("@/lib/db/schema");
const { enforcePngBudget, pngCacheBudget, storedPng, MAX_STORED_PNG_BYTES } = await import("@/lib/charts/raster");
const { renderChart } = await import("@/lib/charts/render");
const { sampleSpec } = await import("@/lib/charts/schema");

function seedRender(id: string, createdAt: string, png: Buffer | null = null) {
  const { svg } = renderChart(sampleSpec);
  db.insert(renders).values({ id, workspaceId: "ws", apiKeyId: null, spec: "{}", svg, altText: "", warnings: "[]", createdAt, png }).run();
}
const stored = (id: string) => db.select({ png: renders.png }).from(renders).where(eq(renders.id, id)).get()?.png ?? null;

beforeEach(() => {
  db.delete(renders).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  db.insert(users).values({ id: "u", email: "u@example.com", passwordHash: "x", name: "U", createdAt: "2026-01-01T00:00:00Z" }).run();
  db.insert(workspaces).values({ id: "ws", ownerId: "u", name: "W", createdAt: "2026-01-01T00:00:00Z" }).run();
});

describe("PNG cache", () => {
  it("defaults to a 200 MB budget and accepts an override", () => {
    expect(pngCacheBudget({})).toBe(200 * 1024 * 1024);
    expect(pngCacheBudget({ PNG_CACHE_MAX_BYTES: "1000" })).toBe(1000);
    expect(pngCacheBudget({ PNG_CACHE_MAX_BYTES: "nope" })).toBe(200 * 1024 * 1024);
    expect(pngCacheBudget({ PNG_CACHE_MAX_BYTES: "200MB" })).toBe(200 * 1024 * 1024);
    expect(pngCacheBudget({ PNG_CACHE_MAX_BYTES: "0" })).toBe(0);
  });

  it("evicts the oldest stored PNGs until total is within 80% of the budget", () => {
    seedRender("a", "2026-01-01T00:00:00Z", Buffer.alloc(400));
    seedRender("b", "2026-01-02T00:00:00Z", Buffer.alloc(400));
    seedRender("c", "2026-01-03T00:00:00Z", Buffer.alloc(400));
    // 1,200 bytes against a 1,000 budget: evict oldest until at most 800 remain.
    expect(enforcePngBudget(1000)).toBe(1);
    expect(stored("a")).toBeNull();
    expect(stored("b")?.length).toBe(400);
    expect(stored("c")?.length).toBe(400);
    expect(enforcePngBudget(1000)).toBe(0);
  });

  it("answers the budget queries from the PNG size index, not a scan of every render", () => {
    const plan = (query: ReturnType<typeof sql>) => (db.all(sql`EXPLAIN QUERY PLAN ${query}`) as { detail: string }[]).map((row) => row.detail).join(" | ");
    expect(plan(sql`select coalesce(sum(length(${renders.png})), 0) from ${renders} where ${renders.png} is not null`)).toContain("USING INDEX idx_renders_png_bytes");
    expect(plan(sql`select ${renders}.rowid, length(${renders.png}) from ${renders} where ${renders.png} is not null order by ${renders.createdAt} asc`)).toMatch(/USING (COVERING )?INDEX idx_renders_png_bytes/);
  });

  it("stores a normal PNG once and still serves it when caching is disabled", async () => {
    seedRender("r1", "2026-01-01T00:00:00Z");
    const svg = db.select({ svg: renders.svg }).from(renders).where(eq(renders.id, "r1")).get()!.svg;
    const png = await storedPng("r1", svg, null);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeLessThanOrEqual(MAX_STORED_PNG_BYTES);
    expect(stored("r1")?.length).toBe(png.length);

    process.env.PNG_CACHE_MAX_BYTES = "0";
    try {
      seedRender("r2", "2026-01-02T00:00:00Z");
      const again = await storedPng("r2", svg, null);
      expect(again.length).toBeGreaterThan(0);
      expect(stored("r2")).toBeNull();
    } finally {
      delete process.env.PNG_CACHE_MAX_BYTES;
    }
  });
});
