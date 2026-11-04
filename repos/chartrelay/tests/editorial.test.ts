import { describe, expect, it } from "vitest";
import {
  CHART_HEIGHT,
  CHART_HEIGHT_WITH_TRAIL,
  CHART_WIDTH,
  columns,
  dark,
  dotPlot,
  light,
  lines,
  makeFormat,
  MAX_SERIES,
  niceMax,
  slope,
  waterfall,
  width,
  wrap,
  type AgentTrail,
  type Datum,
  type Theme,
} from "@/lib/charts/editorial";

const points = (values: number[]): Datum[] => values.map((value, i) => ({ label: `P${i}`, value }));
const visibleText = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
/** First and last x in a column path: "M x,… L (x+w),… Z". Recovers the drawn bar width. */
const barWidths = (svg: string) => [...svg.matchAll(/<path d="M([\d.-]+),[\d.-]+ .*? L([\d.-]+),[\d.-]+ Z"/g)].map((match) => Number(match[2]) - Number(match[1]));

const trail: AgentTrail = {
  eyebrow: "agent run",
  columns: [
    { label: "source", value: "stripe balance_transactions", mono: true },
    { label: "checks", value: "reconciled against the ledger", status: true },
    { label: "takeaway", value: "Refunds ate the whole of August", strong: true },
  ],
};

/** Every chart drawn from the same points, so one assertion can sweep all five. */
const everyChart = (t: Theme, data: Datum[], agent?: AgentTrail): Record<string, string> => ({
  columns: columns({ t, title: "Title", subtitle: "Subtitle", source: "Source", data, agent }),
  lines: lines({ t, title: "Title", subtitle: "Subtitle", source: "Source", series: [{ name: "A", data }], agent }),
  slope: slope({ t, title: "Title", source: "Source", from: "Then", to: "Now", rows: data.map((d) => ({ label: d.label, from: d.value, to: d.value * 2 })), agent }),
  dotPlot: dotPlot({ t, title: "Title", source: "Source", data, agent }),
  waterfall: waterfall({ t, title: "Title", source: "Source", start: data[0], steps: data.slice(1), end: { label: "End" }, agent }),
});

