import type { ReactNode } from "react";

export type ComparisonRow = {
  /** Row header, rendered as <th scope="row">. */
  label: ReactNode;
  /** One cell per column in `columns`. */
  cells: ReactNode[];
};

export type ComparisonTableProps = {
  /** Column headers, excluding the row-label column. */
  columns: ReactNode[];
  rows: ComparisonRow[];
  /**
   * Visible caption and accessible name for the scroll region. Date any competitor claim here,
   * e.g. "Published pricing, checked 22 September 2026."
   */
  caption: string;
  /** Header above the row-label column. Defaults to an empty cell. */
  rowHeader?: ReactNode;
  /** Sources and qualifications under the table. */
  footnote?: ReactNode;
};

/**
 * Comparison table in a keyboard-scrollable region (it scrolls sideways at 375px instead of squashing).
 * Only put claims in here that can be checked against a public, dated source.
 */
export function ComparisonTable({ columns, rows, caption, rowHeader, footnote }: ComparisonTableProps) {
  return (
    <div>
      <div className="lp-table-wrap" role="region" aria-label={caption} tabIndex={0}>
        <table className="lp-table">
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{rowHeader ?? <span className="lp-visually-hidden">Capability</span>}</th>
              {columns.map((column, index) => <th scope="col" key={index}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">{row.label}</th>
                {row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote ? <p className="lp-table-note">{footnote}</p> : null}
    </div>
  );
}
