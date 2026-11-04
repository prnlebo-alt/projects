/**
 * The credit ledger. This file decides whether a render happens.
 *
 * Two rules shape everything here.
 *
 * **Never bill past what was prepaid.** There is no postpaid path, no overdraft and no "we will sort
 * it out later". A reserve that cannot be satisfied returns 402 and the render does not run. The
 * balance column carries a `CHECK (remaining >= 0)` so that if any future code path tries to spend
 * past zero, the database refuses rather than letting the number go negative and billing fail silently.
 *
 * **Never charge for nothing.** A failed render, a rejected spec and a cache hit cost the customer
 * zero. That is why a unit is *reserved* before the work and *settled* after it, rather than charged
 * optimistically: a crash between the two leaves a `reserved` row that the sweeper can find and give
 * back, instead of a credit that quietly vanished.
 *
 * The reserve is one statement on purpose. `UPDATE … WHERE remaining >= 1 RETURNING remaining` is
 * atomic in SQLite as it is in Postgres: a hundred requests racing for one credit produce exactly one
 * winner, decided by the database rather than by a check-then-act in application code that can
 * interleave between the check and the act.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { auditLog, balances, creditGrants, usageEvents } from "@/lib/db/schema";
import { ApiError } from "@/lib/http/errors";

/** How long a reservation may stay unsettled before the sweeper assumes the render died. */
export const RESERVATION_TIMEOUT_MS = 5 * 60 * 1000;

export type GrantSource = "plan_cycle" | "pack" | "free" | "goodwill";

const now = () => new Date().toISOString();

/**
 * Adds credit, once.
 *
 * `paymentEventId` is unique in the database, so a webhook delivered twice grants credit once. The
 * guarantee lives in the schema rather than in a "have I seen this?" check, because that check and
 * the insert that follows it can be running twice at the same instant.
 *
 * Returns the new balance, or null when this payment had already been granted.
 */
