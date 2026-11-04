"use client";

import { useState } from "react";
import Link from "next/link";

async function post(endpoint: string, body: unknown) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string; alreadyVerified?: boolean; emailUnavailable?: boolean };
  return { ok: response.ok, data };
}

/** Shown wherever reset email cannot be delivered, so nobody waits for a link that was never sent. */
export const RESET_EMAIL_UNAVAILABLE = "Password-reset email is not available on this deployment yet, so no link can be sent.";

/**
 * `emailSendable` comes from the server (src/lib/email/send.ts). When it is false the form is replaced by
 * a notice: offering a "Send reset link" button that cannot send one is the dead end this page had.
 */
export function ForgotPasswordForm({ emailSendable = true }: { emailSendable?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [unavailable, setUnavailable] = useState(!emailSendable);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const { ok, data } = await post("/api/auth/password/forgot", Object.fromEntries(new FormData(event.currentTarget)));
    // The route answers honestly even if this page was rendered before the provider was turned off.
    if (ok && data.emailUnavailable) setUnavailable(true);
    else if (ok) setDone(data.message ?? "Check your email for a reset link.");
    else setError(data.error ?? "Something went wrong.");
    setBusy(false);
  }
  return <form className="auth-card" onSubmit={submit}>
    <span className="eyebrow">Account recovery</span>
    <h1>Reset your password.</h1>
    {unavailable
      ? <p role="status">{RESET_EMAIL_UNAVAILABLE} Nothing is wrong with your address, and there is no link in transit. <Link href="/support">Support</Link> lists every recovery route open today.</p>
      : done ? <p role="status">{done}</p> : <>
        <p>Enter your account email and we&apos;ll send a link that works once and expires in an hour.</p>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-wide" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      </>}
    <small>Remembered it? <Link href="/login">Sign in</Link>.</small>
  </form>;
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirm")) { setError("The passwords don't match."); return; }
    setBusy(true); setError("");
    const { ok, data } = await post("/api/auth/password/reset", { token, password: form.get("password") });
    if (ok) setDone(true); else setError(data.error ?? "Something went wrong.");
    setBusy(false);
  }
  return <form className="auth-card" onSubmit={submit}>
    <span className="eyebrow">Account recovery</span>
    <h1>Choose a new password.</h1>
    {done ? <p role="status">Your password was changed and every other session was signed out. <Link href="/login">Sign in</Link> with your new password.</p> : <>
      <p>Use at least 10 characters.</p>
      <label>New password<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label>
      <label>Confirm password<input name="confirm" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-wide" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
    </>}
  </form>;
}

/** Shown wherever confirmation email cannot leave the deployment, so nobody is told to resend an unsendable message. */
export const VERIFY_EMAIL_UNAVAILABLE = "Email confirmation is temporarily unavailable on this deployment, so no confirmation message can be sent.";

/**
 * The dashboard's unconfirmed-email banner, in both states of the one authority for outbound mail
 * (emailDeliverable in src/lib/email/send.ts, read by the server component that renders this).
 *
 * When email cannot be sent there is no Resend button: the button called an endpoint that could only fail,
 * and "try again later" was false — the retry cannot succeed until the deployment changes. The limits come
 * from src/lib/usage/limits.ts through props, so the banner can never name a number the API does not enforce.
 */
export function VerifyEmailBanner({ email, emailSendable, currentLimit, confirmedLimit }: { email: string; emailSendable: boolean; currentLimit: number; confirmedLimit: number }) {
  return <div className="billing-banner billing-banner-warning verify-banner" role="status">
    {emailSendable
      ? <><span>Confirm your email ({email}) to raise your free limit from {currentLimit.toLocaleString()} to {confirmedLimit.toLocaleString()} renders a month.</span><ResendVerificationButton /></>
      : <span>{VERIFY_EMAIL_UNAVAILABLE} Nothing is wrong with {email}, and nothing is in transit. This workspace keeps rendering at {currentLimit.toLocaleString()} a month instead of {confirmedLimit.toLocaleString()} until confirmation is switched back on — <Link href="/support">support</Link> can raise the limit by hand.</span>}
  </div>;
}

export function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  async function resend() {
    setState("busy");
    const { ok, data } = await post("/api/auth/verify/resend", {});
    setState(ok ? "sent" : "error");
    setMessage(ok ? (data.alreadyVerified ? "Already confirmed. Refresh the page." : "Sent. Check your inbox.") : data.error ?? "Couldn't send.");
  }
  if (state === "sent" || state === "error") return <span className="verify-status">{message}</span>;
  return <button className="button button-ghost button-small" onClick={resend} disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Resend email"}</button>;
}
