import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

// Mocks the seam the code actually calls (stripeClient), so a failure injected here reaches the route.
const stripeMock = vi.hoisted(() => ({
  customers: { create: vi.fn() },
  subscriptions: { retrieve: vi.fn(), list: vi.fn() },
  checkout: { sessions: { create: vi.fn(), list: vi.fn(), expire: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
}));
const session = vi.hoisted(() => ({ currentAccount: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ currentAccount: session.currentAccount }));
vi.mock("@/lib/billing/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/stripe")>();
  return { ...actual, stripeClient: vi.fn(() => stripeMock) };
});

const { db } = await import("@/lib/db");
const { auditLog, creditGrants, balances, stripeEvents, users, workspaces } = await import("@/lib/db/schema");
const { balanceOf, reserve } = await import("@/lib/ledger/ledger");
const { RENDER_PACK } = await import("@/lib/usage/plans");
const { BillingConfigError } = await import("@/lib/billing/stripe");
const { paymentProvider } = await import("@/lib/billing/provider");
const checkout = await import("@/app/api/billing/checkout/route");
const webhook = await import("@/app/api/billing/webhook/route");

const SECRET = "whsec_unitTestSigningSecret";

function seed(id: string, overrides: Partial<typeof workspaces.$inferInsert> = {}) {
  const now = new Date().toISOString();
  db.insert(users).values({ id: `user_${id}`, email: `${id}@example.com`, passwordHash: "x", name: "Test User", createdAt: now }).run();
  db.insert(workspaces).values({ id, ownerId: `user_${id}`, name: "Test workspace", createdAt: now, ...overrides }).run();
  const ws = db.select().from(workspaces).where(eq(workspaces.id, id)).get()!;
  const user = db.select().from(users).where(eq(users.id, ws.ownerId)).get()!;
  session.currentAccount.mockResolvedValue({ user, workspace: ws });
}

const checkoutRequest = (body: unknown) =>
  new Request("http://localhost:3000/api/billing/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

function signed(payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  return new Request("http://localhost:3000/api/billing/webhook", { method: "POST", body, headers: { "stripe-signature": signature, "content-type": "application/json" } });
}

const packSession = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_pack", object: "checkout.session", mode: "payment", payment_status: "paid", payment_intent: "pi_1",
  customer: "cus_1", client_reference_id: "ws_1", metadata: { workspaceId: "ws_1", kind: "pack" }, ...overrides,
});
const event = (id: string, type: string, object: Record<string, unknown>) => ({ id, object: "event", type, data: { object } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  db.delete(auditLog).run();
  db.delete(creditGrants).run();
  db.delete(balances).run();
  db.delete(stripeEvents).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
  stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" });
});

