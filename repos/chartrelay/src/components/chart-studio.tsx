"use client";

/**
 * Paste a spreadsheet, get a chart.
 *
 * The on-ramp for someone who will never write JSON. Everything happens in the browser: inferSpec reads
 * the pasted text and toChartQuery turns the result into a /chart URL, which is then used as the `src`
 * of an ordinary <img>. That is deliberate rather than convenient — the preview is drawn by exactly the
 * endpoint a customer would call, so this page cannot show something the URL it hands out will not.
 *
 * The other half of the job is teaching without a tutorial. A person arrives with data and leaves
 * holding the URL that drew their chart, so the API is something they have already used rather than
 * something they have to go and read about.
 */

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { inferSpec } from "@/lib/charts/infer";
import { toChartQuery, type UrlChartStyle } from "@/lib/charts/url";
import { KEY_ENV_VAR } from "@/lib/api-key-env";
import type { ChartSpec } from "@/lib/charts/schema";

type Theme = "light" | "dark";

const EXAMPLES: Array<{ id: string; label: string; hint: string; table: string }> = [
  {
    id: "revenue",
    label: "Monthly revenue",
    hint: "Months and one money column — becomes a line",
    table: "Month\tRevenue\nApr\t$18,400\nMay\t$21,300\nJun\t$24,700\nJul\t$26,900\nAug\t$31,200\nSep\t$33,900",
  },
  {
    id: "channels",
    label: "Two channels",
    hint: "Two number columns — becomes two series",
    table: "Month\tOrganic\tPaid\nJun\t310\t402\nJul\t388\t431\nAug\t512\t448\nSep\t604\t455",
  },
  {
    id: "share",
    label: "Traffic share",
    hint: "Percentages that add to 100 — becomes a pie",
    table: "Source,Share\nSearch,43%\nDirect,27%\nReferral,16%\nSocial,9%\nEmail,5%",
  },
  {
    id: "movement",
    label: "Quarter movement",
    hint: "Gains and losses, one negative in brackets",
    table: "Line\tChange\nNew\t11200\nExpansion\t4100\nContraction\t(2300)\nChurn\t(3800)",
  },
];

/** Chart types a reader can pick by hand, after the inference has made its own choice. */
const TYPES: Array<{ value: ChartSpec["type"]; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "scatter", label: "Scatter" },
];

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  // Clipboard access can be refused (an insecure origin, a locked-down browser). Saying "copy failed"
  // beats a button that silently does nothing and leaves the reader thinking they have the URL.
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied && !failed) return;
    const timer = setTimeout(() => { setCopied(false); setFailed(false); }, 2000);
    return () => clearTimeout(timer);
  }, [copied, failed]);

  return (
    <button
      type="button"
      className="button button-ghost button-small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setFailed(true);
        }
      }}
    >
      {copied ? "Copied" : failed ? "Copy failed — select it by hand" : label}
    </button>
  );
}