export function grantCredit(options: {
  workspaceId: string;
  source: GrantSource;
  renders: number;
  expiresAt?: string | null;
  paymentEventId?: string | null;
  actor?: string;
}): number | null {
  const { workspaceId, source, renders, expiresAt = null, paymentEventId = null, actor = "system" } = options;
  if (renders <= 0) throw new Error("A grant must be for at least one render.");

  try {
    return db.transaction((tx) => {
      tx.insert(creditGrants).values({
        id: randomUUID(), workspaceId, source, renders, expiresAt, paymentEventId, createdAt: now(),
      }).run();
      const remaining = addToBalance(tx, workspaceId, renders);
      tx.insert(auditLog).values({
        id: randomUUID(), workspaceId, actor, action: "credit.grant", subject: paymentEventId,
        detail: JSON.stringify({ source, renders, expiresAt }), createdAt: now(),
      }).run();
      return remaining;
    }, { behavior: "immediate" });
  } catch (error) {
    // The unique index on payment_event_id is the dedupe. A second delivery lands here, and landing
    // here is a success: the credit exists, which is what the caller wanted.
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof (error as { code?: string }).code === "string" && (error as { code: string }).code.startsWith("SQLITE_CONSTRAINT_UNIQUE");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function addToBalance(tx: Tx, workspaceId: string, delta: number): number {
  tx.insert(balances).values({ workspaceId, remaining: 0, updatedAt: now() }).onConflictDoNothing().run();
  const row = tx.update(balances)
    .set({ remaining: sql`${balances.remaining} + ${delta}`, updatedAt: now() })
    .where(eq(balances.workspaceId, workspaceId))
    .returning({ remaining: balances.remaining }).get();
  return row?.remaining ?? 0;
}

export function balanceOf(workspaceId: string): number {
  return db.select({ remaining: balances.remaining }).from(balances).where(eq(balances.workspaceId, workspaceId)).get()?.remaining ?? 0;
}

export interface Reservation {
  id: string;
  remaining: number;
  /** True when an identical request was already served; the caller must not do the work again. */
  replayed: boolean;
  replayedStatus?: "charged" | "refunded";
  /** On a replay of a settled charge: the chart that charge produced. */
  renderId?: string | null;
}

/**
 * Takes one unit, or refuses.
 *
 * The whole concurrency story is the single UPDATE below. Nothing between the read and the write can
 * interleave, so "100 parallel requests, 1 credit left" has exactly one winner by construction rather
 * than by locking discipline that a future edit might forget.
 */
export function reserve(options: {
  workspaceId: string;
  keyId?: string | null;
  requestId: string;
  idempotencyKey?: string | null;
  units?: number;
  format?: string | null;
}): Reservation {
  const { workspaceId, keyId = null, requestId, idempotencyKey = null, units = 1, format = null } = options;
  // The key when there is one, the workspace otherwise — see the column's note in the schema.
  const idempotencyScope = keyId ?? workspaceId;

  return db.transaction((tx) => {
    // A retry after a timeout must return the first answer rather than buy a second render. Checked
    // inside the transaction so two simultaneous retries cannot both miss and both reserve.
    if (idempotencyKey) {
      const existing = tx.select().from(usageEvents)
        .where(and(eq(usageEvents.idempotencyScope, idempotencyScope), eq(usageEvents.idempotencyKey, idempotencyKey))).get();
      if (existing && existing.status === "refunded") {
        // That attempt failed and was given back, so the retry is the first real attempt. Leaving the row would
        // make the unique index refuse it, and answering with the failed attempt's (nonexistent) chart would be
        // the wrong answer — so it is cleared and the request proceeds as new.
        tx.delete(usageEvents).where(eq(usageEvents.id, existing.id)).run();
      } else if (existing) {
        return {
          id: existing.id,
          remaining: balanceOfIn(tx, workspaceId),
          replayed: true,
          replayedStatus: existing.status === "reserved" ? undefined : (existing.status as "charged" | "refunded"),
          renderId: existing.renderId,
        };
      }
    }

    const taken = tx.update(balances)
      .set({ remaining: sql`${balances.remaining} - ${units}`, updatedAt: now() })
      .where(and(eq(balances.workspaceId, workspaceId), sql`${balances.remaining} >= ${units}`))
      .returning({ remaining: balances.remaining }).get();

    if (!taken) {
      throw new ApiError("credits_exhausted", "No render credit remaining. Buy a render pack or choose a plan to continue.", {
        creditsRemaining: balanceOfIn(tx, workspaceId),
      });
    }

    drawDown(tx, workspaceId, units);
    const id = randomUUID();
    tx.insert(usageEvents).values({
      id, workspaceId, keyId, requestId, idempotencyKey, idempotencyScope, units, format,
      kind: "render", quantity: units, status: "reserved", cacheHit: false, createdAt: now(),
    }).run();
    return { id, remaining: taken.remaining, replayed: false };
  }, { behavior: "immediate" });
}

/**
 * Records which grants a spend came out of, soonest-expiring first and never-expiring last.
 *
 * The balance is one pooled number, which is what makes the reserve a single atomic statement, but a refund
 * or an expiry has to know how much of *one particular grant* is left: without it, expiring a month's
 * allowance that was fully spent would take the same number of renders out of a pack that was never touched.
 * Spending the credit that is about to expire first is also the order a customer would choose.
 */
function drawDown(tx: Tx, workspaceId: string, units: number) {
  const stamp = now();
  const grants = tx.select({ id: creditGrants.id, renders: creditGrants.renders, consumed: creditGrants.consumed }).from(creditGrants)
    .where(and(eq(creditGrants.workspaceId, workspaceId), isNull(creditGrants.revokedAt), or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, stamp)), sql`${creditGrants.consumed} < ${creditGrants.renders}`))
    .orderBy(sql`${creditGrants.expiresAt} IS NULL`, asc(creditGrants.expiresAt), asc(creditGrants.createdAt)).all();
  let left = units;
  for (const grant of grants) {
    if (left <= 0) break;
    const take = Math.min(left, grant.renders - grant.consumed);
    tx.update(creditGrants).set({ consumed: sql`${creditGrants.consumed} + ${take}` }).where(eq(creditGrants.id, grant.id)).run();
    left -= take;
  }
}

