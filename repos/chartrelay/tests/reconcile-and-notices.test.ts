import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Email } from "@/lib/email/send";

const { db } = await import("@/lib/db");
const { auditLog, balances, creditGrants, users, workspaces } = await import("@/lib/db/schema");
const { balanceOf, grantCredit, reserve } = await import("@/lib/ledger/ledger");
const { reconcilePacks } = await import("@/lib/billing/reconcile");
const { grantPackCredit } = await import("@/lib/billing/packs");
const { sendExpiryNotices } = await import("@/lib/billing/expiry-notices");

const NOW = new Date("2026-10-09T12:00:00Z");

function seed(id = "ws1") {
  const at = NOW.toISOString();
  db.insert(users).values({ id: `u_${id}`, email: `${id}@example.com`, name: "Pat Example", passwordHash: "x", createdAt: at }).run();
  db.insert(workspaces).values({ id, ownerId: `u_${id}`, name: "W", createdAt: at }).run();
}

beforeEach(() => {
  db.delete(auditLog).run(); db.delete(creditGrants).run(); db.delete(balances).run(); db.delete(workspaces).run(); db.delete(users).run();
});

const paidSession = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1", mode: "payment", payment_status: "paid", payment_intent: "pi_1", client_reference_id: "ws1", created: Math.floor(NOW.getTime() / 1000) - 3600,
  metadata: { workspaceId: "ws1", kind: "pack" }, ...overrides,
});
function fakeStripe(sessions: unknown[], refunded = false) {
  const list = vi.fn(() => ({ async *[Symbol.asyncIterator]() { for (const s of sessions) yield s; } }));
  const retrieve = vi.fn(async () => ({ latest_charge: { refunded } }));
  return { stripe: { checkout: { sessions: { list } }, paymentIntents: { retrieve } } as unknown as Stripe, list, retrieve };
}

describe("reconciliation: a webhook that never arrived", () => {
  it("grants a paid pack that has no credit, and says so", async () => {
    seed();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { stripe } = fakeStripe([paidSession()]);
    expect(await reconcilePacks({ stripe, now: NOW })).toEqual({ checked: 1, granted: 1, skipped: 0 });
    expect(balanceOf("ws1")).toBe(2000);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("webhook never delivered"));
  });

  it("does nothing for a payment the webhook already handled, however often it runs", async () => {
    seed();
    grantPackCredit("ws1", "stripe", "pi_1");
    const { stripe, retrieve } = fakeStripe([paidSession()]);
    for (let i = 0; i < 3; i++) expect((await reconcilePacks({ stripe, now: NOW })).granted).toBe(0);
    expect(balanceOf("ws1")).toBe(2000);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("does not resurrect a pack whose payment was refunded before it was ever credited", async () => {
    seed();
    const { stripe } = fakeStripe([paidSession()], true);
    expect(await reconcilePacks({ stripe, now: NOW })).toEqual({ checked: 1, granted: 0, skipped: 1 });
    expect(balanceOf("ws1")).toBe(0);
  });

  it("ignores unpaid sessions, subscriptions, and payments that are not packs", async () => {
    seed();
    const { stripe } = fakeStripe([paidSession({ payment_status: "unpaid" }), paidSession({ mode: "subscription", payment_intent: "pi_2" }), paidSession({ metadata: { workspaceId: "ws1" }, payment_intent: "pi_3" })]);
    expect((await reconcilePacks({ stripe, now: NOW })).checked).toBe(0);
    expect(balanceOf("ws1")).toBe(0);
  });

  it("skips, and logs, a payment for a workspace that was deleted", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { stripe } = fakeStripe([paidSession({ client_reference_id: "ghost", metadata: { workspaceId: "ghost", kind: "pack" } })]);
    expect(await reconcilePacks({ stripe, now: NOW })).toMatchObject({ granted: 0, skipped: 1 });
  });

  it("asks Stripe only about the window and customer it was given", async () => {
    seed();
    const { stripe, list } = fakeStripe([]);
    await reconcilePacks({ stripe, now: NOW, sinceDays: 1, customer: "cus_9" });
    expect(list).toHaveBeenCalledWith({ created: { gte: Math.floor(NOW.getTime() / 1000) - 86_400 }, limit: 100, customer: "cus_9" });
  });
});

describe("pack expiry notices", () => {
  const pack = (id: string, expiresAt: string, renders = 2000) => grantCredit({ workspaceId: "ws1", source: "pack", renders, expiresAt, paymentEventId: id });
  const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

  it("emails 14 days out, once, and again at 3 days, once", async () => {
    seed();
    pack("stripe:a", days(13));
    const send = vi.fn(async (_email: Email) => {});
    expect(await sendExpiryNotices(NOW, send)).toBe(1);
    expect(await sendExpiryNotices(new Date(NOW.getTime() + 3600_000), send)).toBe(0);
    expect(await sendExpiryNotices(new Date(NOW.getTime() + 11 * 86_400_000), send)).toBe(1);
    expect(await sendExpiryNotices(new Date(NOW.getTime() + 11.5 * 86_400_000), send)).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "ws1@example.com", kind: "transactional" });
    expect(send.mock.calls[0][0].text).toContain("2,000 renders");
  });

  it("sends only the 3-day notice to a pack first seen inside three days", async () => {
    seed();
    pack("stripe:a", days(2));
    const send = vi.fn(async (_email: Email) => {});
    await sendExpiryNotices(NOW, send);
    await sendExpiryNotices(new Date(NOW.getTime() + 1 * 86_400_000), send);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("says nothing about a pack that is spent, not near expiry, or a monthly allowance", async () => {
    seed();
    pack("stripe:far", days(60));
    pack("stripe:spent", days(5), 1);
    reserve({ workspaceId: "ws1", requestId: "r1" });
    grantCredit({ workspaceId: "ws1", source: "plan_cycle", renders: 5000, expiresAt: days(5), paymentEventId: "allowance:x" });
    const send = vi.fn(async (_email: Email) => {});
    expect(await sendExpiryNotices(NOW, send)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("retries next pass when the email fails, and does not mark it sent", async () => {
    seed();
    pack("stripe:a", days(10));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn(async (_email: Email) => { throw new Error("provider down"); });
    expect(await sendExpiryNotices(NOW, failing)).toBe(0);
    const working = vi.fn(async (_email: Email) => {});
    expect(await sendExpiryNotices(new Date(NOW.getTime() + 3600_000), working)).toBe(1);
  });
});
