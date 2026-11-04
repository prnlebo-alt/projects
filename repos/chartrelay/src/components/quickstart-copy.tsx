"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "copied" | "failed";

export type CopyButtonProps = {
  value: string;
  label?: string;
  /** Named in the button's accessible label, e.g. "the quickstart curl command". */
  describedAs?: string;
};

/**
 * Small client island for the otherwise server-rendered quickstart card.
 * Feedback is announced through a polite live region, not colour alone.
 */
export function CopyButton({ value, label = "Copy", describedAs }: CopyButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    try {
      // Unavailable in insecure contexts and in browsers that refuse the permission.
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    timer.current = setTimeout(() => setStatus("idle"), 2500);
  }

  return <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
    <button type="button" className="button button-ghost button-small" onClick={copy} aria-label={describedAs ? `${label}: ${describedAs}` : undefined}>
      {status === "copied" ? "Copied" : label}
    </button>
    <span role="status" aria-live="polite" className="empty-copy">
      {status === "copied" ? "Copied to the clipboard." : status === "failed" ? "Could not reach the clipboard — select the command above and copy it manually." : ""}
    </span>
  </div>;
}
