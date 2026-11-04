import { afterEach, describe, expect, it, vi } from "vitest";

const failure = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    sqlite: () => {
      if (failure.enabled) throw new Error("SQLITE_CANTOPEN: secret-path /app/.data/chartrelay.db");
      return actual.sqlite();
    },
  };
});

const health = await import("@/app/api/health/route");

afterEach(() => {
  failure.enabled = false;
});

describe("GET /api/health", () => {
  it("returns 200 ok after a successful database query", async () => {
    const response = await health.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 error without leaking details when the database query throws", async () => {
    failure.enabled = true;
    const response = await health.GET();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: "error" });
    expect(text).not.toContain("SQLITE");
    expect(text).not.toContain("/app/.data");
  });
});
