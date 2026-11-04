import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { consumeToken, issueToken } from "./tokens";
import { planLimits } from "@/lib/usage/plans";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = issueToken(user.id, "verify-email");
  await sendEmail({
    to: user.email,
    subject: "Confirm your ChartRelay email",
    text: `Hi ${user.name.split(" ")[0]},\n\nConfirm your email to turn on your free limit of ${planLimits.free.toLocaleString("en-US")} renders a month:\n\n${appUrl()}/verify-email?token=${token}\n\nThis link expires in 48 hours. If you didn't create a ChartRelay account, ignore this email.`,
  });
}

/** Marks the email verified. Returns false for an invalid, expired, or used link. */
export function verifyEmail(token: string) {
  const userId = consumeToken(token, "verify-email");
  if (!userId) return false;
  db.update(users).set({ emailVerifiedAt: new Date().toISOString() }).where(eq(users.id, userId)).run();
  return true;
}

/** Sends a reset link if the account exists. Callers must respond identically either way. */
export async function requestPasswordReset(email: string) {
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (!user) return;
  const token = issueToken(user.id, "reset-password");
  await sendEmail({
    to: user.email,
    subject: "Reset your ChartRelay password",
    text: `Someone asked to reset the password for this ChartRelay account.\n\n${appUrl()}/reset-password?token=${token}\n\nThis link works once and expires in 1 hour. If this wasn't you, ignore this email; your password has not changed.`,
  });
}

/** Sets a new password from a reset link and signs out every existing session. Returns false for a bad link. */
export async function resetPassword(token: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = consumeToken(token, "reset-password");
  if (!userId) return false;
  // Resetting through an emailed link also proves ownership of the address.
  const now = new Date().toISOString();
  const user = db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).get();
  db.update(users).set({ passwordHash, passwordChangedAt: now, emailVerifiedAt: user?.emailVerifiedAt ?? now }).where(eq(users.id, userId)).run();
  return true;
}