/** The inverse of drawDown, for a refunded render: the most recently drawn-from grant gets its units back first. */
function giveBack(tx: Tx, workspaceId: string, units: number) {
  const grants = tx.select({ id: creditGrants.id, consumed: creditGrants.consumed }).from(creditGrants)
    .where(and(eq(creditGrants.workspaceId, workspaceId), isNull(creditGrants.revokedAt), sql`${creditGrants.consumed} > 0`))
    .orderBy(desc(sql`${creditGrants.expiresAt} IS NULL`), desc(creditGrants.expiresAt), desc(creditGrants.createdAt)).all();
  let left = units;
  for (const grant of grants) {
    if (left <= 0) break;
    const give = Math.min(left, grant.consumed);
    tx.update(creditGrants).set({ consumed: sql`${creditGrants.consumed} - ${give}` }).where(eq(creditGrants.id, grant.id)).run();
    left -= give;
  }
}

const balanceOfIn = (tx: Tx, workspaceId: string): number =>
  tx.select({ remaining: balances.remaining }).from(balances).where(eq(balances.workspaceId, workspaceId)).get()?.remaining ?? 0;

/** The render succeeded. The unit stays spent and the row becomes permanent evidence of the charge. */
export function settleCharged(reservationId: string, renderId: string | null = null): void {
  db.update(usageEvents).set({ status: "charged", settledAt: now(), renderId })
    .where(and(eq(usageEvents.id, reservationId), eq(usageEvents.status, "reserved"))).run();
}

/**
 * The render failed, or never happened. Give the unit back.
 *
 * Conditional on the row still being `reserved`, so a refund racing the sweeper cannot return the
 * same unit twice — whichever gets there first settles the row and the other changes nothing.
 */
export function refund(reservationId: string, reason: string): boolean {
  return db.transaction((tx) => {
    const row = tx.update(usageEvents).set({ status: "refunded", settledAt: now() })
      .where(and(eq(usageEvents.id, reservationId), eq(usageEvents.status, "reserved")))
      .returning({ workspaceId: usageEvents.workspaceId, units: usageEvents.units }).get();
    if (!row) return false;
    addToBalance(tx, row.workspaceId, row.units);
    giveBack(tx, row.workspaceId, row.units);
    tx.insert(auditLog).values({
      id: randomUUID(), workspaceId: row.workspaceId, actor: "system", action: "credit.refund",
      subject: reservationId, detail: reason, createdAt: now(),
    }).run();
    return true;
  }, { behavior: "immediate" });
}

/**
 * Gives back units reserved by requests that never finished.
 *
 * A process killed between reserving and settling leaves a row no running code will ever settle.
 * Without this the customer has silently paid for a render they did not get, which is the failure a
 * customer notices last and forgives least.
 */
export function sweepStaleReservations(olderThanMs = RESERVATION_TIMEOUT_MS): number {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const stale = db.select({ id: usageEvents.id }).from(usageEvents)
    .where(and(eq(usageEvents.status, "reserved"), lt(usageEvents.createdAt, cutoff))).all();
  let swept = 0;
  for (const row of stale) if (refund(row.id, "swept: reservation never settled")) swept += 1;
  if (swept > 0) console.warn(`[ledger] swept ${swept} reservation(s) older than ${Math.round(olderThanMs / 1000)}s`);
  return swept;
}

/**
 * Takes credit back when money is taken back.
 *
 * A refunded or disputed payment must not leave the credit it bought. Only the unspent part of that
 * grant is clawed back: units already drawn were already rendered, and the balance is allowed to go
 * to zero but never below it, because a negative balance is an invented debt the customer never agreed
 * to. The shortfall is recorded instead, so a human can see what was consumed before the reversal.
 */
