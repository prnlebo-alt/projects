import { businessIdentity, DISPLAY_NAME, hasPostalAddress, postalAddress } from "@/lib/business";

/**
 * Why a message is being sent, which decides whether it may be sent at all.
 *
 * "transactional" is a reply to something the recipient just did — confirm this address, reset this
 * password, here is your receipt. It always sends: withholding one strands a customer mid-task, and
 * no anti-spam law requires a postal address on it.
 *
 * "lifecycle" is everything we send because we want to — onboarding nudges, upgrade prompts, product
 * news. CAN-SPAM and equivalents require a physical postal address on those, so they are blocked
 * until BUSINESS_POSTAL_ADDRESS exists. Blocked, not silently dropped: the attempt is logged.
 */
export type EmailKind = "transactional" | "lifecycle";

export type Email = { to: string; subject: string; text: string; kind?: EmailKind };

type Env = Record<string, string | undefined>;

/**
 * The one place that decides whether outbound email can leave this deployment. Everything that tells a
 * customer an email is coming — /support, /forgot-password, the startup report — must ask this, so the
 * product and the logs can never disagree about it. "resend" is the only provider sendEmail implements.
 */
export function emailConfigured(env: Env = process.env): boolean {
  return env.EMAIL_PROVIDER === "resend" && Boolean(env.RESEND_API_KEY) && Boolean(env.EMAIL_FROM);
}

/**
 * True when sendEmail will do something useful with a message. Outside production an unconfigured
 * deployment prints the mail to the server console, which is enough for local development; in
 * production it throws, and nothing must claim a delivery that cannot happen.
 */
export function emailDeliverable(env: Env = process.env): boolean {
  return emailConfigured(env) || env.NODE_ENV !== "production";
}

/** The configuration problem to report, or null when email is fully configured. Never includes values. */
export function emailConfigProblem(env: Env = process.env): string | null {
  if (env.EMAIL_PROVIDER !== "resend") return "EMAIL_PROVIDER is not set to \"resend\": verification and password-reset emails will not be sent.";
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return "EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM: emails will fail.";
  return null;
}

/**
 * Sends transactional email.
 * - EMAIL_PROVIDER=resend: Resend HTTP API (RESEND_API_KEY, EMAIL_FROM).
 * - Otherwise, outside production: prints the email to the server console for local testing.
 * Production without a provider fails loudly instead of silently dropping mail.
 */
/**
 * The block that closes every outgoing message.
 *
 * A lifecycle email carries the postal address because the law that governs it says so, and it cannot
 * be sent without one. A transactional email carries the name and a way to reach a human, which is
 * what a recipient actually needs in order to tell a real receipt from a phishing attempt.
 */
export function emailFooter(kind: EmailKind, env: Env = process.env): string {
  const { legalName, email } = businessIdentity(env);
  const address = postalAddress(env);
  // A receipt signs off with the brand a customer recognises. A lifecycle message is the regulated
  // one, so it names the registered entity beside the postal address the law asks for.
  const who = kind === "lifecycle" ? legalName : DISPLAY_NAME;
  const lines = [who, ...(kind === "lifecycle" && address ? [address] : []), email];
  return lines.join("\n");
}

export class LifecycleEmailBlockedError extends Error {}

/**
 * Whether a message of this kind may be sent right now.
 *
 * Kept separate from sendEmail so a caller that queues mail can ask before doing the work, and so the
 * rule is testable without a network.
 */
export function emailAllowed(kind: EmailKind, env: Env = process.env): boolean {
  return kind === "transactional" || hasPostalAddress(env);
}

export async function sendEmail(email: Email) {
  const kind: EmailKind = email.kind ?? "transactional";
  if (!emailAllowed(kind)) {
    // Loud rather than silent: a marketing send that vanishes without trace is how a company
    // discovers months later that a campaign never went out.
    console.warn(`[email-blocked] kind=lifecycle subject=${JSON.stringify(email.subject)} reason=BUSINESS_POSTAL_ADDRESS is unset; see docs/GATES.md`);
    throw new LifecycleEmailBlockedError("Lifecycle email is blocked until BUSINESS_POSTAL_ADDRESS is set. Transactional email is unaffected.");
  }
  const body = `${email.text.trimEnd()}\n\n—\n${emailFooter(kind)}\n`;
  const provider = process.env.EMAIL_PROVIDER;
  if (provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: body }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (HTTP ${response.status}).`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("No email provider configured. Set EMAIL_PROVIDER.");
  console.info(`\n[dev email] To: ${email.to}\nSubject: ${email.subject}\n\n${body}\n`);
}
