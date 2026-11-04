import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

// Stripe network calls are fully mocked; signatures are generated and verified locally with a fake secret.
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
const { deletedCustomers, stripeEvents, users, workspaces } = await import("@/lib/db/schema");
const { stripeClient, BillingConfigError } = await import("@/lib/billing/stripe");
const checkout = await import("@/app/api/billing/checkout/route");
const portal = await import("@/app/api/billing/portal/route");
const webhook = await import("@/app/api/billing/webhook/route");

const WEBHOOK_SECRET = "whsec_unitTestSigningSecret";
const PERIOD_END = 1_893_456_000; // 2030-01-01

function seedWorkspace(id: string, overrides: Partial<typeof workspaces.$inferInsert> = {}) {
  const now = new Date().toISOString();
  db.insert(users).values({ id: `user_${id}`, email: `${id}@example.com`, passwordHash: "x", name: "Test User", createdAt: now }).run();
  db.insert(workspaces).values({ id, ownerId: `user_${id}`, name: "Test workspace", createdAt: now, ...overrides }).run();
}

function workspace(id: string) {
  return db.select().from(workspaces).where(eq(workspaces.id, id)).get()!;
}

function signIn(id: string) {
  const ws = workspace(id);
  const user = db.select().from(users).where(eq(users.id, ws.ownerId)).get()!;
  session.currentAccount.mockResolvedValue({ user, workspace: ws });
}

