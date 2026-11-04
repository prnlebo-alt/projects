import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

// Every Stripe call is mocked; webhook payloads are signed and verified locally with the fake test secret.
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
const { stripeEvents, users, workspaces } = await import("@/lib/db/schema");
const { applySubscription } = await import("@/lib/billing/sync");
const checkout = await import("@/app/api/billing/checkout/route");
const webhook = await import("@/app/api/billing/webhook/route");

const WEBHOOK_SECRET = "whsec_unitTestSigningSecret";
const PERIOD_END = 1_893_456_000; // 2030-01-01
const PERIOD_END_ISO = "2030-01-01T00:00:00.000Z";
const PORTAL_URL = "https://billing.stripe.com/p/session/test";
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_new";

function workspace(id: string) {
  return db.select().from(workspaces).where(eq(workspaces.id, id)).get()!;
}

function setWorkspace(overrides: Partial<typeof workspaces.$inferInsert>) {
  db.update(workspaces).set(overrides).where(eq(workspaces.id, "ws_1")).run();
}

function signIn() {
  const ws = workspace("ws_1");
  const user = db.select().from(users).where(eq(users.id, ws.ownerId)).get()!;
  session.currentAccount.mockResolvedValue({ user, workspace: ws });
}

function subscription(overrides: Record<string, unknown> = {}, price = "price_test_pro", periodEnd = PERIOD_END) {
  return {
    id: "sub_1", object: "subscription", customer: "cus_1", status: "active",
    // Metadata is written once at Checkout and never rewritten: no test below may rely on it.
    metadata: { workspaceId: "ws_1", plan: "business" },
    cancel_at: null, cancel_at_period_end: false, canceled_at: null, ended_at: null,
    items: { data: [{ price: { id: price }, current_period_end: periodEnd }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

const subscriptionEvent = (id: string, subscriptionId: string, created: number) =>
  ({ id, object: "event", type: "customer.subscription.updated", created, data: { object: { id: subscriptionId, object: "subscription" } } });

function signedRequest(payload: unknown) {
  const body = JSON.stringify(payload);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
  return new Request("http://localhost:3000/api/billing/webhook", { method: "POST", body, headers: { "stripe-signature": signature, "content-type": "application/json" } });
}

const checkoutRequest = (plan: string) =>
  new Request("http://localhost:3000/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }), headers: { "content-type": "application/json" } });

/** Lets every pending microtask and timer callback run, so an unblocked delivery reaches its commit. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  db.delete(stripeEvents).run();
  db.delete(workspaces).run();
  db.delete(users).run();
  const now = new Date().toISOString();
  db.insert(users).values({ id: "user_1", email: "race@example.com", passwordHash: "x", name: "Test User", createdAt: now }).run();
  db.insert(workspaces).values({ id: "ws_1", ownerId: "user_1", name: "Test workspace", createdAt: now }).run();
  stripeMock.customers.create.mockResolvedValue({ id: "cus_new" });
  stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
  stripeMock.subscriptions.retrieve.mockReset();
  stripeMock.checkout.sessions.list.mockResolvedValue({ data: [] });
  stripeMock.checkout.sessions.expire.mockResolvedValue({});
  stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_new", url: CHECKOUT_URL });
  stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: PORTAL_URL });
});

/**
 * Codex's reproduction: two customer.subscription.updated deliveries for one subscription. The slower one
 * had already retrieved the pre-switch snapshot, so whichever committed last won and the workspace ended up
 * on the plan the customer had just left.
 */
describe("concurrent subscription webhooks", () => {
  async function raceDeliveries(subscriptionId: string, slowPrice: string, fastPrice: string) {
    let release!: () => void;
    const slowSnapshotReleased = new Promise<void>((resolve) => { release = resolve; });
    stripeMock.subscriptions.retrieve
      // The first delivery retrieves the stale snapshot and is still waiting for Stripe to answer...
      .mockImplementationOnce(async () => { await slowSnapshotReleased; return subscription({ id: subscriptionId }, slowPrice); })
      // ...while the second retrieves the state Stripe reports now.
      .mockImplementationOnce(async () => subscription({ id: subscriptionId }, fastPrice));
    const slow = webhook.POST(signedRequest(subscriptionEvent("evt_older", subscriptionId, 1_700_000_000)));
    await settle();
    const fast = webhook.POST(signedRequest(subscriptionEvent("evt_newer", subscriptionId, 1_700_000_060)));
    await settle();
    release();
    return { slow: await slow, fast: await fast };
  }

  it("does not let a slow Business snapshot overwrite the newer Pro state", async () => {
    setWorkspace({ plan: "business", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_downgrade", subscriptionStatus: "active", currentPeriodEnd: PERIOD_END_ISO });
    const { slow, fast } = await raceDeliveries("sub_downgrade", "price_test_business", "price_test_pro");
    expect([slow.status, fast.status]).toEqual([200, 200]);
    // The customer switched to Pro: $59 must not buy Business's 100,000 renders.
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", subscriptionStatus: "active", stripeSubscriptionId: "sub_downgrade" });
    expect(db.select().from(stripeEvents).all()).toHaveLength(2);
  });

  it("does not let a slow Pro snapshot overwrite the newer Business state", async () => {
    setWorkspace({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_upgrade", subscriptionStatus: "active", currentPeriodEnd: PERIOD_END_ISO });
    const { slow, fast } = await raceDeliveries("sub_upgrade", "price_test_pro", "price_test_business");
    expect([slow.status, fast.status]).toEqual([200, 200]);
    // The mirror image: an upgrade the customer paid for must not be rolled back to Pro limits.
    expect(workspace("ws_1")).toMatchObject({ plan: "business", subscriptionStatus: "active", stripeSubscriptionId: "sub_upgrade" });
    expect(db.select().from(stripeEvents).all()).toHaveLength(2);
  });

  it("retrieves the second delivery's snapshot only after the first has been applied", async () => {
    setWorkspace({ plan: "business", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_serial", subscriptionStatus: "active" });
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    stripeMock.subscriptions.retrieve
      .mockImplementationOnce(async () => { await held; return subscription({ id: "sub_serial" }, "price_test_business"); })
      .mockImplementationOnce(async () => subscription({ id: "sub_serial" }, "price_test_pro"));
    const first = webhook.POST(signedRequest(subscriptionEvent("evt_first", "sub_serial", 1_700_001_000)));
    await settle();
    const second = webhook.POST(signedRequest(subscriptionEvent("evt_second", "sub_serial", 1_700_001_060)));
    await settle();
    // The second delivery is queued behind the first: it has not asked Stripe anything yet, so it cannot be
    // holding a snapshot older than what the first is about to write.
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(2);
  });
});

/** The guards live in applySubscription, so they hold for callers that do not go through the lock. */
describe("out-of-order snapshots applied outside the lock", () => {
  it("ignores a snapshot from a strictly older Stripe event", () => {
    setWorkspace({ stripeCustomerId: "cus_1" });
    expect(applySubscription(db, subscription({ id: "sub_watermark" }, "price_test_pro"), "ws_1", 1_700_000_100)).toBe("updated");
    expect(workspace("ws_1").plan).toBe("pro");

    expect(applySubscription(db, subscription({ id: "sub_watermark" }, "price_test_business"), "ws_1", 1_700_000_040)).toBe("ignored-stale");
    expect(workspace("ws_1").plan).toBe("pro");

    // A redelivery of the same event is not strictly older, so Stripe's retries still converge.
    expect(applySubscription(db, subscription({ id: "sub_watermark" }, "price_test_business"), "ws_1", 1_700_000_100)).toBe("updated");
    expect(workspace("ws_1").plan).toBe("business");
  });

  it("never moves a subscription's period end backwards", () => {
    setWorkspace({ plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_period", subscriptionStatus: "active", currentPeriodEnd: PERIOD_END_ISO });
    const previousPeriod = subscription({ id: "sub_period" }, "price_test_business", PERIOD_END - 30 * 86_400);
    expect(applySubscription(db, previousPeriod, "ws_1")).toBe("ignored-stale");
    expect(workspace("ws_1")).toMatchObject({ plan: "pro", currentPeriodEnd: PERIOD_END_ISO });
  });
});

/** README: the price is authoritative. Metadata is written once at Checkout and never rewritten. */
describe("plan mapping from the subscription price", () => {
  it("holds a subscription on an unrecognized price at Free instead of trusting its metadata", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setWorkspace({ plan: "business", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_price", subscriptionStatus: "active" });
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ id: "sub_price" }, "price_retired_in_dashboard"));

    const response = await webhook.POST(signedRequest(subscriptionEvent("evt_unknown_price", "sub_price", 1_700_002_000)));

    expect(response.status).toBe(200);
    expect(workspace("ws_1")).toMatchObject({ plan: "free", subscriptionStatus: "active" });
    const logged = error.mock.calls.flat().join(" ");
    expect(logged).toContain("[billing-alert]");
    expect(logged).toContain("price_retired_in_dashboard");
    expect(logged).toMatch(/STRIPE_PRICE_PRO/);
  });

  it("only warns when nothing is being charged for the unrecognized price", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setWorkspace({ stripeCustomerId: "cus_1" });
    applySubscription(db, subscription({ id: "sub_dead_price", status: "incomplete_expired" }, "price_retired_in_dashboard"), "ws_1");
    expect(error).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toContain("price_retired_in_dashboard");
    expect(workspace("ws_1").plan).toBe("free");
  });

  it("still follows the price when metadata names a different plan", async () => {
    setWorkspace({ plan: "free", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_meta", subscriptionStatus: "active" });
    // metadata.plan is "business" for every subscription built here; the Pro price must win.
    stripeMock.subscriptions.retrieve.mockResolvedValue(subscription({ id: "sub_meta" }, "price_test_pro"));
    await webhook.POST(signedRequest(subscriptionEvent("evt_meta", "sub_meta", 1_700_003_000)));
    expect(workspace("ws_1").plan).toBe("pro");
  });
});

/**
 * Stripe keeps an `incomplete` subscription's first invoice payable for about 23 hours, so a second Checkout
 * in that window creates a second charging subscription. The account-deletion route already treats
 * `incomplete` as live; checkout must agree.
 */
describe("checkout while a subscription is incomplete", () => {
  it("sends a workspace whose stored subscription is incomplete to the Portal without asking Stripe", async () => {
    setWorkspace({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_incomplete", subscriptionStatus: "incomplete" });
    signIn();
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(await response.json()).toEqual({ url: PORTAL_URL, existingSubscription: true });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    expect(stripeMock.subscriptions.list).not.toHaveBeenCalled();
  });

  it("blocks a second Checkout when Stripe reports an incomplete subscription the webhook has not landed yet", async () => {
    setWorkspace({ stripeCustomerId: "cus_1" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ id: "sub_incomplete", status: "incomplete" })] });
    signIn();
    const response = await checkout.POST(checkoutRequest("business"));
    expect(await response.json()).toEqual({ url: PORTAL_URL, existingSubscription: true });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
    // Incomplete is not entitled, so blocking Checkout must not hand out paid limits either.
    expect(workspace("ws_1")).toMatchObject({ plan: "free", subscriptionStatus: "incomplete", stripeSubscriptionId: "sub_incomplete" });
  });

  it("lets a customer whose incomplete subscription expired start a new Checkout", async () => {
    setWorkspace({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_dead", subscriptionStatus: "incomplete_expired" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ id: "sub_dead", status: "incomplete_expired" })] });
    signIn();
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(await response.json()).toEqual({ url: CHECKOUT_URL });
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("recovers instead of dead-ending when the local record claims a live subscription but has no customer id", async () => {
    setWorkspace({ plan: "pro", stripeSubscriptionId: "sub_orphan", subscriptionStatus: "active", stripeCustomerId: null });
    stripeMock.customers.create.mockResolvedValue({ id: "cus_recovered" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [subscription({ id: "sub_orphan", customer: "cus_recovered" })] });
    signIn();
    const response = await checkout.POST(checkoutRequest("pro"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: PORTAL_URL, existingSubscription: true });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
