import type { Metadata } from "next";
import Link from "next/link";
import { ensureAllowance } from "@/lib/ledger/allowance";
import { requireAccount } from "@/lib/auth/session";
import { usageReport, REPORT_DAYS } from "@/lib/usage/report";
import { ManageBillingButton } from "@/components/billing-button";

export const metadata: Metadata = { title: "Usage", robots: { index: false } };

const SOURCE_LABEL: Record<string, string> = { plan_cycle: "Monthly allowance", pack: "Render pack", free: "Free renders", goodwill: "Added by support" };

export default async function UsagePage() {
  const account = await requireAccount();
  ensureAllowance(account.workspace.id);
  const report = usageReport(account.workspace.id);
  const peak = Math.max(1, ...report.byDay.map((row) => row.renders));
  return <main className="dashboard">
    <div className="dashboard-head"><div><span className="eyebrow">{account.workspace.name}</span><h1>Usage</h1></div><Link className="button button-ghost button-small" href="/dashboard">Back to dashboard</Link></div>
    <div className="metric-grid">
      <div className="metric"><span>Credit remaining</span><strong>{report.balance.toLocaleString()}</strong></div>
      <div className="metric"><span>Renders, last {REPORT_DAYS} days</span><strong>{report.total.toLocaleString()}</strong></div>
      <div className="metric"><span>Keys that spent</span><strong>{report.byKey.length}</strong></div>
    </div>
    <section className="dashboard-card" aria-labelledby="by-day"><h2 id="by-day">Renders per day</h2>
      <div role="img" aria-label={`Renders per day for the last ${REPORT_DAYS} days, peak ${peak.toLocaleString()}`} style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
        {report.byDay.map((row) => <div key={row.day} title={`${row.day}: ${row.renders.toLocaleString()}`} style={{ flex: 1, minWidth: 2, height: `${Math.max(2, (row.renders / peak) * 100)}%`, background: row.renders ? "var(--accent-dark)" : "#e4e4ec", borderRadius: 2 }} />)}
      </div>
      <p className="empty-copy">{report.byDay[0].day} to {report.byDay[report.byDay.length - 1].day}, UTC.</p>
    </section>
    <div className="dashboard-grid" style={{ marginTop: 22 }}>
      <section className="dashboard-card"><h2>By key</h2>
        {report.byKey.length ? <div className="key-list">{report.byKey.map((row) => <div className="key-row" key={row.keyId ?? "session"}><strong>{row.name}</strong><span>{row.renders.toLocaleString()}</span></div>)}</div> : <p className="empty-copy">No renders in the last {REPORT_DAYS} days.</p>}
      </section>
      <section className="dashboard-card"><h2>Credit</h2>
        {report.grants.length ? <div className="key-list">{report.grants.map((grant) => <div className="key-row" key={grant.id}><div><strong>{SOURCE_LABEL[grant.source] ?? grant.source}</strong><br /><span>{grant.expiresAt ? `Expires ${new Date(grant.expiresAt).toLocaleDateString("en-US", { timeZone: "UTC" })}` : "Does not expire"}</span></div><span>{grant.renders.toLocaleString()}</span></div>)}</div> : <p className="empty-copy">No credit has been added to this account yet.</p>}
        <h2 style={{ marginTop: 22 }}>Invoices</h2>
        {account.workspace.stripeCustomerId ? <><p className="empty-copy">Receipts and invoices for plans and packs live in the billing portal.</p><ManageBillingButton /></> : <p className="empty-copy">Nothing has been billed yet. Receipts will appear here once you buy a plan or a pack.</p>}
      </section>
    </div>
  </main>;
}
