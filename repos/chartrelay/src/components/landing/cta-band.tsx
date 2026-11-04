import type { ReactNode } from "react";
import { headingTag, type HeadingLevel } from "./heading";

export type CtaBandProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** CTA row. Inside the dark band, .button turns white and .button-ghost turns outlined-on-dark automatically. */
  actions?: ReactNode;
  /** Small print under the CTAs. */
  note?: ReactNode;
  /** Defaults to 2. */
  headingLevel?: HeadingLevel;
  id?: string;
};

/** Dark closing call-to-action band. Server component. */
export function CtaBand({ eyebrow, title, body, actions, note, headingLevel = 2, id }: CtaBandProps) {
  const Heading = headingTag(headingLevel);
  return (
    <section className="lp-cta-band" id={id}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <Heading>{title}</Heading>
      {body ? <p>{body}</p> : null}
      {actions ? <div className="lp-cta-actions">{actions}</div> : null}
      {note ? <p className="lp-cta-note">{note}</p> : null}
    </section>
  );
}