function subscription(overrides: Record<string, unknown> = {}, price = "price_test_pro") {
  return {
    id: "sub_1", object: "subscription", customer: "cus_1", status: "active",
    metadata: { workspaceId: "ws_1", plan: "pro" },
    cancel_at: null, cancel_at_period_end: false, canceled_at: null, ended_at: null,
    items: { data: [{ price: { id: price }, current_period_end: PERIOD_END }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function event(id: string, type: string, object: Record<string, unknown>) {
  return { id, object: "event", type, data: { object } };
}

function signedRequest(payload: unknown, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return new Request("http://localhost:3000/api/billing/webhook", { method: "POST", body, headers: { "stripe-signature": signature, "content-type": "application/json" } });
}

function checkoutRequest(plan: string) {
  return new Request("http://localhost:3000/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }), headers: { "content-type": "application/json" } });
}

const checkoutCompleted = (id = "evt_checkout") => event(id, "checkout.session.completed", { id: "cs_1", object: "checkout.session", mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "ws_1", metadata: { workspaceId: "ws_1", plan: "pro" } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  db.delete(deletedCustomers).run();
  db.delete(stripeEvents).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  vi.mocked(stripeClient).mockImplementation(() => stripeMock as unknown as Stripe);
  stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
  stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
  stripeMock.checkout.sessions.list.mockResolvedValue({ data: [] });
  stripeMock.checkout.sessions.expire.mockResolvedValue({});
  stripeMock.subscriptions.retrieve.mockReset();
  stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" });
  stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/p/session/test" });
  seedWorkspace("ws_1");
});

describe("POST /api/billing/checkout", () => {
  it("rejects unauthenticated requests", async () => {
    session.currentAccount.mockResolvedValue(null);
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(401);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("rejects unknown plans", async () => {
    signIn("ws_1");
    expect((await checkout.POST(checkoutRequest("enterprise"))).status).toBe(400);
  });

  it("returns 503 without calling Stripe when the price is not configured", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(503);
    expect(stripeClient).not.toHaveBeenCalled();
  });

  it("returns 503 without internals when the Stripe key is missing", async () => {
    vi.mocked(stripeClient).mockImplementation(() => { throw new BillingConfigError("STRIPE_SECRET_KEY is missing."); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("STRIPE_SECRET_KEY");
  });

  it("creates one customer and a Business Checkout Session with the Business price", async () => {
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [{ id: "cs_stale" }] });
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("business"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_new" });
    expect(stripeMock.customers.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: { workspaceId: "ws_1" } }), { idempotencyKey: "chartrelay-customer-ws_1" });
    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith("cs_stale");
    const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
    expect(params).toMatchObject({ customer: "cus_new", mode: "subscription", line_items: [{ price: "price_test_business", quantity: 1 }], client_reference_id: "ws_1", metadata: { workspaceId: "ws_1", plan: "business" }, subscription_data: { metadata: { workspaceId: "ws_1", plan: "business" } } });
    expect(params).not.toHaveProperty("payment_method_types");
    expect(params).not.toHaveProperty("automatic_tax");
    expect(workspace("ws_1").stripeCustomerId).toBe("cus_new");
  });

  it("uses the Pro price for Pro checkout and reuses an existing customer", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    signIn("ws_1");
    await checkout.POST(checkoutRequest("pro"));
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.create.mock.calls[0][0]).toMatchObject({ customer: "cus_1", line_items: [{ price: "price_test_pro", quantity: 1 }] });
  });

  it("sends a locally active subscriber to the Customer Portal instead of Checkout", async () => {
    db.update(workspaces).set({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("business"));
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/test", existingSubscription: true });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: "cus_1", return_url: "http://localhost:3000/dashboard" });
  });

  it("detects a subscription Stripe knows about before the webhook arrives", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription()] });
    signIn("ws_1");
    const body = await (await checkout.POST(checkoutRequest("pro"))).json();
    expect(body.existingSubscription).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" });
  });

  it("serializes concurrent checkouts for one workspace, so only one payable session exists", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    const slow = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 30));
    stripeMock.subscriptions.list.mockImplementation(() => slow({ data: [] }));
    stripeMock.checkout.sessions.list.mockImplementation(() => slow({ data: [] }));
    signIn("ws_1");
    const [first, second] = await Promise.all([checkout.POST(checkoutRequest("pro")), checkout.POST(checkoutRequest("pro"))]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    // Once the first finishes, a new attempt is allowed again.
    expect((await checkout.POST(checkoutRequest("pro"))).status).toBe(200);
  });

  it("does not create a new session when an open one cannot be expired (it may be mid-payment)", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [{ id: "cs_paying" }] });
    stripeMock.checkout.sessions.expire.mockRejectedValue(new Error("This Checkout Session is already complete."));
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(409);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("re-checks Stripe after expiring open sessions and sends a just-completed payer to the portal", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.subscriptions.list.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: [subscription()] });
    stripeMock.checkout.sessions.list.mockResolvedValue({ data: [{ id: "cs_just_paid" }] });
    signIn("ws_1");
    const body = await (await checkout.POST(checkoutRequest("pro"))).json();
    expect(body.existingSubscription).toBe(true);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("does not let a stale live snapshot undo a stored cancellation", async () => {
    db.update(workspaces).set({ plan: "free", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ status: "past_due" })] });
    signIn("ws_1");
    await checkout.POST(checkoutRequest("pro"));
    expect(workspace("ws_1")).toMatchObject({ plan: "free", subscriptionStatus: "canceled" });
  });

  it("hides Stripe error details from the browser", async () => {
    stripeMock.checkout.sessions.create.mockRejectedValue(new Error("No such price: 'price_internal_detail'"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    signIn("ws_1");
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("price_internal_detail");
  });
});

describe("POST /api/billing/portal", () => {
  it("requires authentication and an existing Stripe customer", async () => {
    session.currentAccount.mockResolvedValue(null);
    expect((await portal.POST(new Request("http://localhost:3000/api/billing/portal", { method: "POST" }))).status).toBe(401);
    signIn("ws_1");
    expect((await portal.POST(new Request("http://localhost:3000/api/billing/portal", { method: "POST" }))).status).toBe(400);
  });

  it("opens the portal for a subscribed customer", async () => {
    db.update(workspaces).set({ stripeCustomerId: "cus_1" }).where(eq(workspaces.id, "ws_1")).run();
    signIn("ws_1");
    const response = await portal.POST(new Request("http://localhost:3000/api/billing/portal", { method: "POST" }));
    expect(await response.json()).toEqual({ url: "https://billing.stripe.com/p/session/test" });
  });
});

