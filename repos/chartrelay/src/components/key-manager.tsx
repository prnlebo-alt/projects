"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Create a key, see it once, and know afterwards which key it was.
 *
 * The identifier beside the reveal (`cr_live_abc…9f2x`) is the point of storing `last4`: the secret is
 * gone after this screen, and without it a customer with three keys cannot say which one the dashboard
 * row refers to — which is the question they ask at the worst possible moment.
 */
export function KeyManager() {
  const router = useRouter();
  const [revealed, setRevealed] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"live" | "test">("live");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const key = sessionStorage.getItem("chartrelay_new_key");
    if (!key) return;
    // Clear storage only when the reveal actually happens, so a cancelled effect (e.g. React StrictMode) cannot lose the key.
    const timer = window.setTimeout(() => { sessionStorage.removeItem("chartrelay_new_key"); setRevealed(key); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: mode === "test" ? "Dashboard test key" : "Dashboard key", mode }),
    });
    const body = await response.json();
    if (response.ok) { setRevealed(body.key); setLabel(body.label ?? ""); router.refresh(); }
    else setError(typeof body.error === "string" ? body.error : "Could not create a key.");
    setBusy(false);
  }
  return <div className="key-actions">
    <label className="key-mode">Key type <select value={mode} onChange={(event) => setMode(event.target.value === "test" ? "test" : "live")} disabled={busy}>
      <option value="live">Live — billed</option>
      <option value="test">Test — watermarked, never billed</option>
    </select></label>
    <button className="button button-small" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create API key"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {revealed && <div className="secret-reveal">
      <strong>Copy this now. It will not be shown again.</strong>
      <code>{revealed}</code>
      {label && <p className="empty-copy">Listed afterwards as <code>{label}</code>.</p>}
      <button className="button button-ghost button-small" onClick={() => navigator.clipboard.writeText(revealed)}>Copy</button>
    </div>}
  </div>;
}
