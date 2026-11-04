import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/auth/account";
import { currentAccount } from "@/lib/auth/session";
import { emailDeliverable } from "@/lib/email/send";
import { consumeRateLimit, HOUR } from "@/lib/security/rate-limit";

/**
 * No provider configured means no confirmation email can be sent, for anyone. "Please try again later" would
 * be false — the retry cannot succeed until the deployment changes — so this says what is true and names the
 * route that still works. 503, because the capability is missing here, not failing upstream.
 */
const unavailable = () => NextResponse.json({
  error: "Email confirmation is temporarily unavailable on this deployment, so no confirmation email can be sent. Nothing is wrong with your address, and nothing is in transit. Contact support to have your limit raised by hand.",
  emailUnavailable: true,
}, { status: 503 });

export async function POST() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (account.user.emailVerifiedAt) return NextResponse.json({ ok: true, alreadyVerified: true });
  // Checked before the hourly allowance is spent: an attempt that cannot send anything must not cost the
  // customer one of the three sends they get once email is switched back on.
  if (!emailDeliverable()) return unavailable();
  const limit = consumeRateLimit(`verify-resend:${account.user.id}`, 3, HOUR);
  if (!limit.allowed) return NextResponse.json({ error: "We've sent several emails already. Check your spam folder, or try again later." }, { status: 429 });
  try {
    await sendVerificationEmail(account.user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A configured provider that failed this once: retrying really can work, so the old copy stays here.
    console.error("Verification email failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "We couldn't send the email. Please try again later." }, { status: 502 });
  }
}