describe("POST /api/billing/webhook", () => {
  it("rejects requests with an invalid signature", async () => {
    const response = await webhook.POST(signedRequest(checkoutCompleted(), "whsec_attackerSecret"));
    expect(response.status).toBe(400);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(workspace("ws_1").plan).toBe("free");
  });

  it("rejects unsigned requests", async () => {
    const response = await webhook.POST(new Request("http://localhost:3000/api/billing/webhook", { method: "POST", body: JSON.stringify(checkoutCompleted()) }));
    expect(response.status).toBe(400);
  });

  it("fails closed when the webhook secret is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await webhook.POST(signedRequest(checkoutCompleted()))).status).toBe(503);
  });

  it("upgrades the correct workspace to Pro when Checkout completes", async () => {
    seedWorkspace("ws_other");
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription());
    const response = await webhook.POST(signedRequest(checkoutCompleted()));
    expect(await response.json()).toEqual({ received: true });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active", currentPeriodEnd: "2030-01-01T00:00:00.000Z", cancelAt: null });
    expect(workspace("ws_other").plan).toBe("free");
  });

  it("skips a replayed event without processing it twice", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription());
    await webhook.POST(signedRequest(checkoutCompleted()));
    // Simulate a later legitimate change; a replay of the old event must not overwrite it.
    db.update(workspaces).set({ plan: "business" }).where(eq(workspaces.id, "ws_1")).run();
    const replay = await webhook.POST(signedRequest(checkoutCompleted()));
    expect(await replay.json()).toEqual({ received: true, skipped: true });
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);
    expect(workspace("ws_1").plan).toBe("business");
    expect(db.select().from(stripeEvents).all()).toHaveLength(1);
  });

  it("does not record a failed event, so Stripe's retry is processed", async () => {
    stripeMock.subscriptions.retrieve.mockRejectedValueOnce(new Error("network down")).mockResolvedValue(subscription());
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await webhook.POST(signedRequest(checkoutCompleted()))).status).toBe(500);
    expect(db.select().from(stripeEvents).all()).toHaveLength(0);
    expect((await webhook.POST(signedRequest(checkoutCompleted()))).status).toBe(200);
    expect(workspace("ws_1").plan).toBe("pro");
  });

  it("keeps Pro until the period ends when cancellation is scheduled", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ cancel_at_period_end: true }));
    await webhook.POST(signedRequest(event("evt_cancel_scheduled", "customer.subscription.updated", { id: "sub_1" })));
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", subscriptionStatus: "active", cancelAt: "2030-01-01T00:00:00.000Z" });
  });

  it("reverts the workspace to Free when the subscription is deleted", async () => {
    db.update(workspaces).set({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: "canceled", ended_at: PERIOD_END }));
    await webhook.POST(signedRequest(event("evt_deleted", "customer.subscription.deleted", { id: "sub_1" })));
    expect(workspace("ws_1")).toMatchObject({ plan: "free", subscriptionStatus: "canceled", stripeSubscriptionId: "sub_1" });
  });

  it("uses the authoritative Stripe state when an older event arrives late", async () => {
    // The event payload says active, but Stripe now reports the subscription canceled.
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ status: "canceled" }));
    await webhook.POST(signedRequest(event("evt_old_update", "customer.subscription.updated", { id: "sub_1", status: "active" })));
    expect(workspace("ws_1").plan).toBe("free");
  });

  it("follows a Pro-to-Business switch made in the Customer Portal", async () => {
    db.update(workspaces).set({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    // Metadata still says "pro"; the price is the source of truth.
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({}, "price_test_business"));
    await webhook.POST(signedRequest(event("evt_switch", "customer.subscription.updated", { id: "sub_1" })));
    expect(workspace("ws_1").plan).toBe("business");
  });

  it("ignores a stale cancellation for an older subscription", async () => {
    db.update(workspaces).set({ plan: "business", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ id: "sub_old", status: "canceled" }));
    await webhook.POST(signedRequest(event("evt_old_deleted", "customer.subscription.deleted", { id: "sub_old" })));
    expect(workspace("ws_1")).toMatchObject({ plan: "business", stripeSubscriptionId: "sub_new" });
  });

  it("serializes two deliveries for one subscription and converges on the cancellation", async () => {
    db.update(workspaces).set({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    let releaseOld!: () => void;
    const oldSnapshotReady = new Promise<void>((resolve) => { releaseOld = resolve; });
    stripeMock.subscriptions.retrieve
      // evt_old (subscription.updated) retrieves the pre-cancel snapshot slowly...
      .mockImplementationOnce(async () => { await oldSnapshotReady; return subscription({ status: "active" }); })
      // ...and evt_new (subscription.deleted) waits its turn instead of racing it, then retrieves "canceled".
      .mockImplementationOnce(async () => subscription({ status: "canceled", ended_at: PERIOD_END }));
    const oldDelivery = webhook.POST(signedRequest(event("evt_old", "customer.subscription.updated", { id: "sub_1" })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const newDelivery = webhook.POST(signedRequest(event("evt_new", "customer.subscription.deleted", { id: "sub_1" })));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Retrieve-then-apply is serialized per subscription, so the second delivery has not fetched anything yet
    // and cannot be holding a snapshot older than the state the first is about to write.
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);
    releaseOld();
    expect((await oldDelivery).status).toBe(200);
    expect((await newDelivery).status).toBe(200);
    expect(workspace("ws_1")).toMatchObject({ plan: "free", subscriptionStatus: "canceled" });
    expect(db.select().from(stripeEvents).all()).toHaveLength(2);
  });

  it("adopts the customer's other paid subscription instead of downgrading to Free", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.update(workspaces).set({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_A", subscriptionStatus: "active" }).where(eq(workspaces.id, "ws_1")).run();
    // A duplicate sub_B is adopted...
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(subscription({ id: "sub_B" }));
    await webhook.POST(signedRequest(event("evt_b_created", "customer.subscription.created", { id: "sub_B" })));
    expect(workspace("ws_1").stripeSubscriptionId).toBe("sub_B");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[billing-alert]"));
    // ...then the customer cancels sub_B while sub_A is still active.
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(subscription({ id: "sub_B", status: "canceled", ended_at: PERIOD_END }));
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ id: "sub_B", status: "canceled" }), subscription({ id: "sub_A" })] });
    await webhook.POST(signedRequest(event("evt_b_deleted", "customer.subscription.deleted", { id: "sub_B" })));
    expect(stripeMock.subscriptions.list).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 20 });
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", stripeSubscriptionId: "sub_A", subscriptionStatus: "active" });
  });

  it("names the deleted account, and pages, when a subscription outlives the workspace it paid for", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.delete(workspaces).run();
    db.insert(deletedCustomers).values({ stripeCustomerId: "cus_1", workspaceId: "ws_1", deletedAt: "2026-09-22T10:00:00.000Z" }).run();
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(subscription({ metadata: {} }));
    const response = await webhook.POST(signedRequest(event("evt_orphan", "customer.subscription.updated", { id: "sub_1" })));
    expect(response.status).toBe(200);
    const line = vi.mocked(console.error).mock.calls.at(-1)![0] as string;
    expect(line).toContain("[billing-alert] ACTION REQUIRED");
    expect(line).toContain("cus_1");
    expect(line).toContain("ws_1");
    expect(line).toMatch(/cancel and refund/i);
  });

  it("says nothing alarming when the orphaned subscription is already terminal", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    db.delete(workspaces).run();
    db.insert(deletedCustomers).values({ stripeCustomerId: "cus_1", workspaceId: "ws_1", deletedAt: "2026-09-22T10:00:00.000Z" }).run();
    stripeMock.subscriptions.retrieve.mockResolvedValueOnce(subscription({ metadata: {}, status: "canceled" }));
    await webhook.POST(signedRequest(event("evt_orphan_dead", "customer.subscription.updated", { id: "sub_1" })));
    expect(console.error).not.toHaveBeenCalled();
    expect(vi.mocked(console.info).mock.calls.flat().join(" ")).toContain("nothing to do");
  });

  it("records but ignores unrelated event types", async () => {
    const response = await webhook.POST(signedRequest(event("evt_other", "invoice.paid", { id: "in_1" })));
    expect(response.status).toBe(200);
    expect(stripeMock.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(workspace("ws_1").plan).toBe("free");
  });
});
