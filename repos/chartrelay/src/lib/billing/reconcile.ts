import type Stripe from "stripe";
import { customerIdOf, stripeClient } from "./stripe";
import { grantPackCredit, packAlreadyGranted } from "./packs";

export interface ReconcileResult {
  checked: number;
  granted: number;
  skipped: number;
}

/**
 * Finds paid pack checkouts whose credit never arrived, and grants it.
 *
 * The webhook is the fast path, but a delivery can fail for longer than Stripe keeps retrying, or the endpoint can
 * be misconfigured, and then the customer has paid and has nothing. Asking Stripe what was actually paid is the
 * only fix that does not depend on the thing that broke. It grants through the same ledger call as the webhook, so
 * a payment the webhook already handled is a no-op, and it logs every grant it makes: a reconciliation that
 * quietly repairs things hides the fact that deliveries are failing.
 *
 * `customer` narrows it to one person, for the page they land on after paying; without it, every recent pack payment.
 */
export async function reconcilePacks(options: { sinceDays?: number; customer?: string | null; stripe?: Stripe; now?: Date } = {}): Promise<ReconcileResult> {
  const { sinceDays = 3, customer = null, now = new Date() } = options;
  const stripe = options.stripe ?? stripeClient();
  const created = Math.floor((now.getTime() - sinceDays * 86_400_000) / 1000);
  const result: ReconcileResult = { checked: 0, granted: 0, skipped: 0 };

  for await (const session of stripe.checkout.sessions.list({ created: { gte: created }, limit: 100, ...(customer ? { customer } : {}) })) {
    if (session.mode !== "payment" || session.metadata?.kind !== "pack" || session.payment_status !== "paid") continue;
    const workspaceId = session.metadata?.workspaceId ?? session.client_reference_id;
    const paymentId = customerIdOf(session.payment_intent);
    if (!workspaceId || !paymentId) continue;
    result.checked += 1;
    if (packAlreadyGranted("stripe", paymentId)) continue;

    // Not granted yet. Before granting, make sure the money is still there: a refund that arrived before its
    // payment was ever credited must not be undone by the repair.
    const intent = await stripe.paymentIntents.retrieve(paymentId, { expand: ["latest_charge"] });
    const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (charge?.refunded) { result.skipped += 1; continue; }

    const outcome = grantPackCredit(workspaceId, "stripe", paymentId, new Date(session.created * 1000));
    if (outcome === "granted") {
      result.granted += 1;
      console.warn(`[reconcile] granted a pack for ${paymentId} (workspace ${workspaceId}): its webhook never delivered.`);
    } else if (outcome === "no-workspace") {
      result.skipped += 1;
      console.error(`[reconcile] payment ${paymentId} is for workspace ${workspaceId}, which no longer exists.`);
    }
  }
  return result;
}
