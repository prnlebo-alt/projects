"use client";

import Link from "next/link";
import { useCallback, useId, useState } from "react";
import { ChartPreview } from "./chart-preview";

type Severity = "error" | "warning" | "tip";
type Finding = { severity: Severity; code: string; message: string; suggestion: string };
type CheckResult = { svg: string; altText: string; warnings: Finding[] };
type ChartType = "bar" | "line" | "area" | "pie" | "scatter";
type CheckError = { kind: "limit" | "plain"; message: string };
type Series = { name: string; data: Array<{ label: string; value: number }> };

const CHART_TYPES: ChartType[] = ["bar", "line", "area", "pie", "scatter"];

const SEVERITY_PILL: Record<Severity, string> = { error: "status-pill status-danger", warning: "status-pill status-warning", tip: "status-pill status-good" };
const SEVERITY_LABEL: Record<Severity, string> = { error: "Error", warning: "Warning", tip: "Tip" };

const HEALTHY_TABLE = `Month, MRR
Apr, 18400
May, 21300
Jun, 24700
Jul, 26900
Aug, 31200
Sep, 33900`;

/** Each example is built to trip specific rules in the QA engine, so the findings panel is never empty theatre. */
const EXAMPLES: Array<{ id: string; label: string; hint: string; type: ChartType; title: string; table: string }> = [
  {
    id: "pie-slices",
    label: "Pie with nine slices",
    hint: "Trips pie-too-many-slices.",
    type: "pie",
    title: "Support tickets by channel",
    table: `Channel, Tickets
Email, 412
Chat, 388
Phone, 240
In-app, 187
Docs, 119
Forum, 96
Social, 64
Partner, 41
Other, 22`,
  },
  {
    id: "ten-series",
    label: "Ten series on one line chart",
    hint: "Trips too-many-series and dense-chart.",
    type: "line",
    title: "Weekly active teams by plan",
    table: `Week, Acme, Borealis, Cinder, Drift, Everlark, Foundry, Greenlit, Halcyon, Ironwood, Juniper
W1, 120, 98, 143, 77, 165, 54, 131, 88, 109, 62
W2, 128, 104, 138, 81, 171, 58, 126, 92, 114, 66
W3, 133, 111, 130, 86, 168, 63, 121, 97, 118, 71
W4, 141, 117, 126, 92, 174, 69, 117, 101, 123, 75
W5, 149, 124, 121, 97, 179, 74, 113, 106, 129, 80
W6, 158, 131, 118, 103, 186, 79, 110, 112, 134, 84`,
  },
  {
    id: "untitled",
    label: "Untitled chart, long labels",
    hint: "Trips missing-title and long-labels.",
    type: "bar",
    title: "Untitled chart",
    table: `Region, Revenue
North America, 412000
Europe and Middle East, 318000
Asia Pacific, 276000
Latin America, 94000`,
  },
];

const fieldStyle = { width: "100%", padding: "11px 12px", border: "1px solid var(--line)", borderRadius: "10px", background: "#ffffff", color: "var(--ink)" } as const;
const labelStyle = { display: "grid", gap: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: 750 } as const;
const hintStyle = { margin: 0, color: "var(--muted)", fontSize: "12px", fontWeight: 550, lineHeight: 1.5 } as const;

/**
 * Turns the label/value table into the `series` array the chart schema expects.
 * First row: the category column name, then one column name per series. Every later row is one category.
 */
function parseTable(text: string): { ok: true; series: Series[] } | { ok: false; error: string } {
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter((row) => row.length > 0);
  if (rows.length < 2) return { ok: false, error: "Add a header row and at least one row of data." };
  const header = rows[0].split(",").map((cell) => cell.trim());
  const names = header.slice(1).filter((name) => name.length > 0);
  if (names.length !== header.length - 1 || names.length === 0) return { ok: false, error: "The header row needs a category name and then one name per series, e.g. Month, Revenue." };
  const series: Series[] = names.map((name) => ({ name, data: [] }));
  for (let index = 1; index < rows.length; index++) {
    const cells = rows[index].split(",").map((cell) => cell.trim());
    if (cells.length !== header.length) return { ok: false, error: `Row ${index + 1} has ${cells.length} values but the header has ${header.length}.` };
    if (!cells[0]) return { ok: false, error: `Row ${index + 1} is missing a category label.` };
    for (let column = 0; column < names.length; column++) {
      const raw = cells[column + 1];
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) return { ok: false, error: `Row ${index + 1}, column "${names[column]}" is not a number: "${raw}".` };
      series[column].data.push({ label: cells[0], value });
    }
  }
  return { ok: true, series };
}

