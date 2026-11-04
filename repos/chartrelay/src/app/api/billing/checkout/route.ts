import { NextResponse } from "next/server";
import { rejectAmbientCrossSite } from "@/lib/security/request";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { currentAccount } from "@/lib/auth/session";
import { BLOCKING_STATUSES, BillingConfigError, logStripeError, type PaidPlan, priceForPlan, stripeClient } from "@/lib/billing/stripe";
import { applySubscription } from "@/lib/billing/sync";
import { db } from "@/lib/db";
import { paymentProvider } from "@/lib/billing/provider";
import { recordActivation } from "@/lib/metrics/activation";
import { workspaces } from "@/lib/db/schema";

const requestSchema = z.union([
  z.object({ plan: z.enum(["developer", "pro", "business"]) }),
  z.object({ pack: z.literal(true) }),
]);

// Workspaces with a checkout being prepared right now. Process-local, which is sufficient for the intentional
// single-server deployment: it serializes the list-expire-create sequence so concurrent requests cannot each
// create a payable session.
const inFlight = new Set<string>();

const unavailable = () => NextResponse.json({ error: "Billing is not available right now. Please try again later." }, { status: 503 });

export async function POST(request: Request) {
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan or a render pack." }, { status: 400 });
  if ("pack" in parsed.data) return startPackCheckout(account, process.env.APP_URL ?? new URL(request.url).origin);
  const { plan } = parsed.data;
  // The intent, not the outcome. A checkout that Stripe later declines still tells us this person
  // decided to pay, which is the step the funnel is asking about.
  recordActivation(account.workspace.id, "checkout_start", plan);
  const price = priceForPlan(plan);
  if (!price) {
    console.error(`Checkout unavailable: STRIPE_PRICE_${plan.toUpperCase()} is not configured.`);
    return unavailable();
  }
  const workspace = account.workspace;
  if (inFlight.has(workspace.id)) return NextResponse.json({ error: "Checkout is already starting in another tab. Please wait a moment." }, { status: 409 });
  inFlight.add(workspace.id);
  try {
    return await startCheckout(workspace, account.user, plan, price, process.env.APP_URL ?? new URL(request.url).origin);
  } finally {
    inFlight.delete(workspace.id);
  }
}

type Account = NonNullable<Awaited<ReturnType<typeof currentAccount>>>;

async function startCheckout(workspace: Account["workspace"], user: Account["user"], plan: PaidPlan, price: string, appUrl: string) {
  try {
    const stripe = stripeClient();
    const portalFor = async (customer: string) => {
      const portal = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl}/dashboard` });
      return NextResponse.json({ url: portal.url, existingSubscription: true });
    };

    // Fast path: the local record already shows a live subscription. `incomplete` counts — the first invoice
    // stays payable for about 23 hours — and the Portal is where that customer retries the payment or changes
    // the plan, so blocking a second Checkout never leaves them without a way forward.
    // A blocking status with no customer id is an inconsistent local record, not a dead end: fall through to
    // the idempotent customer lookup below, which re-asks Stripe and still ends at the Portal.
    if (workspace.stripeCustomerId && workspace.stripeSubscriptionId && workspace.subscriptionStatus && BLOCKING_STATUSES.has(workspace.subscriptionStatus)) {
      return await portalFor(workspace.stripeCustomerId);
    }

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      // The idempotency key collapses concurrent first-time checkouts onto one Stripe customer.
      const customer = await stripe.customers.create(
        { email: user.email, name: user.name, metadata: { workspaceId: workspace.id } },
        { idempotencyKey: `chartrelay-customer-${workspace.id}` },
      );
      db.update(workspaces).set({ stripeCustomerId: customer.id }).where(and(eq(workspaces.id, workspace.id), isNull(workspaces.stripeCustomerId))).run();
      customerId = db.select({ id: workspaces.stripeCustomerId }).from(workspaces).where(eq(workspaces.id, workspace.id)).get()?.id ?? customer.id;
    }

    // Authoritative check against Stripe in case a webhook has not arrived yet. BLOCKING_STATUSES is the
    // complement of TERMINAL_STATUSES, so an `incomplete` subscription still counts as live here: paying its
    // first invoice would otherwise turn a second Checkout into a second charging subscription.
    const liveSubscription = async (customer: string) => {
      const existing = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
      return existing.data.find((subscription) => BLOCKING_STATUSES.has(subscription.status));
    };
    const live = await liveSubscription(customerId);
    if (live) {
      // applySubscription never lets this (possibly older) snapshot undo a newer terminal state.
      db.transaction((tx) => { applySubscription(tx, live, workspace.id); });
      return await portalFor(customerId);
    }

    // Expire older open sessions so two browser tabs cannot both complete payment.
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 20 });
    const expired = await Promise.allSettled(open.data.map((session) => stripe.checkout.sessions.expire(session.id)));
    // A session that could not be expired may be mid-payment; do not hand out a second payable session.
    if (expired.some((outcome) => outcome.status === "rejected")) {
      return NextResponse.json({ error: "Another checkout for this workspace is still in progress. Finish or close it, then try again." }, { status: 409 });
    }
    // A session may have completed between the first check and the expiry.
    if (open.data.length) {
      const completed = await liveSubscription(customerId);
      if (completed) {
        db.transaction((tx) => { applySubscription(tx, completed, workspace.id); });
        return await portalFor(customerId);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: workspace.id,
      metadata: { workspaceId: workspace.id, plan },
      subscription_data: { metadata: { workspaceId: workspace.id, plan } },
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/pricing?billing=cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    logStripeError("Stripe checkout failed", error);
    if (error instanceof BillingConfigError) return unavailable();
    return NextResponse.json({ error: "We could not start checkout. Please try again." }, { status: 502 });
  }
}

/**
 * A render pack is a one-time payment, so none of the subscription guards apply: it can be bought with no plan,
 * on top of one, and more than once. Duplicate purchases are the customer's choice, and a double click is
 * harmless because each completed payment grants exactly once, keyed by its own payment id.
 */
async function startPackCheckout(account: Account, appUrl: string) {
  const { workspace, user } = account;
  recordActivation(workspace.id, "checkout_start", "pack");
  try {
    const { url } = await paymentProvider().createPackCheckout({
      workspaceId: workspace.id, email: user.email, name: user.name, stripeCustomerId: workspace.stripeCustomerId, appUrl,
    });
    return NextResponse.json({ url });
  } catch (error) {
    logStripeError("Pack checkout failed", error);
    if (error instanceof BillingConfigError) return unavailable();
    return NextResponse.json({ error: "We could not start checkout. Please try again." }, { status: 502 });
  }
}