describe("editorial charts", () => {
  it("renders well-formed SVG at the declared size", () => {
    for (const [name, svg] of Object.entries(everyChart(light, points([18400, 21300, 24700, 33900])))) {
      expect(svg, name).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg, name).toContain(`viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}"`);
      expect(svg, name).toContain('role="img"');
      expect(svg.trimEnd(), name).toMatch(/<\/svg>$/);
      expect(visibleText(svg), name).toContain("Title");
    }
  });

  it("reserves the taller canvas for the agent trail and prints its provenance", () => {
    for (const [name, svg] of Object.entries(everyChart(light, points([5, 9, 4]), trail))) {
      expect(svg, name).toContain(`viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT_WITH_TRAIL}"`);
      // The eyebrow is uppercased and set in the monospace register that marks the trail as machine output.
      expect(visibleText(svg), name).toContain("AGENT RUN");
      expect(svg, name).toContain(light.good);
    }
  });

  // The charts divide by a data range in every coordinate, so a degenerate range is the standing risk:
  // a literal "NaN" in an attribute makes the SVG unusable and sharp refuses to rasterize it.
  it.each([
    ["a normal series", points([18400, 21300, 24700])],
    ["a single datum", points([42])],
    ["an all-zero series", points([0, 0, 0])],
    ["a single zero", points([0])],
    ["negative values", points([-30, -10, -20])],
  ])("emits no NaN or Infinity for %s", (_label, data) => {
    for (const [name, svg] of Object.entries(everyChart(light, data))) {
      expect(svg, name).not.toMatch(/NaN/);
      expect(svg, name).not.toMatch(/Infinity/);
      expect(svg, name).not.toMatch(/undefined/);
    }
  });

  it("gives all eight series their own slot, and never paints two of them alike", () => {
    const svg = lines({ t: light, title: "Eight", series: Array.from({ length: MAX_SERIES }, (_, i) => ({ name: `S${i}`, data: points([1, 2, 3 + i]) })) });
    expect(svg).not.toContain('stroke="undefined"');
    const strokes = [...svg.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((m) => m[1]).filter((c) => light.series.includes(c));
    // Eight distinct paints. A cycling palette passes the "no undefined" check above and still fails here.
    expect(new Set(strokes).size).toBe(MAX_SERIES);
  });

  it("refuses a ninth series rather than reusing a hue", () => {
    const nine = Array.from({ length: MAX_SERIES + 1 }, (_, i) => ({ name: `S${i}`, data: points([1, 2, 3 + i]) }));
    expect(() => lines({ t: light, title: "Nine", series: nine })).toThrow(/at most 8 series/);
  });

  it("caps columns at 24px so a bar reads as a height, not an area", () => {
    const widths = barWidths(columns({ t: light, title: "Wide bands", data: points([10, 20, 30]) }));
    expect(widths).toHaveLength(3);
    for (const w of widths) expect(w).toBeLessThanOrEqual(24);
    expect(Math.max(...widths)).toBe(24);
  });

  it("omits a percent change measured from zero", () => {
    const svg = slope({ t: light, title: "From nothing", from: "Q1", to: "Q2", rows: [{ label: "New", from: 0, to: 500 }, { label: "Old", from: 200, to: 300 }] });
    expect(visibleText(svg)).toContain("+50%");
    expect(visibleText(svg).join(" ")).not.toMatch(/Infinity|NaN/);
  });

  it("renders the dark surface on the dark theme", () => {
    expect(columns({ t: dark, title: "Night", data: points([1, 2, 3]) })).toContain(`<rect width="${CHART_WIDTH}" height="${CHART_HEIGHT}" fill="${dark.surface}"/>`);
    expect(columns({ t: light, title: "Day", data: points([1, 2, 3]) })).toContain(`fill="${light.surface}"`);
    expect(dark.surface).not.toBe(light.surface);
  });

  it("escapes user-controlled XML in every text run", () => {
    const svg = columns({ t: light, title: "Ben & Jerry <b>", subtitle: "a < b & c", source: "R&D <internal>", data: [{ label: "A&B", value: 1 }, { label: "<script>", value: 2 }] });
    expect(svg).not.toContain("<b>");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("Ben &amp; Jerry &lt;b&gt;");
    expect(svg).toContain("a &lt; b &amp; c");
    expect(svg).toContain("R&amp;D &lt;internal&gt;");
    expect(svg).toContain("&lt;script&gt;");
  });
});

describe("makeFormat", () => {
  it("picks one unit for the whole chart, not one per value", () => {
    const format = makeFormat([18400, 33900, 34000]);
    expect([18400, 33900, 34000].map(format)).toEqual(["18.4K", "33.9K", "34K"]);
  });

  it("leaves numbers below 10,000 uncompacted", () => {
    const format = makeFormat([610, 9999]);
    expect(format(610)).toBe("610");
    expect(format(9999)).toBe("9,999");
  });

  // "1.0Kms" is not a unit any reader has ever wanted: a suffix turns compaction off entirely.
  it("suppresses compaction when the values carry a unit suffix", () => {
    const format = makeFormat([1200, 120000], { suffix: "ms" });
    expect(format(120000)).toBe("120,000ms");
    expect(format(1200)).toBe("1,200ms");
    expect([format(1200), format(120000)].join(" ")).not.toMatch(/K|M|B/);
  });

  it("keeps the prefix on the compacted form", () => {
    expect(makeFormat([18400, 33900], { prefix: "$" })(33900)).toBe("$33.9K");
    expect(makeFormat([4e6, 9e6], { prefix: "$" })(9e6)).toBe("$9M");
    expect(makeFormat([2e9], { prefix: "$" })(2e9)).toBe("$2B");
  });

  it("formats an empty or all-zero range without dividing by zero", () => {
    expect(makeFormat([])(0)).toBe("0");
    expect(makeFormat([0, 0])(0)).toBe("0");
  });
});