export function reverseGrant(paymentEventId: string, reason: string): { reversed: boolean; clawedBack: number; shortfall: number } {
  return db.transaction((tx) => {
    const grant = tx.select().from(creditGrants).where(eq(creditGrants.paymentEventId, paymentEventId)).get();
    if (!grant || grant.revokedAt) return { reversed: false, clawedBack: 0, shortfall: 0 };

    const remaining = balanceOfIn(tx, grant.workspaceId);
    // Only what this grant still holds: units drawn from it were rendered, and units drawn from the
    // customer's other credit are not this payment's to take back.
    const clawedBack = Math.min(remaining, Math.max(0, grant.renders - grant.consumed));
    const shortfall = grant.renders - clawedBack;

    tx.update(creditGrants).set({ revokedAt: now() }).where(eq(creditGrants.id, grant.id)).run();
    if (clawedBack > 0) addToBalance(tx, grant.workspaceId, -clawedBack);
    tx.insert(auditLog).values({
      id: randomUUID(), workspaceId: grant.workspaceId, actor: "system", action: "credit.reverse",
      subject: paymentEventId, detail: JSON.stringify({ reason, granted: grant.renders, clawedBack, shortfall }),
      createdAt: now(),
    }).run();
    return { reversed: true, clawedBack, shortfall };
  }, { behavior: "immediate" });
}

/**
 * Expires credit that has run out of time.
 *
 * Packs expire twelve months after purchase, which is stated in the Terms and at checkout. Expiry
 * removes only what is still unspent, and only down to zero.
 */
export function expireGrants(at = new Date()): number {
  const stamp = at.toISOString();
  return db.transaction((tx) => {
    const expired = tx.select().from(creditGrants)
      .where(and(isNull(creditGrants.revokedAt), lt(creditGrants.expiresAt, stamp))).all();
    let removed = 0;
    for (const grant of expired) {
      const unspent = Math.max(0, grant.renders - grant.consumed);
      const take = Math.min(unspent, balanceOfIn(tx, grant.workspaceId));
      tx.update(creditGrants).set({ revokedAt: stamp }).where(eq(creditGrants.id, grant.id)).run();
      if (take > 0) { addToBalance(tx, grant.workspaceId, -take); removed += take; }
      tx.insert(auditLog).values({
        id: randomUUID(), workspaceId: grant.workspaceId, actor: "system", action: "credit.expire",
        subject: grant.id, detail: JSON.stringify({ granted: grant.renders, removed: take }), createdAt: now(),
      }).run();
    }
    return removed;
  }, { behavior: "immediate" });
}

/** Grants that will expire soon, for the 14-day and 3-day warning emails the spec requires. */
export function grantsExpiringWithin(days: number, at = new Date()): Array<{ workspaceId: string; grantId: string; expiresAt: string; unspent: number }> {
  const horizon = new Date(at.getTime() + days * 86_400_000).toISOString();
  return db.select().from(creditGrants)
    .where(and(isNull(creditGrants.revokedAt), lt(creditGrants.expiresAt, horizon)))
    .orderBy(asc(creditGrants.expiresAt)).all()
    .filter((grant) => grant.expiresAt !== null && grant.expiresAt > at.toISOString())
    .map((grant) => ({ workspaceId: grant.workspaceId, grantId: grant.id, expiresAt: grant.expiresAt!, unspent: Math.max(0, grant.renders - grant.consumed) }));
}

/** Does this workspace hold pack credit it has not used up? Pack credit is what removes the mark without a plan. */
export function hasLivePackCredit(workspaceId: string, at = new Date()): boolean {
  return Boolean(db.select({ id: creditGrants.id }).from(creditGrants)
    .where(and(eq(creditGrants.workspaceId, workspaceId), eq(creditGrants.source, "pack"), isNull(creditGrants.revokedAt),
      or(isNull(creditGrants.expiresAt), gt(creditGrants.expiresAt, at.toISOString())), sql`${creditGrants.consumed} < ${creditGrants.renders}`)).limit(1).get());
}

/** True when the database is reachable. A ledger that cannot be read must fail closed, never open. */
export function ledgerHealthy(): boolean {
  try {
    sqlite().prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}
