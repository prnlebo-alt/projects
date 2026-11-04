import { describe, expect, it } from "vitest";
import { analyzeChart } from "@/lib/charts/qa";
import { renderChart } from "@/lib/charts/render";
import { MAX_VALUE_MAGNITUDE, chartSpecSchema, sampleSpec, type ChartSpec } from "@/lib/charts/schema";

const TYPES = ["bar", "line", "area", "pie", "scatter"] as const;

const withValues = (values: number[], overrides: Partial<ChartSpec> = {}): ChartSpec => ({
  ...sampleSpec,
  ...overrides,
  series: [{ name: "Series", data: values.map((value, index) => ({ label: `L${index}`, value })) }],
});

/** Geometry attributes whose value must always parse as a finite number. */
const NUMERIC_ATTRIBUTES = ["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "width", "height"];

/**
 * The invariant: an SVG ChartRelay stores and serves with HTTP 201 must never contain a coordinate
 * that is not a finite number. "NaN" and "Infinity" are what broken arithmetic writes into the
 * markup; "∞" is what Intl.NumberFormat writes for a non-finite value in a label.
 */
function expectFiniteSvg(svg: string) {
  expect(svg).not.toMatch(/NaN|Infinity|∞/);
  for (const attribute of NUMERIC_ATTRIBUTES) {
    for (const match of svg.matchAll(new RegExp(`<[a-z]+ [^>]*?\\b${attribute}="([^"]*)"`, "g"))) {
      if (match[1].endsWith("%")) continue; // width="100%" on the background rect
      expect(Number.isFinite(Number(match[1]))).toBe(true);
    }
  }
  // Polyline/polygon point lists and pie path data carry coordinates outside attributes of their own.
  // \b keeps this off id="cr-title-…", which also ends in a d.
  for (const match of svg.matchAll(/\b(?:points|d)="([^"]*)"/g)) {
    for (const token of match[1].split(/[\s,]+/)) {
      if (!token || /^[A-Za-z]$/.test(token)) continue;
      expect(Number.isFinite(Number(token))).toBe(true);
    }
  }
}

describe("extreme numeric inputs", () => {
  it("renders finite SVG for values at the edge of the double range, for every chart type", () => {
    // The reported reproduction: the schema accepted any finite number, so maxValue - minValue
    // overflowed to Infinity and every coordinate came out as Infinity / Infinity = NaN.
    for (const type of TYPES) {
      const { svg, altText } = renderChart(withValues([-1e308, 1e308], { type }));
      expectFiniteSvg(svg);
      expect(altText).not.toMatch(/NaN|Infinity|∞/);
      expect(svg).toContain("<svg");
    }
  });

  it("renders finite SVG for mixed-sign extremes, denormals and a single huge point", () => {
    const cases: number[][] = [
      [1e308, -1e308, 5e-324],
      [-1e308, -1e307, 1e308],
      [Number.MAX_VALUE, -Number.MAX_VALUE],
      [Number.MIN_VALUE, Number.MAX_VALUE],
      [1e308],
      [-1e308],
    ];
    for (const values of cases) {
      for (const type of TYPES) {
        const { svg, altText } = renderChart(withValues(values, { type, showValues: true }));
        expectFiniteSvg(svg);
        expect(altText).not.toMatch(/NaN|Infinity|∞/);
      }
    }
  });

  it("renders finite SVG for a series of identical values, including all zeros", () => {
    for (const values of [[7, 7, 7], [0, 0, 0], [-3, -3, -3], [1e15, 1e15]]) {
      for (const type of TYPES) {
        expectFiniteSvg(renderChart(withValues(values, { type, showValues: true })).svg);
      }
    }
  });

  it("never describes a trend it cannot compute as a finite percentage", () => {
    // 5e-324 as the first point makes ((end - start) / |start|) * 100 overflow, which toFixed
    // would have written into the chart's own <desc> as the word "Infinity".
    const { altText, svg } = renderChart(withValues([5e-324, 1e15], { type: "line" }));
    expect(altText).not.toMatch(/increased|decreased/);
    expect(svg).toContain("<desc");
    expectFiniteSvg(svg);
  });

  it("bounds the accepted magnitude in the schema, so the overflow is unreachable through the API", () => {
    const accepts = (value: number) => chartSpecSchema.safeParse({ ...sampleSpec, series: [{ name: "S", data: [{ label: "A", value }] }] }).success;
    expect(accepts(1e308)).toBe(false);
    expect(accepts(-1e308)).toBe(false);
    expect(accepts(MAX_VALUE_MAGNITUDE * 10)).toBe(false);
    // Generous for real data: a thousand times world GDP in dollars is still accepted.
    expect(accepts(MAX_VALUE_MAGNITUDE)).toBe(true);
    expect(accepts(-MAX_VALUE_MAGNITUDE)).toBe(true);
    expect(accepts(1e14)).toBe(true);
    expect(accepts(0)).toBe(true);
    expect(accepts(-1234.56)).toBe(true);
  });

  it("keeps rendering deterministic for values that need no clamping", () => {
    expect(renderChart(sampleSpec).svg).toBe(renderChart(sampleSpec).svg);
  });
});

describe("whitespace-only strings", () => {
  it("treats a title of spaces as a missing title, as /chart-check promises", () => {
    // The page says the rule fires when "the title is empty or still the placeholder". A title of
    // spaces used to come back "healthy", which contradicted both the rule and the marketing claim.
    const parsed = chartSpecSchema.parse({ ...sampleSpec, title: "   " });
    expect(parsed.title).toBe("");
    expect(analyzeChart(parsed).map((issue) => issue.code)).toContain("missing-title");

    // analyzeChart is also called with specs that did not come through the schema.
    expect(analyzeChart({ ...sampleSpec, title: " \t\n " }).map((issue) => issue.code)).toContain("missing-title");
    expect(analyzeChart({ ...sampleSpec, title: "  Untitled chart  " }).map((issue) => issue.code)).toContain("missing-title");
    expect(analyzeChart({ ...sampleSpec, title: "   " }).some((issue) => issue.code === "healthy")).toBe(false);
  });

  it("trims titles, series names and point labels, and rejects blank ones", () => {
    const parsed = chartSpecSchema.parse({ ...sampleSpec, title: "  Monthly revenue  ", subtitle: "  up 84%  ", series: [{ name: "  MRR  ", data: [{ label: "  Apr  ", value: 1 }] }] });
    expect(parsed.title).toBe("Monthly revenue");
    expect(parsed.subtitle).toBe("up 84%");
    expect(parsed.series[0].name).toBe("MRR");
    expect(parsed.series[0].data[0].label).toBe("Apr");

    const blank = (series: unknown) => chartSpecSchema.safeParse({ ...sampleSpec, series }).success;
    expect(blank([{ name: "   ", data: [{ label: "A", value: 1 }] }])).toBe(false);
    expect(blank([{ name: "S", data: [{ label: "   ", value: 1 }] }])).toBe(false);
  });
});
