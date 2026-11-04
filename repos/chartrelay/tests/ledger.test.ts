import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  balanceOf, expireGrants, grantCredit, grantsExpiringWithin, ledgerHealthy,
  refund, reserve, reverseGrant, settleCharged, sweepStaleReservations,
} from "@/lib/ledger/ledger";
import { ApiError } from "@/lib/http/errors";
import { db } from "@/lib/db";
import { auditLog, balances, creditGrants, usageEvents, users, workspaces } from "@/lib/db/schema";

const WS = "ws-ledger";
const KEY = "key-1";

const seed = (id = WS) => {
  const at = new Date().toISOString();
  db.insert(users).values({ id: `u_${id}`, email: `${id}@example.com`, passwordHash: "x", name: "T", createdAt: at }).run();
  db.insert(workspaces).values({ id, ownerId: `u_${id}`, name: "W", createdAt: at }).run();
};

beforeEach(() => {
  for (const table of [auditLog, usageEvents, creditGrants, balances, workspaces, users]) db.delete(table).run();
  seed();
});

describe("granting credit", () => {
  it("adds renders to the balance", () => {
    expect(grantCredit({ workspaceId: WS, source: "pack", renders: 2_000 })).toBe(2_000);
    expect(balanceOf(WS)).toBe(2_000);
  });

  it("grants once when the same payment arrives twice", () => {
    // The stress-test row: a webhook delivered twice must not be paid for twice. The guarantee is the
    // unique index, not a have-I-seen-this check, because that check and its insert can race.
    expect(grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, paymentEventId: "evt_1" })).toBe(2_000);
    expect(grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, paymentEventId: "evt_1" })).toBeNull();
    expect(balanceOf(WS)).toBe(2_000);
  });

  it("accumulates separate payments", () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 250, paymentEventId: "evt_a" });
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, paymentEventId: "evt_b" });
    expect(balanceOf(WS)).toBe(2_250);
  });

  it("refuses a grant of nothing", () => {
    expect(() => grantCredit({ workspaceId: WS, source: "goodwill", renders: 0 })).toThrow();
  });

  it("writes an audit row a human can read later", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, paymentEventId: "evt_1" });
    const row = db.select().from(auditLog).all().find((entry) => entry.action === "credit.grant");
    expect(row?.subject).toBe("evt_1");
  });
});

describe("reserving a unit", () => {
  it("takes exactly one and reports what is left", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 3 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    expect(reservation.remaining).toBe(2);
    expect(balanceOf(WS)).toBe(2);
  });

  it("refuses with 402 when there is nothing left, and says the balance is zero", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 1 });
    reserve({ workspaceId: WS, requestId: "req_1" });
    try {
      reserve({ workspaceId: WS, requestId: "req_2" });
      expect.unreachable("a reserve with no credit must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(402);
      expect((error as ApiError).code).toBe("credits_exhausted");
      expect((error as ApiError).options.creditsRemaining).toBe(0);
    }
  });

  it("refuses an account that never had credit", () => {
    expect(() => reserve({ workspaceId: WS, requestId: "req_1" })).toThrow(ApiError);
  });

  it("never lets the balance go below zero", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2 });
    for (let i = 0; i < 2; i++) reserve({ workspaceId: WS, requestId: `req_${i}` });
    expect(() => reserve({ workspaceId: WS, requestId: "req_x" })).toThrow();
    expect(balanceOf(WS)).toBe(0);
  });

  it("gives exactly one winner when many requests race for one credit", () => {
    // In one process better-sqlite3 serialises, so this proves the logic rather than the locking.
    // tests/ledger-concurrency.test.ts proves it across real processes.
    grantCredit({ workspaceId: WS, source: "pack", renders: 1 });
    let won = 0;
    let refused = 0;
    for (let i = 0; i < 100; i++) {
      try { reserve({ workspaceId: WS, requestId: `req_${i}` }); won += 1; } catch { refused += 1; }
    }
    expect(won).toBe(1);
    expect(refused).toBe(99);
    expect(balanceOf(WS)).toBe(0);
  });
});

describe("a retry after a timeout", () => {
  it("returns the first answer and spends nothing more", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 10 });
    const first = reserve({ workspaceId: WS, keyId: KEY, requestId: "req_1", idempotencyKey: "idem-1" });
    settleCharged(first.id);
    const retry = reserve({ workspaceId: WS, keyId: KEY, requestId: "req_2", idempotencyKey: "idem-1" });
    expect(retry.replayed).toBe(true);
    expect(retry.id).toBe(first.id);
    expect(retry.replayedStatus).toBe("charged");
    expect(balanceOf(WS)).toBe(9);
  });

  it("treats a different key's identical idempotency key as a different request", () => {
    // Otherwise one customer could replay another's result by guessing a key string.
    grantCredit({ workspaceId: WS, source: "pack", renders: 10 });
    reserve({ workspaceId: WS, keyId: "key-a", requestId: "r1", idempotencyKey: "same" });
    reserve({ workspaceId: WS, keyId: "key-b", requestId: "r2", idempotencyKey: "same" });
    expect(balanceOf(WS)).toBe(8);
  });

  it("does not deduplicate when no idempotency key is given", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 10 });
    reserve({ workspaceId: WS, keyId: KEY, requestId: "r1" });
    reserve({ workspaceId: WS, keyId: KEY, requestId: "r2" });
    expect(balanceOf(WS)).toBe(8);
  });
});

