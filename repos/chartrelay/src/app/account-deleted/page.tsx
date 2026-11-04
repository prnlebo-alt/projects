import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";

/**
 * Where the danger zone lands after a successful deletion. It exists so the most irreversible action in
 * the product ends with evidence that it happened, rather than on the ordinary marketing home page.
 * Nothing here is personalised — the session is already gone — so it stays a plain static page.
 */
export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

const shell = { width: "min(680px, calc(100% - 40px))", margin: "90px auto 110px" } as const;

export default function AccountDeletedPage() {
  return <main>
    <article className="docs-content" style={shell}>
      <span className="eyebrow">Account</span>
      <h1>Your account is deleted.</h1>
      <p role="status">The account, its workspace, every API key, every render and the usage history have been removed, and you have been signed out. Nothing here can be restored, and support cannot undo it.</p>
      <h2>What this means now</h2>
      <ul>
        <li>API keys from this account are rejected: requests answer <code>401</code>.</li>
        <li>Chart URLs from this account are no longer served. Copies already cached by a browser, a proxy or a link-preview service may still display for a while — they are not being re-fetched from us.</li>
        <li>Any data export you downloaded before deleting is now the only copy that exists.</li>
        <li>If you had a paid plan, it was cancelled in Stripe before this point. Invoices and receipts stay with Stripe.</li>
      </ul>
      <p>You are welcome back whenever you like — a new account starts fresh on the free plan.</p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
        <Link className="button" href="/">Back to the home page</Link>
        <Link className="button button-ghost" href="/register">Create a new account</Link>
        <Link className="button button-ghost" href="/support">Support</Link>
      </p>
    </article>
    <Footer />
  </main>;
}
