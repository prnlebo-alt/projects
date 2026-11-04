import { describe, expect, it } from "vitest";
import { labelSlots, labelStride, width } from "@/lib/charts/labels";
import { columns, light, lines, type Datum } from "@/lib/charts/editorial";
import { renderChart } from "@/lib/charts/render";
import type { ChartSpec } from "@/lib/charts/schema";

const points = (count: number, prefix = "P"): Datum[] =>
  Array.from({ length: count }, (_, i) => ({ label: `${prefix}${i + 1}`, value: i + 1 }));

/** The category labels a chart actually drew, in document order. */
const drawnLabels = (svg: string, expected: string[]) =>
  [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).filter((t) => expected.includes(t));

const classicSpec = (count: number): ChartSpec => ({
  type: "bar",
  title: "T",
  series: [{ name: "S", data: points(count).map((p) => ({ label: p.label, value: p.value })) }],
  width: 900,
  height: 520,
  theme: "light",
  showLegend: true,
  showValues: false,
} as ChartSpec);

describe("how many labels fit", () => {
  it("draws every label when they all fit", () => {
    expect(labelStride(["Jan", "Feb", "Mar"], 11.5, 200)).toBe(1);
  });

  it("thins by the widest label, not the average", () => {
    const mostlyShort = ["Q1", "Q2", "Q3", "a very long category name indeed"];
    expect(labelStride(mostlyShort, 11.5, 20)).toBeGreaterThan(labelStride(["Q1", "Q2", "Q3", "Q4"], 11.5, 20));
  });

  it("always keeps the last slot, so the chart never looks truncated", () => {
    const slots = labelSlots(100, 5);
    expect(slots.has(99)).toBe(true);
  });

  it("keeps a slot it is told to keep, and drops its crowded neighbours", () => {
    const slots = labelSlots(100, 5, [50]);
    expect(slots.has(50)).toBe(true);
    for (const near of [47, 48, 49, 51, 52, 53]) expect(slots.has(near)).toBe(false);
  });

  it("keeps a protected slot that already sits on the stride", () => {
    expect(labelSlots(100, 5, [99]).has(99)).toBe(true);
  });

  it("degrades to one label rather than none", () => {
    const slots = labelSlots(100, 1000);
    expect(slots.size).toBeGreaterThanOrEqual(1);
  });
});

describe("a chart at the schema's hundred-point maximum", () => {
  // All 100 labels used to be drawn at full size into a solid unreadable band that also ran past the
  // right edge of the plot. The marks still show every point; the labels thin.
  const fits = (svg: string, labels: string[], size: number, band: number) => {
    const drawn = drawnLabels(svg, labels);
    for (let i = 1; i < drawn.length; i++) {
      const gap = band * (labels.indexOf(drawn[i]) - labels.indexOf(drawn[i - 1]));
      expect(gap, `"${drawn[i - 1]}" and "${drawn[i]}" overlap`).toBeGreaterThan(width(drawn[i], size));
    }
    return drawn;
  };

  it("thins the bar chart's labels instead of overprinting them", () => {
    const data = points(100);
    const labels = data.map((d) => d.label);
    const svg = columns({ t: light, title: "Dense", data });
    const drawn = fits(svg, labels, 11.5, (860 - 40 - 40 - 44) / 100);
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.length).toBeLessThan(100);
  });

  it("thins the line chart's labels too", () => {
    const data = points(100);
    const labels = data.map((d) => d.label);
    const svg = lines({ t: light, title: "Dense", series: [{ name: "S", data }] });
    expect(drawnLabels(svg, labels).length).toBeLessThan(100);
  });

  it("thins the classic renderer's labels", () => {
    const labels = points(100).map((d) => d.label);
    const svg = renderChart(classicSpec(100)).svg;
    expect(drawnLabels(svg, labels).length).toBeLessThan(100);
  });

  it("still draws a mark for every point it was given", () => {
    // Thinning is a labelling decision. Dropping data would be a different and much worse bug.
    const svg = columns({ t: light, title: "Dense", data: points(100) });
    expect([...svg.matchAll(/<path d="M[\d.-]+,[\d.-]+ L/g)]).toHaveLength(100);
  });

  it("leaves a normal twelve-month chart fully labelled", () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data: Datum[] = months.map((label, i) => ({ label, value: i + 1 }));
    const svg = columns({ t: light, title: "Year", data });
    expect(drawnLabels(svg, months)).toHaveLength(12);
  });

  it("keeps the focus bar's own label whatever the stride", () => {
    const data = points(100);
    const svg = columns({ t: light, title: "Dense", data, focus: 42 });
    expect(drawnLabels(svg, data.map((d) => d.label))).toContain("P43");
  });
});

describe("the figure states the decisions the renderer made", () => {
  const specOf = (seriesCount: number): ChartSpec => ({
    type: "bar",
    title: "Revenue",
    series: Array.from({ length: seriesCount }, (_, s) => ({
      name: `S${s + 1}`,
      data: ["Jan", "Feb", "Mar"].map((label, i) => ({ label, value: i + 1 + s })),
    })),
    width: 900,
    height: 520,
    theme: "light",
    showLegend: true,
    showValues: false,
  } as ChartSpec);

  it("says in the picture that bars were drawn as lines", async () => {
    // The response header said so already, but an <img src> — the surface this product exists for —
    // never sees a header, and lines assert continuity between categories that bars do not.
    const { renderStyled } = await import("@/lib/charts/style");
    const { svg, styleNote } = renderStyled(specOf(2), "editorial");
    expect(svg).toContain("drawn as lines");
    expect(styleNote).toBeTruthy();
  });

  it("says nothing when nothing was substituted", async () => {
    const { renderStyled } = await import("@/lib/charts/style");
    expect(renderStyled(specOf(1), "editorial").svg).not.toContain("drawn as lines");
  });

  it("carries its description where a screen reader can reach it", async () => {
    // role="img" with no accessible name announces "image" and nothing else.
    const { renderStyled } = await import("@/lib/charts/style");
    for (const count of [1, 2]) {
      const { svg, altText } = renderStyled(specOf(count), "editorial");
      expect(svg).toContain("<desc");
      expect(svg).toContain("<title");
      expect(svg).toContain("aria-labelledby");
      expect(svg).toContain(altText.slice(0, 40).replace(/&/g, "&amp;"));
    }
  });
});
