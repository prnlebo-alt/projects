import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditGrants, workspaces } from "@/lib/db/schema";
import { grantCredit, reverseGrant } from "@/lib/ledger/ledger";
import { RENDER_PACK } from "@/lib/usage/plans";

/** The ledger key for a pack payment. Prefixed by provider so two providers' ids can never collide. */
export const packPaymentId = (provider: string, paymentId: string) => `${provider}:${paymentId}`;

function expiryFrom(at: Date) {
  const expires = new Date(at);
  expires.setUTCMonth(expires.getUTCMonth() + RENDER_PACK.expiryMonths);
  return expires.toISOString();
}

/**
 * Grants one pack, once. Safe to call again for the same payment: the ledger dedupes on the payment id.
 * Says when the workspace no longer exists (for example, a deleted account), so the caller can log it.
 */
export function grantPackCredit(workspaceId: string, provider: string, paymentId: string, at = new Date()): PackGrantResult {
  if (!db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, workspaceId)).get()) return "no-workspace";
  const result = grantCredit({
    workspaceId, source: "pack", renders: RENDER_PACK.renders, expiresAt: expiryFrom(at),
    paymentEventId: packPaymentId(provider, paymentId), actor: provider,
  });
  return result === null ? "duplicate" : "granted";
}

export type PackGrantResult = "granted" | "duplicate" | "no-workspace";

/** Has this payment already been turned into credit, whether or not it was later reversed? */
export function packAlreadyGranted(provider: string, paymentId: string): boolean {
  return Boolean(db.select({ id: creditGrants.id }).from(creditGrants).where(eq(creditGrants.paymentEventId, packPaymentId(provider, paymentId))).get());
}

/** Takes back the unspent part of a pack after a refund or dispute. */
export function reversePackCredit(provider: string, paymentId: string, reason: string) {
  return reverseGrant(packPaymentId(provider, paymentId), reason);
}