describe("editorial primitives", () => {
  it("keeps the axis ceiling on a number a reader would choose", () => {
    expect(niceMax(33900)).toBe(40000);
    expect(niceMax(1)).toBe(1);
    // A zero or negative ceiling would make every height a division by zero.
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
  });

  // Measuring a monospace string with the proportional ratio under-estimates it by about a fifth,
  // which is exactly enough for a label to run into whatever sits to its right.
  it("measures monospace wider than proportional text", () => {
    expect(width("a-hash-like-string", 11, 400, true)).toBeGreaterThan(width("a-hash-like-string", 11, 400, false));
    expect(width("bold", 12, 600)).toBeGreaterThan(width("bold", 12, 400));
  });

  it("wraps to the line budget and ellipsizes the overflow", () => {
    expect(wrap("one two three", 11, 400)).toEqual(["one two three"]);
    const clipped = wrap("the quick brown fox jumps over the lazy dog and keeps on running", 11, 60, 2);
    expect(clipped).toHaveLength(2);
    expect(clipped[1].endsWith("…")).toBe(true);
  });

  it("does not drop a word that is wider than the whole budget", () => {
    expect(wrap("supercalifragilistic", 11, 10, 3).join("")).toContain("supercalifragilistic");
  });
});

describe("the legend follows the number of series", () => {
  const one = [{ name: "Revenue", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }];
  const two = [...one, { name: "Cost", data: [{ label: "a", value: 3 }, { label: "b", value: 4 }] }];

  it("gives a single series no legend, because the title already names it", () => {
    const svg = lines({ t: light, title: "Revenue", series: one });
    // The line carries its own end label, so a legend box would be the same name printed twice.
    const swatches = [...svg.matchAll(/<rect [^>]*rx="2"/g)];
    expect(swatches).toHaveLength(0);
  });

  it("gives several series a legend as well as their end labels", () => {
    const svg = lines({ t: light, title: "Revenue and cost", series: two });
    expect([...svg.matchAll(/<rect [^>]*rx="2"/g)]).toHaveLength(2);
  });

  it("lets a caller turn the legend off for several series", () => {
    const svg = lines({ t: light, title: "Revenue and cost", series: two, showLegend: false });
    expect([...svg.matchAll(/<rect [^>]*rx="2"/g)]).toHaveLength(0);
    // The lines are still identified — turning off the legend must not cost identity.
    expect(svg).toContain("Revenue");
    expect(svg).toContain("Cost");
  });
});

describe("units on an axis", () => {
  it("never puts a unit on zero", () => {
    // "$0K" reads as a rounded figure rather than as nothing, and it sits on the baseline of every
    // chart whose values are large enough to compact.
    const money = makeFormat([18400, 40000], { prefix: "$" });
    expect(money(0)).toBe("$0");
    expect(money(40000)).toBe("$40K");
    expect(makeFormat([2e6])(0)).toBe("0");
  });

  it("puts the prefix on a line chart's axis, not only a bar's", () => {
    const svg = lines({ t: light, title: "Revenue", prefix: "$", series: [{ name: "R", data: [{ label: "a", value: 18400 }, { label: "b", value: 33900 }] }] });
    expect(visibleText(svg).some((text) => text.startsWith("$"))).toBe(true);
    expect(visibleText(svg)).toContain("$0");
  });
});

