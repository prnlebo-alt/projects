"use client";

import { useState } from "react";
import type { PaidPlan } from "@/lib/billing/stripe";

async function redirectFrom(endpoint: string, body: unknown, fallback: string) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (response.ok && data.url) {
    window.location.href = data.url;
    return null;
  }
  return data.error ?? fallback;
}

function useRedirectAction(endpoint: string, body: unknown, fallback: string) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run() {
    setError("");
    setBusy(true);
    try {
      const problem = await redirectFrom(endpoint, body, fallback);
      if (problem) { setError(problem); setBusy(false); }
    } catch {
      setError(fallback);
      setBusy(false);
    }
  }
  return { error, busy, run };
}

export function BillingButton({ plan, children }: { plan: PaidPlan; children: React.ReactNode }) {
  const { error, busy, run } = useRedirectAction("/api/billing/checkout", { plan }, "Checkout failed. Please try again.");
  return <div><button className="button button-wide" onClick={run} disabled={busy}>{busy ? "Opening checkout…" : children}</button>{error && <small className="form-error block-error" role="alert">{error}</small>}</div>;
}

export function ManageBillingButton({ className = "button button-ghost button-small", children = "Manage billing" }: { className?: string; children?: React.ReactNode }) {
  const { error, busy, run } = useRedirectAction("/api/billing/portal", {}, "Billing management is unavailable. Please try again.");
  return <div><button className={className} onClick={run} disabled={busy}>{busy ? "Opening…" : children}</button>{error && <small className="form-error block-error" role="alert">{error}</small>}</div>;
}
