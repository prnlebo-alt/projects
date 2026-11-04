import type { ReactNode } from "react";

export type CodeCardProps = {
  /** Header strip text, e.g. "POST /api/v1/charts" or "Terminal". */
  label: ReactNode;
  /** The snippet, as a plain string. Use a template literal; it is rendered verbatim, never executed. */
  code: string;
  /** Optional caption under the card. */
  caption?: ReactNode;
};

/** Dark code block card, matching the cards on the home and docs pages. Scrolls horizontally at 375px. */
export function CodeCard({ label, code, caption }: CodeCardProps) {
  return (
    <div>
      <div className="code-card lp-code-card">
        <header>{label}</header>
        <pre><code>{code}</code></pre>
      </div>
      {caption ? <p className="lp-code-caption">{caption}</p> : null}
    </div>
  );
}
