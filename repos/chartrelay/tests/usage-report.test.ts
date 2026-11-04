import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, balances, creditGrants, usageEvents, users, workspaces } from "@/lib/db/schema";
import { grantCredit } from "@/lib/ledger/ledger";
import { usageReport } from "@/lib/usage/report";

const NOW = new Date("2026-10-09T12:00:00Z");

function charge(id: string, createdAt: string, extra: Partial<typeof usageEvents.$inferInsert> = {}) {
  db.insert(usageEvents).values({ id, workspaceId: "ws_1", kind: "render", quantity: 1, units: 1, status: "charged", createdAt, ...extra }).run();
}

beforeEach(() => {
  db.delete(usageEvents).run(); db.delete(creditGrants).run(); db.delete(balances).run();
  db.delete(apiKeys).run(); db.delete(workspaces).run(); db.delete(users).run();
  const now = NOW.toISOString();
  db.insert(users).values({ id: "u1", email: "a@example.com", passwordHash: "x", name: "A", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_1", ownerId: "u1", name: "W", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_2", ownerId: "u1", name: "Other", createdAt: now }).run();
  db.insert(apiKeys).values({ id: "k1", workspaceId: "ws_1", name: "Production", keyHash: "h1", prefix: "cr_live_ab", createdAt: now }).run();
});

describe("usageReport", () => {
  it("returns a zero-filled 30-day series ending today", () => {
    const report = usageReport("ws_1", NOW);
    expect(report.byDay).toHaveLength(30);
    expect(report.byDay[29].day).toBe("2026-10-09");
    expect(report.byDay[0].day).toBe("2026-09-10");
    expect(report.total).toBe(0);
  });

  it("counts charged units per day and per key, and nothing else", () => {
    charge("a", "2026-10-09T01:00:00Z", { keyId: "k1" });
    charge("b", "2026-10-09T02:00:00Z", { keyId: "k1", units: 3 });
    charge("c", "2026-10-08T23:59:00Z");
    charge("d", "2026-10-09T03:00:00Z", { keyId: "k1", status: "refunded" });
    charge("e", "2026-10-09T04:00:00Z", { keyId: "k1", status: "reserved" });
    charge("f", "2026-08-01T00:00:00Z", { keyId: "k1" });
    charge("g", "2026-10-09T05:00:00Z", { workspaceId: "ws_2" });
    const report = usageReport("ws_1", NOW);
    expect(report.byDay.find((d) => d.day === "2026-10-09")?.renders).toBe(4);
    expect(report.byDay.find((d) => d.day === "2026-10-08")?.renders).toBe(1);
    expect(report.total).toBe(5);
    expect(report.byKey).toEqual([
      { keyId: "k1", name: "Production", renders: 4 },
      { keyId: null, name: "Dashboard and playground", renders: 1 },
    ]);
  });

  it("lists live credit only: not revoked, not expired", () => {
    grantCredit({ workspaceId: "ws_1", source: "pack", renders: 2000, expiresAt: "2027-10-09T00:00:00Z", paymentEventId: "p1" });
    grantCredit({ workspaceId: "ws_1", source: "pack", renders: 2000, expiresAt: "2026-01-01T00:00:00Z", paymentEventId: "p2" });
    grantCredit({ workspaceId: "ws_1", source: "free", renders: 250, paymentEventId: "p3" });
    db.update(creditGrants).set({ revokedAt: NOW.toISOString() }).where(eq(creditGrants.paymentEventId, "p3")).run();
    const report = usageReport("ws_1", NOW);
    expect(report.grants.map((g) => g.renders)).toEqual([2000]);
    expect(report.balance).toBe(4250);
  });
});
