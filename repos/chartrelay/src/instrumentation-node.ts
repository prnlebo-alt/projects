// A misconfigured production container refuses to serve traffic instead of failing on the first sign-up.
import { productionConfigReport } from "@/lib/config/startup";

if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const report = productionConfigReport();
  for (const warning of report.warnings) console.error(`[config] WARNING: ${warning}`);
  if (report.fatal.length) {
    for (const problem of report.fatal) console.error(`[config] FATAL: ${problem}`);
    console.error("[config] Refusing to start. Fix the environment and restart.");
    process.exit(1);
  }
}

// The two jobs the ledger cannot do for itself. A render that died between reserving and settling holds a unit
// nobody will ever give back, and a month's allowance only stops being spendable if something expires it.
if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
  const { expireGrants, sweepStaleReservations } = await import("@/lib/ledger/ledger");
  const tick = () => {
    try {
      sweepStaleReservations();
      const removed = expireGrants();
      if (removed > 0) console.warn(`[ledger] expired ${removed} unspent render(s)`);
    } catch (error) {
      console.error("[ledger] maintenance failed:", error instanceof Error ? error.message : error);
    }
  };
  tick();
  setInterval(tick, 5 * 60 * 1000).unref();

  // Slower jobs, and both safe to repeat: the notices are marked once sent, and the reconciliation grants through
  // the ledger's own dedupe. They run a couple of minutes after boot, then every few hours, rather than on a
  // cron, because the one server is the only thing that is always there.
  const { sendExpiryNotices } = await import("@/lib/billing/expiry-notices");
  const { reconcilePacks } = await import("@/lib/billing/reconcile");
  const { billingConfigProblems } = await import("@/lib/billing/stripe");
  const slow = async () => {
    try { await sendExpiryNotices(); } catch (error) { console.error("[expiry-notice] pass failed:", error instanceof Error ? error.message : error); }
    if (billingConfigProblems().some((problem) => problem.startsWith("STRIPE_SECRET_KEY"))) return;
    try {
      const result = await reconcilePacks();
      if (result.granted > 0) console.warn(`[reconcile] repaired ${result.granted} pack payment(s) whose webhooks did not deliver.`);
    } catch (error) { console.error("[reconcile] pass failed:", error instanceof Error ? error.message : error); }
  };
  setTimeout(() => void slow(), 2 * 60 * 1000).unref();
  setInterval(() => void slow(), 6 * 60 * 60 * 1000).unref();
}
