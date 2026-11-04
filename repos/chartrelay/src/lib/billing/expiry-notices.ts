import { and, eq, isNull, lt, gt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { auditLog, creditGrants, users, workspaces } from "@/lib/db/schema";
import { sendEmail, type Email } from "@/lib/email/send";
import { RENDER_PACK } from "@/lib/usage/plans";

const DAY = 86_400_000;
/** Warn this many days out, the spec's two reminders. */
const WARN_AT = [14, 3] as const;
const ACTION = "credit.expiry_notice";

const noticeSent = (grantId: string, days: number) =>
  Boolean(db.select({ id: auditLog.id }).from(auditLog).where(and(eq(auditLog.action, ACTION), eq(auditLog.subject, `${grantId}:${days}`))).get());

/**
 * Emails the owner of each pack that is about to expire with credit left, 14 days out and again 3 days out.
 *
 * Only packs: the monthly allowance expires every month by design, and a warning about it would be noise that
 * teaches people to ignore the one that matters. A notice is recorded in the audit log only after the send
 * succeeds, so a failed send is retried on the next pass and a successful one never repeats. A pack first
 * noticed inside the final 3 days gets the 3-day email alone, with the 14-day one marked as covered.
 *
 * Transactional, not lifecycle: it is about credit the customer bought, so it is not held back by the
 * postal-address gate that blocks marketing email.
 */
export async function sendExpiryNotices(at = new Date(), send: (email: Email) => Promise<void> = sendEmail): Promise<number> {
  const horizon = new Date(at.getTime() + WARN_AT[0] * DAY).toISOString();
  const grants = db.select().from(creditGrants)
    .where(and(eq(creditGrants.source, "pack"), isNull(creditGrants.revokedAt), gt(creditGrants.expiresAt, at.toISOString()), lt(creditGrants.expiresAt, horizon))).all();
  let sent = 0;
  for (const grant of grants) {
    const unspent = grant.renders - grant.consumed;
    if (unspent <= 0 || !grant.expiresAt) continue;
    const daysLeft = (new Date(grant.expiresAt).getTime() - at.getTime()) / DAY;
    const tier = daysLeft <= WARN_AT[1] ? WARN_AT[1] : WARN_AT[0];
    if (noticeSent(grant.id, tier)) continue;
    const owner = db.select({ email: users.email, name: users.name }).from(workspaces).innerJoin(users, eq(users.id, workspaces.ownerId)).where(eq(workspaces.id, grant.workspaceId)).get();
    if (!owner) continue;
    const when = new Date(grant.expiresAt).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
    try {
      await send({
        to: owner.email,
        subject: `${unspent.toLocaleString("en-US")} ChartRelay renders expire on ${when}`,
        text: [
          `Hi ${owner.name.split(" ")[0]},`,
          "",
          `${unspent.toLocaleString("en-US")} renders from your render pack expire on ${when}, in about ${Math.ceil(daysLeft)} day${Math.ceil(daysLeft) === 1 ? "" : "s"}. Render packs last ${RENDER_PACK.expiryMonths} months from purchase, and unused renders cannot be carried over or refunded after that.`,
          "",
          "Use them before then, or check your balance and usage at https://chartrelay.dev/dashboard/usage.",
        ].join("\n"),
        kind: "transactional",
      });
    } catch (error) {
      console.error(`[expiry-notice] could not email ${grant.workspaceId} about grant ${grant.id}:`, error instanceof Error ? error.message : error);
      continue;
    }
    const stamp = at.toISOString();
    for (const days of tier === WARN_AT[1] ? WARN_AT : [tier]) {
      if (!noticeSent(grant.id, days)) db.insert(auditLog).values({ id: randomUUID(), workspaceId: grant.workspaceId, actor: "system", action: ACTION, subject: `${grant.id}:${days}`, detail: `${unspent} renders expire ${grant.expiresAt}`, createdAt: stamp }).run();
    }
    sent += 1;
  }
  return sent;
}
