import { NextResponse } from "next/server";
import Stripe from "stripe";
import { logStripeError, webhookSecret } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/sync";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = webhookSecret();
  if (!secret) {
    console.error("Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  let event: Stripe.Event;
  try {
    // Signature verification needs the exact raw body; never parse JSON before this call.
    event = Stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }
  try {
    const outcome = await processStripeEvent(event);
    return NextResponse.json({ received: true, ...(outcome.status === "duplicate" ? { skipped: true } : {}) });
  } catch (error) {
    // Not recorded as processed, so Stripe will retry delivery.
    logStripeError(`Stripe webhook processing failed for ${event.type} ${event.id}`, error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
