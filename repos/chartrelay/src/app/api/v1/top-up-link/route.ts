import { NextResponse } from "next/server";
import { guardV1, v1Error } from "@/lib/auth/v1-auth";
import { BillingConfigError, logStripeError } from "@/lib/billing/stripe";
import { paymentProvider } from "@/lib/billing/provider";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ApiError, responseHeaders, topUpUrl } from "@/lib/http/errors";
import { consumeRateLimit, MINUTE } from "@/lib/security/rate-limit";

/**
 * A link for the human to open. The agent never pays: this returns a URL and nothing else, and the purchase
 * happens in the person's own browser. When a pack checkout cannot be opened (packs are not on sale yet, or
 * the provider is down) it falls back to the top-up page, which always exists.
 */
export async function GET(request: Request) {
  const guarded = await guardV1(request, "usage:read");
  if ("response" in guarded) return guarded.response;
  const { auth, requestId } = guarded;
  // Each call can open a Stripe Checkout Session, and a session is a payable object that lives for a day, so this
  // is far tighter than the shared read limit: a leaked read-only key cannot mint sessions by the thousand.
  const limit = consumeRateLimit(`top-up:${auth.workspace.id}`, 5, 60 * MINUTE);
  if (!limit.allowed) return v1Error(new ApiError("rate_limited", "Too many top-up links requested. Reuse the last one.", { retryAfterSeconds: limit.retryAfterSeconds }), requestId);
  const headers = responseHeaders(requestId);
  const fallback = () => NextResponse.json({ url: topUpUrl(), kind: "page", request_id: requestId }, { headers });
  const owner = db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, auth.workspace.ownerId)).get();
  if (!owner) return fallback();
  try {
    const { url } = await paymentProvider().createPackCheckout({
      workspaceId: auth.workspace.id, email: owner.email, name: owner.name,
      stripeCustomerId: auth.workspace.stripeCustomerId, appUrl: (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, ""),
    });
    return NextResponse.json({ url, kind: "checkout", request_id: requestId }, { headers });
  } catch (error) {
    if (!(error instanceof BillingConfigError)) logStripeError("Top-up link checkout failed", error);
    return fallback();
  }
}
