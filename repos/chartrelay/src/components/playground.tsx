"use client";

import { useCallback, useState } from "react";
import { sampleSpec } from "@/lib/charts/schema";
import { renderChart } from "@/lib/charts/render";
import { ChartPreview } from "./chart-preview";

type RenderResult = { svg: string; altText: string; warnings: Array<{ severity: string; code: string; message: string; suggestion: string }> };

export function Playground() {
  const [source, setSource] = useState(JSON.stringify(sampleSpec, null, 2));
  const [result, setResult] = useState<RenderResult | null>(() => renderChart(sampleSpec));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const render = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const spec = JSON.parse(source);
      const response = await fetch("/api/demo/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Render failed.");
      setResult(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invalid JSON.");
    } finally {
      setLoading(false);
    }
  }, [source]);

  function setPreset(type: string) {
    try {
      const next = { ...JSON.parse(source), type };
      setSource(JSON.stringify(next, null, 2));
      setTimeout(() => {
        const button = document.getElementById("render-button") as HTMLButtonElement | null;
        button?.click();
      });
    } catch { setError("Fix the JSON before changing presets."); }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return <div className="playground-shell">
    <section className="editor-panel">
      <div className="panel-head"><div><span className="eyebrow">Chart spec</span><h2>JSON in. Production asset out.</h2></div><button className="button button-ghost button-small" onClick={() => setSource(JSON.stringify(sampleSpec, null, 2))}>Reset</button></div>
      <div className="preset-row" aria-label="Chart type presets">{["bar", "line", "area", "pie", "scatter"].map((type) => <button key={type} onClick={() => setPreset(type)}>{type}</button>)}</div>
      <textarea aria-label="Chart JSON" spellCheck={false} value={source} onChange={(event) => setSource(event.target.value)} />
      {error && <p className="form-error">{error}</p>}
      <button id="render-button" className="button button-wide" onClick={() => void render()} disabled={loading}>{loading ? "Rendering…" : "Render chart"}</button>
    </section>
    <section className="result-panel">
      <div className="panel-head"><div><span className="eyebrow">Live output</span><h2>Deterministic and inspectable.</h2></div>{result && <button className="button button-ghost button-small" onClick={() => copy(result.svg)}>Copy SVG</button>}</div>
      <div className="preview-stage">{result ? <ChartPreview svg={result.svg} /> : <div className="empty-state">Your chart will appear here.</div>}</div>
      {result && <div className="quality-grid">
        <div className="quality-card"><span className="quality-label">Accessible summary</span><p>{result.altText}</p></div>
        <div className="quality-card"><span className="quality-label">QA review</span>{result.warnings.map((issue) => <div className={`issue issue-${issue.severity}`} key={issue.code}><strong>{issue.message}</strong><span>{issue.suggestion}</span></div>)}</div>
      </div>}
    </section>
  </div>;
}
