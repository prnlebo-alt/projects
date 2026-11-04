import { limitFor, normalisePlan, planLimits, PLANS } from "@/lib/usage/limits";
import { BLOCKING_STATUSES } from "./stripe";

type BillingFields = {
  plan: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
};

export type BillingSummary = {
  planLabel: string;
  statusLabel: string;
  tone: "neutral" | "good" | "warning" | "danger";
  detail: string;
  canManage: boolean;
  hasLiveSubscription: boolean;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/** Plain-language billing state for the dashboard and pricing pages. */
export function describeBilling(workspace: BillingFields, emailVerified = true): BillingSummary {
  // Read through the plan table rather than a chain of comparisons, so a new rung on the ladder cannot
  // be silently labelled "Free" here. normalisePlan also maps the retired "scale" rows to Business.
  const planLabel = PLANS[normalisePlan(workspace.plan)].label;
  const status = workspace.subscriptionStatus;
  const canManage = Boolean(workspace.stripeCustomerId);
  const hasLiveSubscription = Boolean(workspace.stripeSubscriptionId && status && BLOCKING_STATUSES.has(status));
  const base = { planLabel, canManage, hasLiveSubscription };
  const cancelAt = workspace.cancelAt && new Date(workspace.cancelAt) > new Date() ? workspace.cancelAt : null;

  if ((status === "active" || status === "trialing") && cancelAt) {
    return { ...base, statusLabel: "Cancels soon", tone: "warning", detail: `Your ${planLabel} plan stays active until ${formatDate(cancelAt)}, then the workspace returns to Free.` };
  }
  if (status === "active" || status === "trialing") {
    return { ...base, statusLabel: status === "trialing" ? "Trial" : "Active", tone: "good", detail: workspace.currentPeriodEnd ? `Renews on ${formatDate(workspace.currentPeriodEnd)}.` : "Your subscription is active." };
  }
  if (status === "past_due") {
    return { ...base, statusLabel: "Payment failed", tone: "danger", detail: "Your last payment did not go through. Update your payment method to keep paid limits." };
  }
  if (status === "unpaid" || status === "paused" || status === "incomplete") {
    return { ...base, statusLabel: "Action needed", tone: "danger", detail: "Your subscription needs attention. Open billing management to resolve it." };
  }
  if (status === "canceled" || status === "incomplete_expired") {
    return { ...base, statusLabel: "Canceled", tone: "neutral", detail: "Your paid subscription has ended. You can upgrade again at any time." };
  }
  return { ...base, statusLabel: "No subscription", tone: "neutral", detail: `You are on the Free plan with ${limitFor("free", emailVerified).toLocaleString("en-US")} renders per month.${emailVerified ? "" : ` Confirm your email to raise it to ${planLimits.free.toLocaleString("en-US")}.`}` };
}
