import type { ReactNode } from "react";
import { headingTag, type HeadingLevel } from "./heading";

export type SectionProps = {
  /** Anchor target, e.g. "how-it-works". */
  id?: string;
  /** Tinted full-bleed band, for alternating rhythm between plain sections. */
  tint?: boolean;
  /** Extra classes appended after "lp-section". */
  className?: string;
  /** Accessible name for the section, when the heading is not inside it. */
  "aria-label"?: string;
  children: ReactNode;
};

/** Standard content section wrapper (max 1100px, vertical rhythm, 375px-safe gutters). */
export function Section({ id, tint = false, className, children, ...rest }: SectionProps) {
  const classes = ["lp-section", tint ? "lp-section-tint" : null, className].filter(Boolean).join(" ");
  return <section id={id} className={classes} {...rest}>{children}</section>;
}

export type SectionHeadProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Supporting paragraph. Pass a string, or your own <p> elements as children. */
  body?: ReactNode;
  /** Center the block instead of aligning it left. */
  center?: boolean;
  /** Defaults to 2. Drop to 3 when this head sits under another h2. */
  headingLevel?: HeadingLevel;
  /** Anchor target on the heading itself. */
  headingId?: string;
  children?: ReactNode;
};

/** Eyebrow + heading + supporting copy, used at the top of a Section. */
export function SectionHead({ eyebrow, title, body, center = false, headingLevel = 2, headingId, children }: SectionHeadProps) {
  const Heading = headingTag(headingLevel);
  return (
    <div className={center ? "lp-section-head lp-center" : "lp-section-head"}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <Heading id={headingId}>{title}</Heading>
      {body ? <p>{body}</p> : null}
      {children}
    </div>
  );
}
