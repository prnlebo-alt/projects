"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type DeleteResponse = { error?: string; manageBillingUrl?: string };

const panelStyle: React.CSSProperties = { border: "1px solid #e7c9c9", borderRadius: 18, padding: 25, background: "#fffafa" };
const rowStyle: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 18 };
const dialogStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 16, padding: 24, maxWidth: 420, width: "calc(100vw - 32px)", background: "white", color: "var(--ink)" };
const fieldStyle: React.CSSProperties = { display: "block", marginTop: 14, fontSize: 13, fontWeight: 750 };
const inputStyle: React.CSSProperties = { width: "100%", marginTop: 6, padding: "13px 14px", border: "1px solid #dcdfe6", borderRadius: 10, fontWeight: 400 };

export function AccountDangerZone({ email }: { email: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBilling, setShowBilling] = useState(false);

  function open() {
    setError("");
    setShowBilling(false);
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setShowBilling(false);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (response.ok) {
        // The session is gone. Land on a page that says the deletion happened: dropping someone onto the
        // marketing home page leaves the most irreversible action in the product with no acknowledgement.
        window.location.assign("/account-deleted");
        return;
      }
      const data = (await response.json().catch(() => ({}))) as DeleteResponse;
      setError(data.error ?? "We could not delete the account. Please try again.");
      // The route names its own billing page; the link itself stays a fixed in-app route.
      setShowBilling(Boolean(data.manageBillingUrl));
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  return <section className="dashboard-card" style={panelStyle} aria-labelledby="danger-zone-heading">
    <h2 id="danger-zone-heading">Danger zone</h2>
    <p className="empty-copy">Download everything we hold for this account, or close it for good. Deleting removes your workspace, API keys, renders and usage history, and nothing can be restored. Chart URLs stop being served straight away — but copies already cached by a browser, a proxy or a link-preview service can keep showing for a while, because chart assets are sent with a long cache lifetime.</p>
    <div style={rowStyle}>
      <a className="button button-ghost button-small" href="/api/account/export">Export my data</a>
      <button type="button" className="button button-small" style={{ background: "#a52a2a" }} onClick={open}>Delete account</button>
    </div>

    <dialog ref={dialog} style={dialogStyle} aria-labelledby="delete-account-heading">
      <form onSubmit={submit}>
        <h3 id="delete-account-heading" style={{ margin: 0, fontSize: 18 }}>Delete this account?</h3>
        <p className="empty-copy" style={{ marginTop: 8 }}>This cannot be undone. Confirm by typing <strong>{email}</strong> below, along with your password.</p>
        <label style={fieldStyle}>Email address
          <input style={inputStyle} name="email" type="email" autoComplete="username" placeholder={email} required />
        </label>
        <label style={fieldStyle}>Password
          <input style={inputStyle} name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}{showBilling && <> <Link href="/dashboard">Open billing</Link>.</>}</p>}
        <div style={rowStyle}>
          <button type="button" className="button button-ghost button-small" onClick={() => dialog.current?.close()}>Keep my account</button>
          <button type="submit" className="button button-small" style={{ background: "#a52a2a" }} disabled={busy}>{busy ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </form>
    </dialog>
  </section>;
}