describe("pack checkout", () => {
  it("rejects an anonymous caller", async () => {
    session.currentAccount.mockResolvedValue(null);
    expect((await checkout.POST(checkoutRequest({ pack: true }))).status).toBe(401);
  });

  it("opens a one-time payment, not a subscription, for a workspace with no plan", async () => {
    seed("ws_1");
    const response = await checkout.POST(checkoutRequest({ pack: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_new" });
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0]).toMatchObject({
      mode: "payment", customer: "cus_new", line_items: [{ price: "price_test_pack", quantity: 1 }],
      metadata: { workspaceId: "ws_1", kind: "pack" }, payment_intent_data: { metadata: { workspaceId: "ws_1", kind: "pack" } },
    });
    expect(stripeMock.subscriptions.list).not.toHaveBeenCalled();
  });

  it("is not blocked by a live subscription: packs are overage for subscribers", async () => {
    seed("ws_1", { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" });
    const response = await checkout.POST(checkoutRequest({ pack: true }));
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_new" });
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it("answers 503 when the pack price is not configured, and never calls Stripe", async () => {
    vi.stubEnv("STRIPE_PRICE_PACK", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("ws_1");
    expect((await checkout.POST(checkoutRequest({ pack: true }))).status).toBe(503);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("answers 502 when Stripe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("ws_1");
    stripeMock.checkout.sessions.create.mockRejectedValue(new Error("boom"));
    expect((await checkout.POST(checkoutRequest({ pack: true }))).status).toBe(502);
  });

  it("still validates the body", async () => {
    seed("ws_1");
    expect((await checkout.POST(checkoutRequest({ pack: false }))).status).toBe(400);
    expect((await checkout.POST(checkoutRequest({}))).status).toBe(400);
  });
});

describe("pack webhook", () => {
  it("grants the pack once, expiring in twelve months", async () => {
    seed("ws_1");
    const response = await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    expect(response.status).toBe(200);
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders);
    const grant = db.select().from(creditGrants).get()!;
    expect(grant).toMatchObject({ source: "pack", renders: RENDER_PACK.renders, paymentEventId: "stripe:pi_1" });
    const months = (new Date(grant.expiresAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4);
    expect(months).toBeGreaterThan(11.5);
    expect(months).toBeLessThan(12.5);
  });

  it("grants once when the same event is delivered twice", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders);
  });

  it("grants once when two different events describe the same payment", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    await webhook.POST(signed(event("evt_2", "checkout.session.async_payment_succeeded", packSession())));
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders);
    expect(db.select().from(creditGrants).all()).toHaveLength(1);
  });

  it("grants nothing for a session that completed unpaid, then grants when the payment lands", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession({ payment_status: "unpaid" }))));
    expect(balanceOf("ws_1")).toBe(0);
    await webhook.POST(signed(event("evt_2", "checkout.session.async_payment_succeeded", packSession())));
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders);
  });

  it("grants a second pack for a second payment", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    await webhook.POST(signed(event("evt_2", "checkout.session.completed", packSession({ id: "cs_2", payment_intent: "pi_2" }))));
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders * 2);
  });

  it("ignores a payment-mode session that is not a pack", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession({ metadata: { workspaceId: "ws_1" } }))));
    expect(balanceOf("ws_1")).toBe(0);
  });

  it("does not throw for a workspace that no longer exists", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession({ client_reference_id: "ws_gone", metadata: { workspaceId: "ws_gone", kind: "pack" } }))));
    expect(response.status).toBe(200);
    expect(db.select().from(creditGrants).all()).toHaveLength(0);
  });

  it("returns 500 so Stripe retries when the payment cannot be identified", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    seed("ws_1");
    const response = await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession({ payment_intent: null }))));
    expect(response.status).toBe(500);
    expect(db.select().from(stripeEvents).all()).toHaveLength(0);
  });

  it("takes back unspent credit on refund, never going below zero", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    // Spend 10 renders before the refund arrives.
    for (let i = 0; i < 10; i++) expect(reserve({ workspaceId: "ws_1", units: 1, requestId: `req_${i}`, idempotencyKey: `k_${i}` })).toBeTruthy();
    const response = await webhook.POST(signed(event("evt_2", "charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_1", refunded: true })));
    expect(response.status).toBe(200);
    expect(balanceOf("ws_1")).toBe(0);
    expect(db.select().from(auditLog).all().some((row) => row.action === "credit.reverse")).toBe(true);
  });

  it("ignores a refund for a charge that was not a pack", async () => {
    seed("ws_1");
    const response = await webhook.POST(signed(event("evt_1", "charge.refunded", { id: "ch_9", object: "charge", payment_intent: "pi_other" })));
    expect(response.status).toBe(200);
    expect(db.select().from(auditLog).all()).toHaveLength(0);
  });
});

describe("payment provider selection", () => {
  it("defaults to Stripe", () => {
    expect(paymentProvider({}).name).toBe("stripe");
  });
  it("refuses a provider that is not built yet rather than silently using Stripe", () => {
    expect(() => paymentProvider({ PAYMENT_PROVIDER: "polar" })).toThrow(BillingConfigError);
  });
});

describe("partial refunds", () => {
  it("leaves the pack alone when only part of the payment is refunded", async () => {
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    await webhook.POST(signed(event("evt_2", "charge.refunded", { id: "ch_1", object: "charge", payment_intent: "pi_1", refunded: false, amount_refunded: 300 })));
    expect(balanceOf("ws_1")).toBe(RENDER_PACK.renders);
  });
});

describe("disputes", () => {
  it("takes back the unspent credit when a chargeback opens, and raises an alert for what was spent", async () => {
    const alert = vi.spyOn(console, "error").mockImplementation(() => {});
    seed("ws_1");
    await webhook.POST(signed(event("evt_1", "checkout.session.completed", packSession())));
    for (let i = 0; i < 5; i++) reserve({ workspaceId: "ws_1", units: 1, requestId: `d${i}` });
    const response = await webhook.POST(signed(event("evt_2", "charge.dispute.created", { id: "dp_1", object: "dispute", payment_intent: "pi_1" })));
    expect(response.status).toBe(200);
    expect(balanceOf("ws_1")).toBe(0);
    expect(alert.mock.calls.some((call) => String(call[0]).includes("[billing-alert]"))).toBe(true);
  });
});
