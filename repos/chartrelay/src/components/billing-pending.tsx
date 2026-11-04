"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Refreshes the dashboard while the Stripe webhook confirms a just-completed Checkout. */
export function BillingPending() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  useEffect(() => {
    if (attempts >= 15) return;
    const timer = window.setTimeout(() => { router.refresh(); setAttempts((value) => value + 1); }, 2000);
    return () => window.clearTimeout(timer);
  }, [attempts, router]);
  return <div className="billing-banner billing-banner-warning" role="status">{attempts < 15 ? "Payment received. Confirming your subscription with Stripe…" : "Stripe has not confirmed the subscription yet. Refresh in a minute; you will not be charged twice."}</div>;
}