describe("settling", () => {
  it("keeps the unit spent when the render succeeded", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    settleCharged(reservation.id);
    expect(balanceOf(WS)).toBe(4);
    expect(db.select().from(usageEvents).all()[0].status).toBe("charged");
  });

  it("gives the unit back when the render failed", () => {
    // Failed renders are never charged. This is the rule a customer notices if it is broken.
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    expect(refund(reservation.id, "render threw")).toBe(true);
    expect(balanceOf(WS)).toBe(5);
  });

  it("cannot refund the same unit twice", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    expect(refund(reservation.id, "first")).toBe(true);
    expect(refund(reservation.id, "second")).toBe(false);
    expect(balanceOf(WS)).toBe(5);
  });

  it("cannot refund something already charged", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    settleCharged(reservation.id);
    expect(refund(reservation.id, "too late")).toBe(false);
    expect(balanceOf(WS)).toBe(4);
  });
});

describe("the sweeper", () => {
  it("gives back a reservation whose render never finished", () => {
    // A process killed between reserving and settling leaves a row nothing will ever settle. Without
    // the sweeper the customer has silently paid for a render they did not get.
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    db.update(usageEvents).set({ createdAt: new Date(Date.now() - 10 * 60_000).toISOString() }).run();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(sweepStaleReservations()).toBe(1);
    expect(balanceOf(WS)).toBe(5);
    expect(db.select().from(usageEvents).all()[0].status).toBe("refunded");
    warn.mockRestore();
    void reservation;
  });

  it("leaves a young reservation alone", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    reserve({ workspaceId: WS, requestId: "req_1" });
    expect(sweepStaleReservations()).toBe(0);
    expect(balanceOf(WS)).toBe(4);
  });

  it("leaves settled rows alone however old they are", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 5 });
    const reservation = reserve({ workspaceId: WS, requestId: "req_1" });
    settleCharged(reservation.id);
    db.update(usageEvents).set({ createdAt: new Date(Date.now() - 86_400_000).toISOString() }).run();
    expect(sweepStaleReservations()).toBe(0);
    expect(balanceOf(WS)).toBe(4);
  });
});

describe("money taken back", () => {
  it("claws back the credit a refunded payment bought", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, paymentEventId: "evt_1" });
    const result = reverseGrant("evt_1", "refund requested");
    expect(result).toEqual({ reversed: true, clawedBack: 2_000, shortfall: 0 });
    expect(balanceOf(WS)).toBe(0);
  });

  it("claws back only what is left, and records what was already spent", () => {
    // A negative balance would be an invented debt the customer never agreed to. The shortfall is
    // recorded instead, so a human can see what was consumed before the reversal.
    grantCredit({ workspaceId: WS, source: "pack", renders: 10, paymentEventId: "evt_1" });
    for (let i = 0; i < 4; i++) settleCharged(reserve({ workspaceId: WS, requestId: `r${i}` }).id);
    const result = reverseGrant("evt_1", "disputed");
    expect(result).toEqual({ reversed: true, clawedBack: 6, shortfall: 4 });
    expect(balanceOf(WS)).toBe(0);
  });

  it("is itself idempotent, because a dispute webhook can arrive twice", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 100, paymentEventId: "evt_1" });
    reverseGrant("evt_1", "disputed");
    expect(reverseGrant("evt_1", "disputed again").reversed).toBe(false);
    expect(balanceOf(WS)).toBe(0);
  });

  it("does nothing for a payment it never granted", () => {
    expect(reverseGrant("evt_unknown", "x").reversed).toBe(false);
  });
});

describe("credit that runs out of time", () => {
  const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const past = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  it("removes unspent credit once a pack expires", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, expiresAt: past(1) });
    expect(expireGrants()).toBe(2_000);
    expect(balanceOf(WS)).toBe(0);
  });

  it("leaves credit that has not expired", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, expiresAt: future(30) });
    expect(expireGrants()).toBe(0);
    expect(balanceOf(WS)).toBe(2_000);
  });

  it("never takes more than the balance holds", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 10, expiresAt: past(1) });
    for (let i = 0; i < 6; i++) settleCharged(reserve({ workspaceId: WS, requestId: `r${i}` }).id);
    expireGrants();
    expect(balanceOf(WS)).toBe(0);
  });

  it("lists what is about to expire, so the warning emails have something to send", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, expiresAt: future(10) });
    grantCredit({ workspaceId: WS, source: "pack", renders: 500, expiresAt: future(300), paymentEventId: "evt_far" });
    const soon = grantsExpiringWithin(14);
    expect(soon).toHaveLength(1);
    expect(soon[0].unspent).toBe(2_000);
  });

  it("does not list credit that already expired", () => {
    grantCredit({ workspaceId: WS, source: "pack", renders: 2_000, expiresAt: past(1) });
    expect(grantsExpiringWithin(14)).toHaveLength(0);
  });

  it("ignores a plan grant with no expiry", () => {
    grantCredit({ workspaceId: WS, source: "plan_cycle", renders: 250 });
    expect(expireGrants()).toBe(0);
    expect(grantsExpiringWithin(14)).toHaveLength(0);
  });
});

describe("the ledger's own health", () => {
  it("reports healthy when the database answers", () => {
    expect(ledgerHealthy()).toBe(true);
  });
});
