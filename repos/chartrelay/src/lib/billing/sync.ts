import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deletedCustomers, stripeEvents, workspaces } from "@/lib/db/schema";
import { grantPackCredit, reversePackCredit } from "./packs";
import { ENTITLED_STATUSES, customerIdOf, planForPrice, stripeClient } from "./stripe";

type Workspace = typeof workspaces.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Stripe subscription states that are final: such a subscription can never become active again. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["canceled", "incomplete_expired"]);

const isoFromUnix = (value: number | null | undefined) => (value ? new Date(value * 1000).toISOString() : null);

/**
 * A price this deployment does not recognize cannot be priced into a plan, so the workspace stays on Free.
 * When Stripe is nonetheless charging for it, that is a configuration mistake only a human can fix, and the
 * customer is paying for limits they are not getting: page on it with the same tag as the other billing alerts.
 */
function reportUnrecognizedPrice(subscription: Stripe.Subscription, priceId: string, entitled: boolean) {
  const detail = `Stripe subscription ${subscription.id} uses price ${priceId}, which is neither STRIPE_PRICE_PRO nor STRIPE_PRICE_SCALE.`;
  if (!entitled) {
    console.warn(`${detail} Status ${subscription.status}; no paid access was granted.`);
    return;
  }
  console.error(`[billing-alert] ACTION REQUIRED: ${detail} It is ${subscription.status}, so the customer is being billed while the workspace is held on Free: point STRIPE_PRICE_PRO or STRIPE_PRICE_SCALE at this price, or move the customer onto a configured price in the Stripe Dashboard.`);
}

/** Derives the local billing columns from an authoritative Stripe subscription. */
export function billingStateFromSubscription(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const pricePlan = planForPrice(item?.price.id);
  const entitled = ENTITLED_STATUSES.has(subscription.status);
  if (!pricePlan && item) reportUnrecognizedPrice(subscription, item.price.id, entitled);
  const cancelAt = subscription.cancel_at ?? (subscription.cancel_at_period_end ? item?.current_period_end : null);
  return {
    stripeCustomerId: customerIdOf(subscription.customer),
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    // The current price is the only thing that grants a paid plan. `subscription.metadata.plan` is written
    // once at Checkout and is never rewritten when the price changes in the Portal, so using it as a fallback
    // handed Business limits to a subscription whose price we no longer recognize. Price unknown means Free.
    plan: entitled && pricePlan ? pricePlan : "free",
    currentPeriodEnd: isoFromUnix(item?.current_period_end),
    cancelAt: subscription.status === "canceled" ? isoFromUnix(subscription.ended_at ?? subscription.canceled_at) : isoFromUnix(cancelAt),
  } as const;
}

function findWorkspace(tx: Tx | typeof db, subscription: Stripe.Subscription, hintedWorkspaceId?: string | null): Workspace | undefined {
  const workspaceId = subscription.metadata?.workspaceId ?? hintedWorkspaceId;
  if (workspaceId) {
    const byId = tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
    if (byId) return byId;
  }
  const customerId = customerIdOf(subscription.customer);
  return customerId ? tx.select().from(workspaces).where(eq(workspaces.stripeCustomerId, customerId)).get() : undefined;
}

/**
 * A workspace paying for two subscriptions at once needs a human: one of them should be refunded and canceled.
 * Logged at error level with a stable tag so log-based alerting can page on it.
 */
export function reportDuplicateSubscriptions(workspaceId: string, subscriptionIds: string[]) {
  console.error(`[billing-alert] ACTION REQUIRED: workspace ${workspaceId} has multiple entitled Stripe subscriptions (${[...new Set(subscriptionIds)].join(", ")}). The customer may be double-charged; cancel and refund the duplicate in the Stripe Dashboard.`);
}

export type ApplyResult = "updated" | "ignored-stale" | "ignored-no-workspace" | "ignored-deleted-account" | "ignored-customer-mismatch";

