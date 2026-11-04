import type { ReactNode } from "react";
import { headingTag, type HeadingLevel } from "./heading";

export type FeatureItem = {
  /** Short glyph or number shown in the tinted square, e.g. "01". Omit for a plain card. */
  icon?: ReactNode;
  title: ReactNode;
  body: ReactNode;
};

export type FeatureGridProps = {
  items: FeatureItem[];
  /** Columns on wide screens; always one column below 900px. Defaults to 3. */
  columns?: 2 | 3;
  /** Heading level for each card title. Defaults to 3. */
  headingLevel?: HeadingLevel;
  /** Extra cards appended after `items`, e.g. a card with a link inside. */
  children?: ReactNode;
};

/** Feature / benefit card grid. Server component. */
export function FeatureGrid({ items, columns = 3, headingLevel = 3, children }: FeatureGridProps) {
  const Heading = headingTag(headingLevel);
  return (
    <div className={columns === 2 ? "lp-grid lp-grid-2" : "lp-grid"}>
      {items.map((item, index) => (
        <article className="lp-card" key={index}>
          {item.icon ? <div className="lp-card-icon" aria-hidden="true">{item.icon}</div> : null}
          <Heading>{item.title}</Heading>
          <p>{item.body}</p>
        </article>
      ))}
      {children}
    </div>
  );
}
