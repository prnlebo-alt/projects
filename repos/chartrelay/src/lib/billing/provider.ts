import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { BillingConfigError, packPriceId, stripeClient } from "./stripe";

export interface PackCheckoutInput {
  workspaceId: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
  appUrl: string;
}

/**
 * What the pack purchase needs from a payment provider.
 *
 * The ledger is the only source of truth for credit; a provider just reports that money arrived. Keeping the
 * seam this narrow is what lets Polar replace Stripe Managed Payments without touching the ledger or the
 * routes: a new provider implements this, and its webhook calls `grantPackCredit` with its own payment id.
 */
export interface PaymentProvider {
  readonly name: "stripe" | "polar";
  createPackCheckout(input: PackCheckoutInput): Promise<{ url: string }>;
}

const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createPackCheckout({ workspaceId, email, name, stripeCustomerId, appUrl }) {
    const price = packPriceId();
    if (!price) throw new BillingConfigError("STRIPE_PRICE_PACK is not configured.");
    const stripe = stripeClient();
    let customerId = stripeCustomerId;
    if (!customerId) {
      // Same idempotency key as the subscription path, so the two cannot create two customers for one workspace.
      const customer = await stripe.customers.create({ email, name, metadata: { workspaceId } }, { idempotencyKey: `chartrelay-customer-${workspaceId}` });
      db.update(workspaces).set({ stripeCustomerId: customer.id }).where(and(eq(workspaces.id, workspaceId), isNull(workspaces.stripeCustomerId))).run();
      customerId = db.select({ id: workspaces.stripeCustomerId }).from(workspaces).where(eq(workspaces.id, workspaceId)).get()?.id ?? customer.id;
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: workspaceId,
      metadata: { workspaceId, kind: "pack" },
      payment_intent_data: { metadata: { workspaceId, kind: "pack" } },
      success_url: `${appUrl}/dashboard?billing=pack-success`,
      cancel_url: `${appUrl}/pricing?billing=cancelled`,
    });
    if (!session.url) throw new Error("Stripe returned a Checkout Session without a URL.");
    return { url: session.url };
  },
};

/** The provider selected for this deployment. Polar is the fallback if Managed Payments is not approved. */
export function paymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  const name = env.PAYMENT_PROVIDER ?? "stripe";
  if (name === "stripe") return stripeProvider;
  throw new BillingConfigError(`PAYMENT_PROVIDER "${name}" is not implemented.`);
}