/**
 * Newest Stripe event `created` (unix seconds) already applied for a subscription id.
 *
 * Stripe's own ordering signal, carried so that an older delivery can never overwrite a newer one even when
 * the two apply outside the per-subscription lock below — a snapshot reaches the database from the Checkout
 * route as well, and the lock only covers this process. Process-local and therefore best-effort: losing it
 * (restart, eviction) only costs the backstop, never the lock or the stored monotonic guards.
 */
const lastAppliedEventCreated = new Map<string, number>();
const MAX_TRACKED_SUBSCRIPTIONS = 5_000;

function rememberEventOrder(subscriptionId: string, created: number) {
  // Re-inserting moves the key to the end, so the eviction below drops the least recently written.
  lastAppliedEventCreated.delete(subscriptionId);
  lastAppliedEventCreated.set(subscriptionId, created);
  while (lastAppliedEventCreated.size > MAX_TRACKED_SUBSCRIPTIONS) {
    lastAppliedEventCreated.delete(lastAppliedEventCreated.keys().next().value!);
  }
}

/**
 * True when this snapshot can only be an older view of the subscription the workspace already stores.
 * Both signals are monotonic in Stripe and are read from the stored row, so they hold without the lock:
 * a subscription never leaves a terminal status, and its current period end never moves backwards.
 * They cannot order two snapshots taken inside one billing period (a Pro↔Business switch) — that is what the
 * lock and the event-ordering watermark are for.
 */
function isStaleSnapshot(workspace: Workspace, subscription: Stripe.Subscription, currentPeriodEnd: string | null) {
  if (workspace.stripeSubscriptionId !== subscription.id) return false;
  const stored = workspace.subscriptionStatus;
  if (stored && TERMINAL_STATUSES.has(stored) && !TERMINAL_STATUSES.has(subscription.status)) return true;
  // ISO-8601 UTC strings sort chronologically.
  return Boolean(workspace.currentPeriodEnd && currentPeriodEnd && currentPeriodEnd < workspace.currentPeriodEnd);
}

/**
 * Writes a subscription's state onto its workspace. Must run inside a transaction.
 * Out-of-order safety comes from always passing a freshly retrieved subscription, plus three guards that all
 * prefer the newer state: the stored monotonic signals above, the event-ordering watermark (when the caller
 * knows which Stripe event produced this snapshot), and the per-subscription lock in processStripeEvent.
 */
export function applySubscription(tx: Tx | typeof db, subscription: Stripe.Subscription, hintedWorkspaceId?: string | null, eventCreated?: number | null): ApplyResult {
  const workspace = findWorkspace(tx, subscription, hintedWorkspaceId);
  if (!workspace) {
    const customerId = customerIdOf(subscription.customer);
    const tombstone = customerId ? tx.select().from(deletedCustomers).where(eq(deletedCustomers.stripeCustomerId, customerId)).get() : undefined;
    if (tombstone) {
      // Actionable, unlike a bare "no workspace": the account is gone, so a subscription still charging
      // this customer has nobody to serve and must be cancelled (and refunded) in the Stripe Dashboard.
      const live = !TERMINAL_STATUSES.has(subscription.status);
      const message = `Stripe subscription ${subscription.id} belongs to customer ${customerId}, whose account was deleted on ${tombstone.deletedAt} (workspace ${tombstone.workspaceId}).`;
      if (live) console.error(`[billing-alert] ACTION REQUIRED: ${message} It is still ${subscription.status}: cancel and refund it in the Stripe Dashboard.`);
      else console.info(`${message} Status ${subscription.status}; nothing to do.`);
      return "ignored-deleted-account";
    }
    console.warn(`No workspace matches Stripe subscription ${subscription.id}.`);
    return "ignored-no-workspace";
  }
  const state = billingStateFromSubscription(subscription);
  if (workspace.stripeCustomerId && state.stripeCustomerId && workspace.stripeCustomerId !== state.stripeCustomerId) {
    console.warn(`Stripe subscription ${subscription.id} belongs to a different customer than workspace ${workspace.id}.`);
    return "ignored-customer-mismatch";
  }
  if (isStaleSnapshot(workspace, subscription, state.currentPeriodEnd)) return "ignored-stale";
  const applied = lastAppliedEventCreated.get(subscription.id);
  if (eventCreated != null && applied != null && eventCreated < applied) return "ignored-stale";
  const isCurrent = !workspace.stripeSubscriptionId || workspace.stripeSubscriptionId === subscription.id;
  if (!isCurrent) {
    const incomingEntitled = ENTITLED_STATUSES.has(subscription.status);
    const currentEntitled = workspace.subscriptionStatus ? ENTITLED_STATUSES.has(workspace.subscriptionStatus) : false;
    // A non-entitled update about some other subscription must never downgrade the workspace's current one.
    if (!incomingEntitled) return "ignored-stale";
    if (currentEntitled) reportDuplicateSubscriptions(workspace.id, [workspace.stripeSubscriptionId!, subscription.id]);
  }
  tx.update(workspaces).set(state).where(eq(workspaces.id, workspace.id)).run();
  // Recorded next to the write. A rollback after this point can only leave the watermark too high for an
  // event Stripe will redeliver with the same `created`, and the comparison above is strict, so the retry
  // still applies.
  if (eventCreated != null) rememberEventOrder(subscription.id, eventCreated);
  return "updated";
}

