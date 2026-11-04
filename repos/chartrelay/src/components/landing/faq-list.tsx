import type { ReactNode } from "react";
import { headingTag, type HeadingLevel } from "./heading";

export type FaqItem = {
  question: ReactNode;
  /** A string, or your own <p> elements for a multi-paragraph answer. */
  answer: ReactNode;
};

export type FaqListProps = {
  items: FaqItem[];
  /** Heading level for each question. Defaults to 3. */
  headingLevel?: HeadingLevel;
};

/** Always-open FAQ list: no client JavaScript, every answer readable and findable in the page text. */
export function FaqList({ items, headingLevel = 3 }: FaqListProps) {
  const Heading = headingTag(headingLevel);
  return (
    <ul className="lp-faq">
      {items.map((item, index) => (
        <li className="lp-faq-item" key={index}>
          <Heading>{item.question}</Heading>
          {typeof item.answer === "string" ? <p>{item.answer}</p> : item.answer}
        </li>
      ))}
    </ul>
  );
}