export function ChartStudio({ origin }: { origin: string }) {
  const [table, setTable] = useState("");
  const [title, setTitle] = useState("");
  const [typeOverride, setTypeOverride] = useState<ChartSpec["type"] | "">("");
  const [theme, setTheme] = useState<Theme>("light");
  const [style, setStyle] = useState<UrlChartStyle>("editorial");
  const [source, setSource] = useState("");
  const textareaId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const result = useMemo(() => (table.trim() ? inferSpec(table) : null), [table]);

  // The reader's edits are applied on top of the inference rather than replacing it, so changing the
  // title never discards the column reading that got them here.
  const spec = useMemo<ChartSpec | null>(() => {
    if (!result?.ok) return null;
    const base = result.spec;
    return {
      ...base,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(typeOverride ? { type: typeOverride } : {}),
      theme,
    };
  }, [result, title, typeOverride, theme]);

  const query = useMemo(() => (spec ? toChartQuery(spec, { style, ...(source.trim() ? { source: source.trim() } : {}) }) : ""), [spec, style, source]);
  const chartUrl = query ? `${origin}/chart?${query}` : "";
  const svgUrl = query ? `${origin}/chart?${query}&format=svg` : "";

  const loadExample = useCallback((example: (typeof EXAMPLES)[number]) => {
    setTable(example.table);
    setTitle("");
    setTypeOverride("");
    setSource("");
    textarea.current?.focus();
  }, []);

  const apiCall = spec
    ? `curl -X POST ${origin}/api/v1/charts \\
  -H "authorization: Bearer $${KEY_ENV_VAR}" \\
  -H "content-type: application/json" \\
  -d '${JSON.stringify(spec)}'`
    : "";

  return (
    <div className="studio">
      <div className="studio-input">
        <label htmlFor={textareaId} className="studio-label">
          Paste from your spreadsheet
          <span>Copy the cells — including the header row — and paste them here. Tabs, commas, semicolons and pipes all work.</span>
        </label>
        <textarea
          id={textareaId}
          ref={textarea}
          className="studio-textarea"
          value={table}
          spellCheck={false}
          rows={9}
          placeholder={"Month\tRevenue\nApr\t18400\nMay\t21300\nJun\t24700"}
          onChange={(event) => setTable(event.target.value)}
        />

        <div className="studio-examples">
          <span className="studio-examples-label">Or start from one of these</span>
          <div className="studio-example-buttons">
            {EXAMPLES.map((example) => (
              <button key={example.id} type="button" className="button button-ghost button-small" onClick={() => loadExample(example)} title={example.hint}>
                {example.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && !result.ok && (
        <div className="studio-refusal" role="status">
          <p className="studio-refusal-title">That could not be read as a table</p>
          <p>{result.error}</p>
        </div>
      )}

      {result?.ok && spec && (
        <>
          <div className="studio-reading" role="status">
            <p className="studio-reading-why">{result.reason}</p>
            {result.warnings.length > 0 && (
              <ul className="studio-warnings">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="studio-controls">
            <label>
              Title
              <input type="text" value={title} placeholder={spec.title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              Chart type
              <select value={typeOverride} onChange={(event) => setTypeOverride(event.target.value as ChartSpec["type"] | "")}>
                <option value="">Chosen for me ({result.spec.type})</option>
                {TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Style
              <select value={style} onChange={(event) => setStyle(event.target.value as UrlChartStyle)}>
                <option value="editorial">Editorial</option>
                <option value="classic">Classic</option>
              </select>
            </label>
            <label className="studio-control-wide">
              Source line
              <input type="text" value={source} placeholder="Source: finance ledger" onChange={(event) => setSource(event.target.value)} />
            </label>
          </div>

          <figure className="studio-preview">
            {/*
              An ordinary <img> pointed at the live endpoint. Next's image component would proxy and
              re-encode it, which would mean the picture on this page is not the bytes the URL below
              returns — and that URL is the thing being demonstrated.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chartUrl} alt={`${spec.title}. Chart drawn from the pasted table.`} width={860} height={480} />
            <figcaption>Drawn by the URL below, on the live endpoint. Free charts carry the mark; a paid key removes it.</figcaption>
          </figure>

          <div className="studio-handoff">
            <div className="studio-handoff-block">
              <div className="studio-handoff-head">
                <h3>The URL that drew it</h3>
                <CopyButton value={chartUrl} label="Copy URL" />
              </div>
              <p className="studio-handoff-body">Paste it into an email, a README, Notion, Slack or a spreadsheet. It needs no account and never expires.</p>
              <code className="studio-code">{chartUrl}</code>
              <p className="studio-handoff-links">
                <a href={chartUrl} download="chart.png">Download PNG</a>
                <a href={svgUrl} download="chart.svg">Download SVG</a>
                <Link href="/integrations">See where to paste it</Link>
              </p>
            </div>

            <div className="studio-handoff-block">
              <div className="studio-handoff-head">
                <h3>The same chart from your code</h3>
                <CopyButton value={apiCall} label="Copy request" />
              </div>
              <p className="studio-handoff-body">This stores the chart, returns its alt text and its QA findings, and gives you a short permanent link.</p>
              <pre className="studio-code studio-code-block">{apiCall}</pre>
              <p className="studio-handoff-links">
                <Link href="/register">Get a free API key</Link>
                <Link href="/docs">Read the reference</Link>
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
