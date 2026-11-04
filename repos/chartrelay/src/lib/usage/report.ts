import { and, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, creditGrants, usageEvents } from "@/lib/db/schema";
import { balanceOf } from "@/lib/ledger/ledger";

export const REPORT_DAYS = 30;

export interface UsageReport {
  balance: number;
  /** One entry per UTC day, oldest first, zero-filled so the chart has no gaps. */
  byDay: Array<{ day: string; renders: number }>;
  /** Spend by key, biggest first. `keyId` is null for renders made from a signed-in session. */
  byKey: Array<{ keyId: string | null; name: string; renders: number }>;
  /** Spend by render style, biggest first. Rows from before the ledger have no style and are grouped as "unknown". */
  byFormat: Array<{ format: string; renders: number }>;
  total: number;
  /** Credit that is still live: not revoked and not past its expiry. */
  grants: Array<{ id: string; source: string; renders: number; expiresAt: string | null; createdAt: string }>;
}

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * What a workspace spent, for display. Only `charged` rows count: a reserved row is a render still in
 * flight and a refunded row is one the customer was given back, and neither is spend.
 */
export function usageReport(workspaceId: string, now = new Date(), days = REPORT_DAYS): UsageReport {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
  const where = and(eq(usageEvents.workspaceId, workspaceId), eq(usageEvents.status, "charged"), gte(usageEvents.createdAt, start.toISOString()));

  const dayRows = db.select({ day: sql<string>`substr(${usageEvents.createdAt}, 1, 10)`, renders: sql<number>`coalesce(sum(${usageEvents.units}), 0)` })
    .from(usageEvents).where(where).groupBy(sql`substr(${usageEvents.createdAt}, 1, 10)`).all();
  const perDay = new Map(dayRows.map((row) => [row.day, Number(row.renders)]));
  const byDay = Array.from({ length: days }, (_, index) => {
    const day = dayOf(new Date(start.getTime() + index * 86_400_000));
    return { day, renders: perDay.get(day) ?? 0 };
  });

  const keyRows = db.select({ keyId: usageEvents.keyId, name: apiKeys.name, renders: sql<number>`coalesce(sum(${usageEvents.units}), 0)` })
    .from(usageEvents).leftJoin(apiKeys, eq(apiKeys.id, usageEvents.keyId)).where(where).groupBy(usageEvents.keyId).all();
  const byKey = keyRows
    .map((row) => ({ keyId: row.keyId, name: row.keyId ? (row.name ?? "Deleted key") : "Dashboard and playground", renders: Number(row.renders) }))
    .sort((a, b) => b.renders - a.renders);

  const formatRows = db.select({ format: usageEvents.format, renders: sql<number>`coalesce(sum(${usageEvents.units}), 0)` })
    .from(usageEvents).where(where).groupBy(usageEvents.format).all();
  const byFormat = formatRows.map((row) => ({ format: row.format ?? "unknown", renders: Number(row.renders) })).sort((a, b) => b.renders - a.renders);

  const grants = db.select({ id: creditGrants.id, source: creditGrants.source, renders: creditGrants.renders, expiresAt: creditGrants.expiresAt, createdAt: creditGrants.createdAt })
    .from(creditGrants)
    .where(and(eq(creditGrants.workspaceId, workspaceId), isNull(creditGrants.revokedAt), or(isNull(creditGrants.expiresAt), gte(creditGrants.expiresAt, now.toISOString()))))
    .orderBy(creditGrants.createdAt).all();

  return { balance: balanceOf(workspaceId), byDay, byKey, byFormat, total: byDay.reduce((sum, row) => sum + row.renders, 0), grants };
}
