import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireAccount } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKeys, renders } from "@/lib/db/schema";
import { limitFor, monthlyUsage, planLimits } from "@/lib/usage/limits";
import { VerifyEmailBanner } from "@/components/account-forms";
import { emailDeliverable } from "@/lib/email/send";
import { KeyManager } from "@/components/key-manager";
import { QuickstartCard } from "@/components/quickstart-card";
import { ManageBillingButton } from "@/components/billing-button";
import { BillingPending } from "@/components/billing-pending";
import { hasLivePackCredit } from "@/lib/ledger/ledger";
import { reconcilePacks } from "@/lib/billing/reconcile";
import { describeBilling } from "@/lib/billing/status";
import { AccountDangerZone } from "@/components/account-danger-zone";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const account = await requireAccount();
  const { billing: billingParam } = await searchParams;
  // Back from paying for a pack. The webhook normally got here first; if it did not, ask Stripe what was paid and
  // grant it now, so the page the customer lands on is never the one that says "nothing happened".
  if (billingParam === "pack-success" && account.workspace.stripeCustomerId) {
    try { await reconcilePacks({ customer: account.workspace.stripeCustomerId, sinceDays: 1 }); } catch (error) { console.error("Pack reconciliation on return failed:", error instanceof Error ? error.message : error); }
  }
  const [keys, recent, used] = await Promise.all([
    db.query.apiKeys.findMany({ where: eq(apiKeys.workspaceId, account.workspace.id), orderBy: [desc(apiKeys.createdAt)] }),
    db.query.renders.findMany({ columns: { id: true, spec: true, createdAt: true }, where: eq(renders.workspaceId, account.workspace.id), orderBy: [desc(renders.createdAt)], limit: 6 }),
    monthlyUsage(account.workspace.id),
  ]);
  const activeKeys = keys.filter((key) => !key.revokedAt);
  const verified = Boolean(account.user.emailVerifiedAt);
  const limit = limitFor(account.workspace.plan, verified);
  const billing = describeBilling(account.workspace, verified);
  const awaitingWebhook = billingParam === "success" && account.workspace.plan === "free";
  return <main className="dashboard">
    <div className="dashboard-head"><div><span className="eyebrow">{account.workspace.name}</span><h1>Good morning, {account.user.name.split(" ")[0]}.</h1></div><div><Link className="button button-ghost button-small" href="/playground">Open playground</Link><form action="/api/auth/logout" method="post" style={{ display: "inline", marginLeft: 8 }}><button className="button button-small">Sign out</button></form></div></div>
    {/* The banner asks for a confirmation only when one can actually be sent; emailDeliverable is the same
        authority /support and /forgot-password read, so the three surfaces cannot disagree about it. */}
    {!verified && account.workspace.plan === "free" && <VerifyEmailBanner email={account.user.email} emailSendable={emailDeliverable()} currentLimit={limit} confirmedLimit={planLimits.free} />}
    {awaitingWebhook && <BillingPending />}
    {billingParam === "pack-success" && (hasLivePackCredit(account.workspace.id)
      ? <div className="billing-banner billing-banner-good" role="status">Thank you! Your render pack is on your account. <Link href="/dashboard/usage">See your balance</Link>.</div>
      : <div className="billing-banner" role="status">We are still confirming your payment. Refresh in a minute; if the credit has not appeared, <Link href="/support">contact support</Link> and it will be fixed.</div>)}
    {billingParam === "success" && !awaitingWebhook && <div className="billing-banner billing-banner-good" role="status">You are now on the {billing.planLabel} plan. Thank you!</div>}
    {/* `recent` is the existing renders query (limit 6), so the zero-render check adds no new round trip. */}
    <QuickstartCard renderCount={recent.length} activeKeyCount={activeKeys.length} keyPrefix={activeKeys[0]?.prefix ?? null} />
    <div className="metric-grid"><div className="metric"><span>Plan</span><strong>{billing.planLabel.toUpperCase()}</strong></div><div className="metric"><span>Renders this month</span><strong>{used.toLocaleString()} <small>/ {limit.toLocaleString()}</small></strong></div><div className="metric"><span>Active API keys</span><strong>{activeKeys.length}</strong></div></div>
    <section className="dashboard-card billing-card" aria-labelledby="billing-heading"><div><h2 id="billing-heading">Billing</h2><p className="billing-line"><strong>{billing.planLabel} plan</strong> <span className={`status-pill status-${billing.tone}`}>{billing.statusLabel}</span></p><p className="empty-copy">{billing.detail}</p></div><div className="billing-actions">{billing.canManage && <ManageBillingButton />}<Link className="button button-ghost button-small" href="/dashboard/usage">Usage</Link>{!billing.hasLiveSubscription && <Link className="button button-small" href="/pricing">{account.workspace.plan === "free" ? "Upgrade" : "Change plan"}</Link>}</div></section>
    <div className="dashboard-grid"><section className="dashboard-card" id="api-keys"><h2>API keys</h2>{activeKeys.length ? <div className="key-list">{activeKeys.map((key) => <div className="key-row" key={key.id}><div><strong>{key.name}</strong><br/><code>{key.prefix}••••••••</code></div><span>{key.lastUsedAt ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}` : "Never used"}</span></div>)}</div> : <p className="empty-copy">No active API keys.</p>}<KeyManager /></section>
      <section className="dashboard-card"><h2>Recent production renders</h2>{recent.length ? <div className="render-list">{recent.map((render) => { const spec = JSON.parse(render.spec) as { title: string; type: string }; return <a className="render-row" href={`/api/v1/charts/${render.id}?format=svg`} target="_blank" rel="noreferrer" key={render.id}><div><strong>{spec.title}</strong><br/><span>{spec.type} · {new Date(render.createdAt).toLocaleString()}</span></div><span>↗</span></a>; })}</div> : <p className="empty-copy">Nothing rendered through the authenticated API yet. Use the docs to ship the first one.</p>}<Link className="button button-ghost button-wide" style={{ marginTop: 15 }} href="/docs">Read quickstart</Link></section>
    </div>
    <div style={{ marginTop: 22 }}><AccountDangerZone email={account.user.email} /></div>
  </main>;
}
