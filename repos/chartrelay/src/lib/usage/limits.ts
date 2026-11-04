import { and, eq, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

// Quota figures live in ./plans so client components can read them without importing the database.
import { limitFor, planLimits } from "./plans";
export { planLimits, PLANS, PLAN_ORDER, RENDER_PACK, UNMARKED_PLANS, UNVERIFIED_FREE_LIMIT, limitFor, formatLimit, normalisePlan, type Plan } from "./plans";

export function startOfMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** A transaction handle from `db.transaction`. better-sqlite3's is synchronous, so holding one blocks the event loop. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function usageTotal(workspaceId: string, runner: Tx | typeof db) {
  const result = runner.select({ total: sql<number>`coalesce(sum(${usageEvents.quantity}), 0)` })
    .from(usageEvents)
    .where(and(eq(usageEvents.workspaceId, workspaceId), gte(usageEvents.createdAt, startOfMonth())))
    .get();
  return Number(result?.total ?? 0);
}

/** Read-only usage total for display (dashboard, billing copy). Never use this to gate a write — see assertWithinLimit. */
export async function monthlyUsage(workspaceId: string) {
  return usageTotal(workspaceId, db);
}

/** The only error the render API maps to HTTP 429. */
export class QuotaExceededError extends Error {}

/**
 * Counts this month's usage and throws if the workspace is already at its limit.
 *
 * Synchronous, and it only accepts a transaction handle — never the shared connection. That is the fix for
 * the quota race: the caller must already be inside a synchronous better-sqlite3 transaction, so the count
 * returned here and the usage event the caller writes cannot be separated by an `await` that lets another
 * request observe the same pre-insert count. An async version of this check is not safe to add back.
 */
export function assertWithinLimit(workspaceId: string, plan: string, emailVerified: boolean, tx: Tx) {
  const used = usageTotal(workspaceId, tx);
  const limit = limitFor(plan, emailVerified);
  if (used >= limit) throw new QuotaExceededError(plan === "free" && !emailVerified ? `Monthly render limit reached (${limit.toLocaleString()}). Confirm your email to raise it to ${planLimits.free.toLocaleString()}.` : `Monthly render limit reached (${limit.toLocaleString()}).`);
  return { used, limit };
}

/** Meters one unit of usage. Transaction-bound for the same reason as assertWithinLimit: the two belong together. */
export function recordUsage(workspaceId: string, kind = "render", tx: Tx) {
  tx.insert(usageEvents).values({ id: nanoid(), workspaceId, kind, quantity: 1, createdAt: new Date().toISOString() }).run();
}
