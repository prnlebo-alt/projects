import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  });
  return stripeInstance;
}

export async function createCheckoutSession({
  userId,
  userEmail,
  priceId,
  successUrl,
  cancelUrl,
}: {
  userId:     string;
  userEmail:  string;
  priceId:    string;
  successUrl: string;
  cancelUrl:  string;
}): Promise<string> {
  const stripe  = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode:               'subscription',
    payment_method_types: ['card'],
    customer_email:     userEmail,
    line_items:         [{ price: priceId, quantity: 1 }],
    success_url:        successUrl,
    cancel_url:         cancelUrl,
    metadata:           { userId },
  });
  return session.url!;
}

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl:  string;
}): Promise<string> {
  const stripe  = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: returnUrl,
  });
  return session.url;
}
