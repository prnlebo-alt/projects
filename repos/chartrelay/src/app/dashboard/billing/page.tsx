import type { Metadata } from "next";
import Link from "next/link";
import { ensureAllowance } from "@/lib/ledger/allowance";
import { requireAccount } from "@/lib/auth/session";
import { balanceOf } from "@/lib/ledger/ledger";
import { describeBilling } from "@/lib/billing/status";
import { ManageBillingButton } from "@/components/billing-button";

export const metadata: Metadata = { title: "Add credit", robots: { index: false } };

/**
 * Where a 402 sends a person. The API's `top_up_url` is this path, so an agent that runs out of credit hands
 * its human a page that exists and says what to do next.
 */
export default async function BillingPage() {
  const account = await requireAccount();
  ensureAllowance(account.workspace.id);
  const billing = describeBilling(account.workspace, Boolean(account.user.emailVerifiedAt));
  const balance = balanceOf(account.workspace.id);
  return <main className="dashboard">
    <div className="dashboard-head"><div><span className="eyebrow">{account.workspace.name}</span><h1>Add credit</h1></div><Link className="button button-ghost button-small" href="/dashboard">Back to dashboard</Link></div>
    <section className="dashboard-card" aria-labelledby="credit-heading">
      <h2 id="credit-heading">Credit remaining: {balance.toLocaleString()} renders</h2>
      <p className="empty-copy">You are on the {billing.planLabel} plan. Nothing is ever billed past what you buy: when credit runs out the API stops and says so.</p>
      <div className="billing-actions">
        <Link className="button button-small" href="/pricing">{account.workspace.plan === "free" ? "Choose a plan" : "Change plan"}</Link>
        {billing.canManage && <ManageBillingButton />}
        <Link className="button button-ghost button-small" href="/dashboard/usage">See usage</Link>
      </div>
      <p className="empty-copy">One-time render packs are coming soon.</p>
    </section>
  </main>;
}
