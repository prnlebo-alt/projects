import type { ReactNode } from "react";
import { headingTag, type HeadingLevel } from "./heading";

export type StepItem = {
  title: ReactNode;
  body: ReactNode;
};

export type StepsProps = {
  items: StepItem[];
  /** Heading level for each step title. Defaults to 3. */
  headingLevel?: HeadingLevel;
};

/** Numbered how-it-works list. The numbers come from a CSS counter, so the markup stays an ordered list. */
export function Steps({ items, headingLevel = 3 }: StepsProps) {
  const Heading = headingTag(headingLevel);
  return (
    <ol className="lp-steps">
      {items.map((item, index) => (
        <li className="lp-step" key={index}>
          <Heading>{item.title}</Heading>
          <p>{item.body}</p>
        </li>
      ))}
    </ol>
  );
}
