import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clearSession, currentAccount } from "@/lib/auth/session";
import { describeBilling } from "@/lib/billing/status";
import { logStripeError, stripeClient } from "@/lib/billing/stripe";
import { TERMINAL_STATUSES } from "@/lib/billing/sync";
import { db } from "@/lib/db";
import { apiKeys, authTokens, deletedCustomers, rateLimits, renders, usageEvents, users, workspaces } from "@/lib/db/schema";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";
import { readJsonBody, rejectCrossSiteJson } from "@/lib/security/request";

/** Deletion is irreversible and password-guarded; a few attempts per hour is all a real person needs. */
const ATTEMPTS_PER_USER_PER_HOUR = 5;
const ATTEMPTS_PER_IP_PER_HOUR = 10;
/** The body carries only an email and a password. */
const MAX_BODY_BYTES = 4 * 1024;

const deleteSchema = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(128),
});

const tooMany = (retryAfterSeconds: number) =>
  NextResponse.json({ error: "Too many deletion attempts. Try again later." }, { status: 429, headers: { "retry-after": String(retryAfterSeconds) } });

/** Ids are [A-Za-z0-9_-], and `_` is a LIKE wildcard: escape it so one user's prefix cannot match another's. */
const likeEscaped = (value: string) => value.replace(/[\\%_]/g, (character) => `\\${character}`);

const stillBilling = (error: string) => NextResponse.json({ error, manageBillingUrl: "/dashboard" }, { status: 409 });

/**
 * Is Stripe still billing this customer? The local columns are a cache of webhook deliveries and lag
 * two modelled states the dashboard itself renders: checkout completed with the webhook not yet landed
 * (stripeSubscriptionId is still null), and `incomplete` while 3-D Secure is pending — which can still
 * become active. The checkout route already distrusts the local record for exactly this reason.
 *
 * Returns the blocking subscription's status, or null when Stripe says there is nothing live. Throws
 * when Stripe cannot be consulted: the caller fails closed rather than orphaning a paying subscription.
 */
async function liveSubscriptionStatus(customerId: string): Promise<string | null> {
  const stripe = stripeClient();
  const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
  // Anything not terminal can still charge the card, `incomplete` included.
  return existing.data.find((subscription) => !TERMINAL_STATUSES.has(subscription.status))?.status ?? null;
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteJson(request);
  if (rejected) return rejected;
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { user, workspace } = account;

  const ipLimit = consumeRateLimit(`account-delete-ip:${clientIp(request)}`, ATTEMPTS_PER_IP_PER_HOUR, HOUR);
  if (!ipLimit.allowed) return tooMany(ipLimit.retryAfterSeconds);
  const userLimit = consumeRateLimit(`account-delete-user:${user.id}`, ATTEMPTS_PER_USER_PER_HOUR, HOUR);
  if (!userLimit.allowed) return tooMany(userLimit.retryAfterSeconds);

  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Type your account email and password to confirm." }, { status: 400 });
  // Stored emails are lower-cased at sign-up; surrounding whitespace comes from copy-and-paste, not intent.
  if (parsed.data.email.trim().toLowerCase() !== user.email) {
    return NextResponse.json({ error: "That email does not match this account. Type it exactly to confirm." }, { status: 400 });
  }
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "That password is not correct." }, { status: 401 });
  }

  // A live subscription keeps billing: cancelling it is Stripe's job, not something this route should do silently.
  if (describeBilling(workspace).hasLiveSubscription) {
    return stillBilling("Cancel your subscription before deleting the account, so you are not billed again. Open billing management from the dashboard, cancel, then come back.");
  }
  // The local columns said nothing is live. Ask Stripe, which is the only authority on whether a card
  // is still being charged, and refuse if it cannot answer — a wrong "yes, delete" bills a customer who
  // no longer has an account, or a portal link, to stop it with.
  if (workspace.stripeCustomerId) {
    let status: string | null;
    try {
      status = await liveSubscriptionStatus(workspace.stripeCustomerId);
    } catch (error) {
      logStripeError("Account deletion blocked: could not confirm subscription state with Stripe", error);
      return stillBilling("We could not confirm with Stripe that your subscription has ended, so the account was not deleted. Check billing from the dashboard and try again in a few minutes.");
    }
    if (status) {
      console.info(`[account-delete-blocked] workspace=${workspace.id} stripeStatus=${status}`);
      return stillBilling("Stripe still shows a subscription on this account, so deleting now would keep billing you. Open billing management from the dashboard, cancel there, then come back.");
    }
  }

  db.transaction((tx) => {
    const owned = tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.ownerId, user.id)).all();
    // Rows would cascade from users anyway, but deleting them explicitly does not depend on the foreign_keys pragma.
    for (const { id } of owned) {
      tx.delete(renders).where(eq(renders.workspaceId, id)).run();
      tx.delete(usageEvents).where(eq(usageEvents.workspaceId, id)).run();
      tx.delete(apiKeys).where(eq(apiKeys.workspaceId, id)).run();
    }
    // Minimal billing tombstone: no email, no name, nothing but the Stripe handle. Without it a
    // subscription that slipped through leaves nobody able to find the customer to cancel or refund.
    if (workspace.stripeCustomerId) {
      tx.insert(deletedCustomers)
        .values({ stripeCustomerId: workspace.stripeCustomerId, workspaceId: workspace.id, deletedAt: new Date().toISOString() })
        .onConflictDoNothing()
        .run();
    }
    tx.delete(workspaces).where(eq(workspaces.ownerId, user.id)).run();
    tx.delete(authTokens).where(eq(authTokens.userId, user.id)).run();
    // rate_limits is the one table the account routes write personal data into: these keys tie this
    // user id to the IP they used. The pure-IP buckets stay — dropping them would reset the limit.
    tx.delete(rateLimits).where(eq(rateLimits.key, `account-delete-user:${user.id}`)).run();
    tx.delete(rateLimits).where(sql`${rateLimits.key} LIKE ${`account-export:${likeEscaped(user.id)}:%`} ESCAPE '\\'`).run();
    tx.delete(users).where(eq(users.id, user.id)).run();
  });
  // Identifiers only: no email, name or chart content in the log.
  console.info(`[account-deleted] user=${user.id} workspace=${workspace.id}`);

  // The account is already gone, so a failure to drop the cookie cannot make the session usable again.
  try {
    await clearSession();
  } catch (error) {
    console.error("Clearing the session cookie after account deletion failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true, deleted: true });
}