describe("an axis that has to hold negative numbers", () => {
  // The editorial renderer used to scale against Math.max(...values, 0), which is a domain only when
  // nothing is negative. All-negative data collapsed the maximum to zero and shipped an empty plot under
  // an axis reading "1, 1, 1, 0, 0" — with HTTP 200, a healthy QA finding, and alt text confidently
  // describing bars that were not on the canvas. These cases are the ones that shipped.
  const drawnBars = (svg: string) => [...svg.matchAll(/<path d="M[\d.-]+,[\d.-]+ [^"]*" fill="[^"]*"\/>/g)].length;
  const tickLabels = (svg: string) =>
    [...svg.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);

  it("draws every bar when every value is negative", () => {
    const svg = columns({ t: light, title: "All negative", data: points([-10, -25, -40, -15, -30]) });
    expect(drawnBars(svg)).toBe(5);
  });

  it("does not print the same tick three times for a negative domain", () => {
    const ticks = tickLabels(columns({ t: light, title: "All negative", data: points([-10, -25, -40, -15, -30]) }));
    expect(new Set(ticks).size).toBe(ticks.length);
    expect(ticks).toContain("0");
    expect(ticks.some((tick) => tick.startsWith("-"))).toBe(true);
  });

  it("keeps a negative mark inside the plot rather than off the canvas", () => {
    const svg = lines({ t: light, title: "Mixed", series: [{ name: "S", data: points([-40, -10, 15, 60, -5, 30]) }] });
    const ys = [...svg.matchAll(/<polyline[^>]*points="([^"]*)"/g)]
      .flatMap((match) => match[1].split(" ").map((pair) => Number(pair.split(",")[1])));
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeLessThanOrEqual(CHART_HEIGHT);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws a bar for a negative value, not a gap", () => {
    // The dangerous variant: four healthy bars and a missing one reads as "no data for C", not as -40.
    const svg = columns({ t: light, title: "One negative", data: points([10, 25, -40, 15, 30]) });
    expect(drawnBars(svg)).toBe(5);
  });

  it("measures bars from zero in both directions", () => {
    // Equal magnitudes on either side of zero must draw equal lengths, or the picture misstates the data.
    const svg = columns({ t: light, title: "Symmetric", data: points([30, -30]) });
    const heights = [...svg.matchAll(/<path d="M[\d.-]+,([\d.-]+) L[\d.-]+,([\d.-]+)/g)]
      .map((match) => Math.abs(Number(match[2]) - Number(match[1])));
    expect(heights).toHaveLength(2);
    expect(Math.abs(heights[0] - heights[1])).toBeLessThan(0.5);
  });

  it("gives an all-zero series a readable axis instead of a degenerate one", () => {
    const ticks = tickLabels(columns({ t: light, title: "Nothing happened", data: points([0, 0, 0, 0]) }));
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("still puts zero at the foot of the plot when nothing is negative", () => {
    // Ticks are emitted low to high, so the domain's foot is the first one drawn.
    const svg = columns({ t: light, title: "All positive", data: points([10, 25, 40]) });
    expect(tickLabels(svg)[0]).toBe("0");
  });
});

describe("axis labels below whole numbers", () => {
  // A rate, a ratio or a percentage lands on a domain whose step is under 1. The formatter rounded every
  // tick to an integer before printing, so a 0..1 axis read "0, 0, 1, 1, 1" and -0.45 was labelled "-0" —
  // the same collapsed-axis symptom as the negative-domain bug, reached by a different route.
  const tickLabels = (svg: string) =>
    [...svg.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);

  it("keeps fractional ticks distinct", () => {
    const ticks = tickLabels(columns({ t: light, title: "Rates", data: points([0.3, 0.7, 0.45]) }));
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("keeps fractional ticks distinct on a negative domain too", () => {
    const ticks = tickLabels(columns({ t: light, title: "Rates", data: points([-0.3, -0.7, -0.45]) }));
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("never prints a negative zero", () => {
    // Reachable because the decimal count is capped: a value below the cap rounds to zero and keeps its
    // sign, and "-0" on an axis reads as a typo rather than as a number.
    for (const data of [points([-0.3, -0.7, -0.45]), points([-0.04, 0.02]), points([-0.000_01, 0.000_02])]) {
      const svg = columns({ t: light, title: "Rates", data });
      expect(svg).not.toContain(">-0<");
      expect(svg).not.toMatch(/>-0\.0*</);
    }
  });

  it("prints a small value as itself rather than as zero", () => {
    const svg = columns({ t: light, title: "Rates", data: points([0.3, 0.7, 0.45]) });
    expect(svg).toContain(">0.45<");
  });

  it("leaves whole-number axes on whole numbers", () => {
    // The decimals come from the step, so a chart that never needed them must not grow them.
    const ticks = tickLabels(columns({ t: light, title: "Counts", data: points([10, 25, 40]) }));
    for (const tick of ticks) expect(tick).not.toContain(".");
  });
});
