import Stripe from "stripe";
import { PLAN_ORDER, type Plan } from "@/lib/usage/plans";

/**
 * The paid rungs of the ladder.
 *
 * Derived from the plan table rather than written out, so adding a tier is one edit in one file and
 * the price-ID plumbing below cannot silently fall behind it.
 */
export type PaidPlan = Exclude<Plan, "free">;

/** The environment variable holding each paid plan's price ID. */
export const PRICE_ENV: Record<PaidPlan, string> = {
  developer: "STRIPE_PRICE_DEVELOPER",
  pro: "STRIPE_PRICE_PRO",
  business: "STRIPE_PRICE_BUSINESS",
};

/** The one-time render pack, which is not a plan and is buyable without one. */
export const PACK_PRICE_ENV = "STRIPE_PRICE_PACK";

export const PAID_PLANS = Object.keys(PRICE_ENV) as PaidPlan[];

// Subscription states that keep paid access. past_due keeps access while Stripe retries the card.
// `incomplete` is deliberately absent: nothing has been paid yet, so it grants no paid limits.
export const ENTITLED_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);
/**
 * Subscription states that must block a second Checkout; the customer manages these in the portal.
 *
 * This is the complement of TERMINAL_STATUSES (`canceled`, `incomplete_expired`) — anything Stripe can still
 * turn into a live, charging subscription blocks. `incomplete` is the one that is easy to get wrong: Stripe
 * keeps the first invoice payable for about 23 hours before moving the subscription to `incomplete_expired`,
 * so a second Checkout started in that window creates a second live subscription and double-charges the
 * customer. The account-deletion route already refuses to delete an account while an `incomplete`
 * subscription exists, and these two must not disagree about what "live" means.
 */
export const BLOCKING_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);

const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;

export class BillingConfigError extends Error {}

/** Validates billing environment without ever including secret values in messages. */
export function billingConfigProblems(env: Record<string, string | undefined> = process.env) {
  const problems: string[] = [];
  const key = env.STRIPE_SECRET_KEY ?? "";
  if (!key) problems.push("STRIPE_SECRET_KEY is missing.");
  else if (!SECRET_KEY_PATTERN.test(key)) problems.push("STRIPE_SECRET_KEY must start with sk_test_, rk_test_, sk_live_, or rk_live_.");
  else if (key.includes("_live_") && env.STRIPE_LIVE_MODE !== "enabled") problems.push("STRIPE_SECRET_KEY is a live-mode key but STRIPE_LIVE_MODE is not \"enabled\".");
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) problems.push("STRIPE_WEBHOOK_SECRET is missing.");
  else if (!webhookSecret.startsWith("whsec_")) problems.push("STRIPE_WEBHOOK_SECRET must start with whsec_.");
  // The pack is included: a deployment that can sell subscriptions but not packs is half-configured,
  // and the half that is missing is the one a pay-as-you-go customer needs.
  for (const name of [...Object.values(PRICE_ENV), PACK_PRICE_ENV]) {
    const value = env[name] ?? "";
    if (!value) problems.push(`${name} is missing.`);
    else if (!value.startsWith("price_")) problems.push(`${name} must be a Stripe price ID starting with price_.`);
  }
  return problems;
}

export function stripeClient() {
  const problems = billingConfigProblems().filter((problem) => problem.startsWith("STRIPE_SECRET_KEY"));
  if (problems.length) throw new BillingConfigError(problems.join(" "));
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export function webhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  return secret?.startsWith("whsec_") ? secret : null;
}

export function priceForPlan(plan: PaidPlan) {
  const price = process.env[PRICE_ENV[plan]];
  return price?.startsWith("price_") ? price : null;
}

export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  // Walked in ladder order so that two plans sharing a price ID — a misconfiguration, but a possible
  // one — resolve to the cheaper of the two rather than to whichever happened to be checked first.
  for (const plan of PLAN_ORDER) {
    if (plan !== "free" && priceId === process.env[PRICE_ENV[plan as PaidPlan]]) return plan as PaidPlan;
  }
  return null;
}

/** The render pack's price ID, or null when packs are not configured on this deployment. */
export function packPriceId(): string | null {
  const price = process.env[PACK_PRICE_ENV];
  return price?.startsWith("price_") ? price : null;
}

export function customerIdOf(value: string | { id: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Server-side log line for a Stripe failure. Never includes request payloads or keys. */
export function logStripeError(context: string, error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    console.error(`${context}: ${error.type}${error.code ? ` (${error.code})` : ""}${error.requestId ? ` request=${error.requestId}` : ""}`);
  } else if (error instanceof BillingConfigError) {
    console.error(`${context}: billing configuration invalid. ${error.message}`);
  } else {
    console.error(`${context}:`, error instanceof Error ? error.message : error);
  }
}
