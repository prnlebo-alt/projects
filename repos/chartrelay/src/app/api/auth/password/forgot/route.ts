import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth/account";
import { emailDeliverable } from "@/lib/email/send";
import { clientIp, consumeRateLimit, HOUR } from "@/lib/security/rate-limit";

const schema = z.object({ email: z.email().transform((value) => value.toLowerCase()) });
// Identical response whether or not the account exists, so this endpoint can't be used to discover emails.
const accepted = () => NextResponse.json({ ok: true, message: "If an account exists for that email, a reset link is on its way." });

/**
 * No provider configured means no link can be sent, for any address. Saying so is not an enumeration
 * risk — the answer does not depend on whether the account exists — and it is the only honest reply:
 * promising a delivery that throws server-side leaves a locked-out customer with no recovery path.
 */
const unavailable = () => NextResponse.json({
  ok: true,
  emailUnavailable: true,
  message: "Password-reset email is not available on this deployment yet, so no link can be sent. Contact support to recover the account.",
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  // Checked before any token is minted: an unsendable link is worse than no link.
  if (!emailDeliverable()) return unavailable();
  const ipLimit = consumeRateLimit(`reset-ip:${clientIp(request)}`, 10, HOUR);
  if (!ipLimit.allowed) return NextResponse.json({ error: "Too many reset requests. Try again later." }, { status: 429 });
  // Silently cap emails per address so nobody can flood someone's inbox.
  if (!consumeRateLimit(`reset-email:${parsed.data.email}`, 3, HOUR).allowed) return accepted();
  // Not awaited: the email provider round-trip only happens for real accounts, so waiting on it would reveal
  // through response time which emails are registered. The single persistent server finishes it in the background.
  void requestPasswordReset(parsed.data.email).catch((error) => console.error("Password reset email failed:", error instanceof Error ? error.message : error));
  return accepted();
}
