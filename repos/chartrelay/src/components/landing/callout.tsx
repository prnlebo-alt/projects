import type { ReactNode } from "react";

export type CalloutProps = {
  /** "accent" (default) for a note, "warn" for a limitation the reader must not miss. */
  tone?: "accent" | "warn";
  /** Small uppercase label, e.g. "What QA does not do". */
  title?: ReactNode;
  /** A string, or your own <p> elements. */
  children: ReactNode;
};

/** Callout / note box for caveats and clarifications. Server component. */
export function Callout({ tone = "accent", title, children }: CalloutProps) {
  return (
    <aside className={tone === "warn" ? "lp-note lp-note-warn" : "lp-note"}>
      {title ? <strong>{title}</strong> : null}
      {typeof children === "string" ? <p>{children}</p> : children}
    </aside>
  );
}
