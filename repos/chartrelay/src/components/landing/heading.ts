/** Heading levels the landing kit will render. Pick the one that keeps the page outline in order. */
export type HeadingLevel = 2 | 3 | 4 | 5;

/** Turns a level into a tag name React can render, without widening it to any string. */
export function headingTag(level: HeadingLevel) {
  return `h${level}` as "h2" | "h3" | "h4" | "h5";
}