export function ChartChecker() {
  const fieldId = useId();
  const [type, setType] = useState<ChartType>("bar");
  const [title, setTitle] = useState("Monthly recurring revenue");
  const [table, setTable] = useState(HEALTHY_TABLE);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<CheckError | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async (spec: { type: ChartType; title: string; table: string }) => {
    const parsed = parseTable(spec.table);
    if (!parsed.ok) {
      setError({ kind: "plain", message: parsed.error });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: spec.type, title: spec.title, series: parsed.series }),
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after"));
        setResult(null);
        setError({ kind: "limit", message: Number.isFinite(retryAfter) && retryAfter > 0 ? `The free checker allows 30 checks a minute from one address. Try again in ${retryAfter} second${retryAfter === 1 ? "" : "s"}.` : "The free checker allows 30 checks a minute from one address. Try again in a moment." });
        return;
      }
      const body = await response.json();
      if (!response.ok) {
        const issues: string[] = (body?.details?.issues ?? []).map((issue: { path: string; message: string }) => `${issue.path}: ${issue.message}`);
        setResult(null);
        setError({ kind: "plain", message: [body?.error ?? "The chart could not be checked.", ...issues.slice(0, 3)].join(" ") });
        return;
      }
      setResult(body as CheckResult);
    } catch {
      setResult(null);
      setError({ kind: "plain", message: "The check could not reach the server. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  function loadExample(example: (typeof EXAMPLES)[number]) {
    setType(example.type);
    setTitle(example.title);
    setTable(example.table);
    void check({ type: example.type, title: example.title, table: example.table });
  }

  return (
    <div className="lp-grid lp-grid-2">
      <section className="lp-card" aria-labelledby={`${fieldId}-form-heading`}>
        <h3 id={`${fieldId}-form-heading`}>Describe the chart</h3>
        <p style={{ marginBottom: "20px" }}>No account and no API key. The chart is rendered and returned to you, not stored.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void check({ type, title, table });
          }}
        >
          <label style={labelStyle} htmlFor={`${fieldId}-type`}>
            Chart type
            <select id={`${fieldId}-type`} style={fieldStyle} value={type} onChange={(event) => setType(event.target.value as ChartType)}>
              {CHART_TYPES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle} htmlFor={`${fieldId}-title`}>
            Title
            <input id={`${fieldId}-title`} style={fieldStyle} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What should the reader take away?" />
            <span style={hintStyle}>Leave it empty to see what the missing-title rule says.</span>
          </label>

          <label style={labelStyle} htmlFor={`${fieldId}-table`}>
            Data
            <textarea
              id={`${fieldId}-table`}
              style={{ ...fieldStyle, minHeight: "190px", resize: "vertical", font: "13px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace" }}
              spellCheck={false}
              value={table}
              onChange={(event) => setTable(event.target.value)}
              aria-describedby={`${fieldId}-table-hint`}
            />
            <span id={`${fieldId}-table-hint`} style={hintStyle}>
              First row: the category column, then one column per series. Each later row is one category. Up to 12 series and 100 rows.
            </span>
          </label>

          {error ? (
            <p className="form-error block-error" role="alert" style={{ marginBottom: "14px" }}>
              {error.message}
              {error.kind === "limit" ? <> <Link href="/register" style={{ color: "var(--accent-dark)", fontWeight: 750, textDecoration: "underline" }}>Create a free account</Link> for API access without the demo limit.</> : null}
            </p>
          ) : null}

          <button type="submit" className="button button-wide" disabled={loading}>{loading ? "Checking…" : "Check this chart"}</button>
        </form>

        <div style={{ marginTop: "22px" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: 850, letterSpacing: ".06em", textTransform: "uppercase" }}>Or load an example</h4>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "10px" }}>
            {EXAMPLES.map((example) => (
              <li key={example.id} style={{ display: "grid", gap: "4px" }}>
                <button type="button" className="button button-ghost button-small" style={{ justifySelf: "start", textAlign: "left" }} onClick={() => loadExample(example)} disabled={loading}>
                  {example.label}
                </button>
                <span style={hintStyle}>{example.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="lp-card" aria-labelledby={`${fieldId}-result-heading`} aria-live="polite" aria-busy={loading}>
        <h3 id={`${fieldId}-result-heading`}>Review</h3>
        {result ? (
          <>
            <div className="preview-stage" style={{ minHeight: "240px", marginBottom: "20px" }}>
              <ChartPreview svg={result.svg} />
            </div>

            <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 850, letterSpacing: ".06em", textTransform: "uppercase" }}>Alt text</h4>
            <p style={{ marginBottom: "20px" }}>{result.altText}</p>

            <h4 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 850, letterSpacing: ".06em", textTransform: "uppercase" }}>
              {result.warnings.length} finding{result.warnings.length === 1 ? "" : "s"}
            </h4>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "16px" }}>
              {result.warnings.map((finding, index) => (
                <li key={`${finding.code}-${index}`} className={`issue issue-${finding.severity}`} style={{ marginTop: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span className={SEVERITY_PILL[finding.severity]}>{SEVERITY_LABEL[finding.severity]}</span>
                    <code style={{ fontSize: "12px", color: "var(--accent-dark)" }}>{finding.code}</code>
                  </span>
                  <strong>{finding.message}</strong>
                  <span>{finding.suggestion}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Run a check and the rendered SVG, its alt text, and every QA finding with its suggested fix appear here.</p>
        )}
      </section>
    </div>
  );
}
