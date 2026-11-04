import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditGrants, users, workspaces } from "@/lib/db/schema";
import { grantCredit } from "@/lib/ledger/ledger";
import { limitFor, normalisePlan } from "@/lib/usage/plans";

/**
 * Puts this month's allowance in the ledger, once.
 *
 * The ledger spends credit; it does not know that a plan is a promise of renders every month. Something has to turn
 * "Developer" into 5,000 credits, and until this existed nothing did, so a free or subscribed account with no pack
 * had a balance of zero and every render answered 402. It runs lazily, before any read or spend of the balance,
 * rather than from a webhook or a cron, because the thing that must be true is "when this workspace asks, this
 * month's allowance is there" — and a lazy grant cannot be missed, delayed, or lost with a failed delivery.
 *
 * Each grant has a deterministic payment id (workspace, month, plan), so calling this on every request is
 * safe: the ledger's unique index turns the second call into a no-op. The allowance expires at the end of the
 * month (no rollover), and a plan change mid-month adds the new plan's allowance under its own id.
 */
export function ensureAllowance(workspaceId: string, at = new Date()): void {
  const workspace = db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get();
  if (!workspace) return;
  const owner = db.select({ verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, workspace.ownerId)).get();
  const verified = Boolean(owner?.verifiedAt);
  const plan = normalisePlan(workspace.plan);
  const month = at.toISOString().slice(0, 7);
  const expiresAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1)).toISOString();
  const id = (tier: string) => `allowance:${workspaceId}:${month}:${plan}:${tier}`;

  // limitFor is the one place the figure lives: a free workspace gets nothing until its email is confirmed
  // (the spec's rule against free-tier farming), then the free allowance; a paid plan gets its own.
  const renders = limitFor(plan, verified);
  const grants: Array<{ tier: string; renders: number }> = renders > 0 ? [{ tier: "base", renders }] : [];

  for (const grant of grants) {
    const key = id(grant.tier);
    // A cheap read first, so the common case (already granted) never opens a write transaction.
    if (db.select({ id: creditGrants.id }).from(creditGrants).where(eq(creditGrants.paymentEventId, key)).get()) continue;
    grantCredit({ workspaceId, source: plan === "free" ? "free" : "plan_cycle", renders: grant.renders, expiresAt, paymentEventId: key, actor: "allowance" });
  }
}
