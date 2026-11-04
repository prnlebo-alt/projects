"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatLimit } from "@/lib/usage/plans";

/**
 * The register subtitle states the free allowance. Both numbers come from the plan constants, and the
 * copy changes when this deployment cannot send a confirmation email, so it never advertises an
 * allowance nobody can reach.
 */
function registerSubtitle({ freeLimit, unverifiedLimit, emailSendable }: { freeLimit?: number; unverifiedLimit?: number; emailSendable?: boolean }) {
  if (freeLimit === undefined || unverifiedLimit === undefined) return "No card. A free allowance every month, no card required.";
  const free = formatLimit(freeLimit);
  const unverified = formatLimit(unverifiedLimit);
  return emailSendable
    ? `No card. ${unverified} free renders each month, and ${free} once you confirm your email address.`
    : `No card. ${unverified} free renders each month. Email confirmation, which normally raises that to ${free}, is temporarily unavailable on this deployment — support can raise the limit by hand.`;
}

export function AuthForm({ mode, freeLimit, unverifiedLimit, emailSendable = true }: { mode: "login" | "register"; freeLimit?: number; unverifiedLimit?: number; emailSendable?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";
  // The channel slug from `?ref=` on the sign-up link. Read after mount (no `window` during the server render) and
  // sent as its own field, so a form input cannot spoof it. The server sanitizes it before anything is stored.
  const source = useRef<string | null>(null);

  useEffect(() => {
    if (register) source.current = new URLSearchParams(window.location.search).get("ref");
  }, [register]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = register ? { ...data, source: source.current } : data;
    const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Something went wrong."); setBusy(false); return; }
    if (body.apiKey) sessionStorage.setItem("chartrelay_new_key", body.apiKey);
    router.push("/dashboard");
    router.refresh();
  }

  return <form className="auth-card" onSubmit={submit}>
    <span className="eyebrow">{register ? "Free developer account" : "Welcome back"}</span>
    <h1>{register ? "Ship your first chart." : "Sign in to ChartRelay."}</h1>
    {/* Both free limits, and no promise about email. "once you confirm your email" read as a step every new
        account can take; when confirmation email is not being delivered it is not, and support raises the limit
        by hand instead. The two numbers are the ones src/lib/usage/limits.ts enforces — this is a client
        component, so it cannot import that module (it would pull the database into the browser bundle), and
        tests/email-degradation.test.ts pins this sentence to those constants instead. */}
    <p>{register ? registerSubtitle({ freeLimit, unverifiedLimit, emailSendable }) : "Manage keys, usage, and production renders."}</p>
    {register && <label>Name<input name="name" minLength={2} maxLength={80} autoComplete="name" required /></label>}
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" minLength={register ? 10 : 1} autoComplete={register ? "new-password" : "current-password"} required /></label>
    {!register && <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-wide" disabled={busy}>{busy ? "Working…" : register ? "Create account" : "Sign in"}</button>
    <small>{register ? <>Already have an account? <Link href="/login">Sign in</Link>.</> : <>Need an account? <Link href="/register">Start free</Link>.</>}</small>
  </form>;
}
