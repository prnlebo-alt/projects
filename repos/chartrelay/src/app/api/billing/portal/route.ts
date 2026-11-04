import { NextResponse } from "next/server";
import { rejectAmbientCrossSite } from "@/lib/security/request";
import { currentAccount } from "@/lib/auth/session";
import { BillingConfigError, logStripeError, stripeClient } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  const refused = rejectAmbientCrossSite(request);
  if (refused) return refused;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!account.workspace.stripeCustomerId) return NextResponse.json({ error: "No billing account exists yet. Choose a plan first." }, { status: 400 });
  try {
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const session = await stripeClient().billingPortal.sessions.create({ customer: account.workspace.stripeCustomerId, return_url: `${appUrl}/dashboard` });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    logStripeError("Stripe billing portal failed", error);
    if (error instanceof BillingConfigError) return NextResponse.json({ error: "Billing is not available right now. Please try again later." }, { status: 503 });
    return NextResponse.json({ error: "We could not open billing management. Please try again." }, { status: 502 });
  }
}
