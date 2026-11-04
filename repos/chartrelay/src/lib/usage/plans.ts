/**
 * The plan ladder, with no database import.
 *
 * src/lib/usage/limits.ts imports the database, so a client component that pulled the numbers from
 * there would drag better-sqlite3 into the browser bundle. Anything rendered on the client imports
 * these constants instead, which keeps a single source of truth for the figures we advertise.
 *
 * These are the figures in docs/BILLING_SPEC.md. They replace an earlier three-tier ladder
 * (free 1,000 / pro $29 / scale $99); "scale" survives only as a legacy value that existing rows may
 * still carry until the data migration has run everywhere.
 */

export const PLANS = {
  free: { renders: 250, priceUsd: 0, watermark: true, label: "Free" },
  developer: { renders: 5_000, priceUsd: 19, watermark: false, label: "Developer" },
  pro: { renders: 25_000, priceUsd: 59, watermark: false, label: "Pro" },
  business: { renders: 100_000, priceUsd: 149, watermark: false, label: "Business" },
} as const;

export type Plan = keyof typeof PLANS;

export const PLAN_ORDER: Plan[] = ["free", "developer", "pro", "business"];

/** Monthly renders by plan. Kept as its own map because the pricing page prints it directly. */
export const planLimits = Object.fromEntries(
  PLAN_ORDER.map((plan) => [plan, PLANS[plan].renders]),
) as Record<Plan, number>;

/**
 * A render pack: one-time, works with or without a plan.
 *
 * Priced above every plan's per-render rate on purpose, so that a customer buying packs repeatedly is
 * being steered toward a subscription rather than quietly overpaying.
 */
export const RENDER_PACK = { renders: 2_000, priceUsd: 10, expiryMonths: 12 } as const;

/**
 * Plans whose renders carry no mark.
 *
 * A pay-as-you-go account with pack credit also renders unmarked — that is a property of having
 * credit, not of having a subscription, so the check lives with the ledger rather than here.
 */
export const UNMARKED_PLANS = new Set<string>(PLAN_ORDER.filter((plan) => !PLANS[plan].watermark));

/**
 * What an unverified free account may render.
 *
 * Zero, deliberately. The spec makes email verification a condition of the free tier, and the abuse
 * section asks for verification *before a key is issued* — a free tier that works without it is the
 * free-tier farming the rest of the design is trying to prevent. The account still exists and can
 * verify at any time; it simply has no credit until it does.
 */
export const UNVERIFIED_FREE_LIMIT = 0;

/** Legacy plan values that may still exist in rows written before the ladder was renamed. */
const LEGACY_PLANS: Record<string, Plan> = { scale: "business" };

/** The current plan for any stored value, including ones written by an older build. */
export function normalisePlan(plan: string | null | undefined): Plan {
  if (plan && plan in PLANS) return plan as Plan;
  if (plan && plan in LEGACY_PLANS) return LEGACY_PLANS[plan];
  return "free";
}

export function limitFor(plan: string, emailVerified: boolean) {
  const current = normalisePlan(plan);
  return current === "free" && !emailVerified ? UNVERIFIED_FREE_LIMIT : planLimits[current];
}

export const formatLimit = (value: number) => value.toLocaleString("en-US");