export type EventOutcome = { status: "processed"; result?: ApplyResult } | { status: "duplicate" } | { status: "ignored-type" };

function isProcessed(eventId: string) {
  return Boolean(db.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, eventId)).get());
}

/**
 * Process-local mutex, keyed by subscription id, as a chain of promises.
 *
 * ChartRelay runs as one server process on purpose — better-sqlite3 is synchronous and the database is a
 * local file — so every webhook delivery for a subscription is handled here and this chain is real mutual
 * exclusion for this deployment: no Redis, no advisory lock, nothing external. It exists because the
 * transaction alone could not provide it. The transaction only dedupes event ids, while the Stripe retrieve
 * happens before it: two deliveries for one subscription could each fetch a snapshot concurrently, and
 * whichever committed last won, so a slower delivery holding the pre-switch Business snapshot could overwrite
 * the newer Pro state and leave the customer paying $59 with Business's 100,000 renders.
 *
 * If this is ever deployed as more than one process the lock stops covering the whole system; the guards in
 * applySubscription are written to stand on their own for exactly that case.
 */
const subscriptionLocks = new Map<string, Promise<void>>();

function withSubscriptionLock<T>(subscriptionId: string | null, run: () => Promise<T>): Promise<T> {
  if (!subscriptionId) return run();
  const previous = subscriptionLocks.get(subscriptionId) ?? Promise.resolve();
  const result = previous.then(run, run);
  // The chain must outlive a failed delivery, so the next waiter sees a settled promise either way.
  const tail = result.then(() => {}, () => {});
  subscriptionLocks.set(subscriptionId, tail);
  void tail.then(() => {
    if (subscriptionLocks.get(subscriptionId) === tail) subscriptionLocks.delete(subscriptionId);
  });
  return result;
}

/** The subscription an event is about, known before any Stripe call so it can key the lock. */
function lockKeyOf(event: Stripe.Event): string | null {
  if (event.type === "checkout.session.completed") return customerIdOf(event.data.object.subscription);
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    return event.data.object.id;
  }
  return null;
}

/**
 * Idempotently processes one verified Stripe event.
 * Retrieving from Stripe and applying the result are serialized per subscription, so a delivery always reads
 * a snapshot at least as new as the one already stored; the duplicate check, workspace update and event
 * record then commit in one SQLite transaction.
 * Throws on transient failures so the webhook returns 5xx and Stripe retries.
 */
export async function processStripeEvent(event: Stripe.Event, stripe: Stripe = stripeClient()): Promise<EventOutcome> {
  if (isProcessed(event.id)) return { status: "duplicate" };
  return withSubscriptionLock(lockKeyOf(event), () => applyStripeEvent(event, stripe));
}

/**
 * One-time pack payments, which carry no subscription. Credit lives in the ledger, whose own transaction and
 * unique payment id make a repeat delivery harmless, so this runs before (not inside) the event-record
 * transaction: if recording the event then fails, Stripe retries and the second grant is a no-op.
 */
function applyPackEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    if (session.mode !== "payment" || session.metadata?.kind !== "pack") return;
    // A delayed payment method completes the session unpaid; the async_payment_succeeded event grants it later.
    if (session.payment_status !== "paid") return;
    const workspaceId = session.metadata?.workspaceId ?? session.client_reference_id;
    const paymentId = customerIdOf(session.payment_intent);
    if (!workspaceId || !paymentId) throw new Error(`Pack session ${session.id} has no workspace or payment intent.`);
    if (grantPackCredit(workspaceId, "stripe", paymentId) === "no-workspace") console.error(`Pack payment ${paymentId} is for a workspace that no longer exists; nothing granted.`);
  } else if (event.type === "charge.dispute.created") {
    // A chargeback is the customer taking the money back through their bank. The credit goes with it, and if some
    // was already spent the shortfall is a real loss that a person has to see, not a line in an audit table.
    const paymentId = customerIdOf(event.data.object.payment_intent);
    if (!paymentId) return;
    const result = reversePackCredit("stripe", paymentId, "dispute");
    if (result.reversed && result.shortfall > 0) console.error(`[billing-alert] dispute on ${paymentId}: ${result.shortfall} render(s) were already spent and could not be taken back.`);
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentId = customerIdOf(charge.payment_intent);
    // A partial refund returns part of the money, not the pack. Only a full refund takes the credit back.
    if (paymentId && charge.refunded === true) reversePackCredit("stripe", paymentId, "refund");
  }
}

async function applyStripeEvent(event: Stripe.Event, stripe: Stripe): Promise<EventOutcome> {
  applyPackEvent(event);
  // Stripe orders its events for one object by `created`; carried so an older delivery loses on a tie-free
  // comparison even if it somehow applies outside the lock above.
  const eventCreated = typeof event.created === "number" ? event.created : null;
  let subscription: Stripe.Subscription | null = null;
  let hintedWorkspaceId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const subscriptionId = customerIdOf(session.subscription);
    hintedWorkspaceId = session.metadata?.workspaceId ?? session.client_reference_id;
    if (session.mode === "subscription" && subscriptionId) subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    // Re-fetch so that late or reordered deliveries converge on Stripe's current state.
    subscription = await stripe.subscriptions.retrieve(event.data.object.id);
  }

  // When a subscription stops being entitled, the customer may still pay for another one (for example after a
  // duplicate checkout). Adopt that one instead of downgrading a paying workspace to Free.
  let replacement: Stripe.Subscription | null = null;
  const customerId = subscription ? customerIdOf(subscription.customer) : null;
  if (subscription && customerId && !ENTITLED_STATUSES.has(subscription.status)) {
    const others = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    replacement = others.data.find((other) => other.id !== subscription!.id && ENTITLED_STATUSES.has(other.status)) ?? null;
  }

  return db.transaction((tx) => {
    if (tx.select({ id: stripeEvents.id }).from(stripeEvents).where(eq(stripeEvents.id, event.id)).get()) return { status: "duplicate" } as const;
    let result = subscription ? applySubscription(tx, subscription, hintedWorkspaceId, eventCreated) : undefined;
    if (replacement) {
      const workspace = findWorkspace(tx, replacement, hintedWorkspaceId);
      // Only when the workspace was tracking the subscription that just ended (or nothing); never switch away
      // from a different, still-current subscription.
      const sameCustomer = !workspace?.stripeCustomerId || workspace.stripeCustomerId === customerId;
      if (workspace && sameCustomer && (!workspace.stripeSubscriptionId || workspace.stripeSubscriptionId === subscription!.id)) {
        tx.update(workspaces).set(billingStateFromSubscription(replacement)).where(eq(workspaces.id, workspace.id)).run();
        result = "updated";
      }
    }
    tx.insert(stripeEvents).values({ id: event.id, type: event.type, processedAt: new Date().toISOString() }).run();
    return HANDLED_EVENT_TYPES.has(event.type) ? { status: "processed", result } as const : { status: "ignored-type" } as const;
  });
}
