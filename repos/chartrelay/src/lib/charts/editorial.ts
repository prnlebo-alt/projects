/**
 * Editorial SVG charts: the five figures a person would draw by hand, in the house style.
 *
 * Deliberately import-free. This module is reachable from a client component, so it must not pull in
 * "@/lib/db" (better-sqlite3 is a native addon and will not bundle), the filesystem, or the network.
 * Everything below is string concatenation over numbers, which also makes the output byte-deterministic
 * for a given input — the same property renderChart relies on for its caching.
 *
 * Mark specs follow the dataviz skill: bars <=24px with a 4px rounded data-end square at the baseline,
 * 2px lines with round joins, end-dots r>=4 carrying a 2px surface ring, hairline solid gridlines, and
 * text that never wears the series color.
 */
import { MONO, SANS } from "./fonts";
import { labelSlots, labelStride, width } from "./labels";
import { makeFormat, type NumberFormatter } from "./numbers";

export interface Theme {
  surface: string;
  plane: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  baseline: string;
  good: string;
  /**
   * Positional, not decorative: [0] is the focus hue, [1] the contrast hue used for fallers and
   * losses, [2] the "up" hue in a waterfall. Reordering it changes what the charts mean.
   */
  series: readonly string[];
  quiet: string;
}

export const light: Theme = {
  surface: "#fcfcfb", plane: "#f9f9f7", ink: "#0b0b0b", ink2: "#52514e", muted: "#898781",
  grid: "#e1e0d9", baseline: "#c3c2b7", good: "#006300",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"], quiet: "#cfcec7",
};

export const dark: Theme = {
  surface: "#1a1a19", plane: "#0d0d0d", ink: "#ffffff", ink2: "#c3c2b7", muted: "#898781",
  grid: "#2c2c2a", baseline: "#383835", good: "#0ca30c",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"], quiet: "#454541",
};

/** Canvas is fixed: the type sizes, paddings and label reservations below are all tuned to this width. */
export const CHART_WIDTH = 860;
export const CHART_HEIGHT = 480;
/** Taller, because the agent trail occupies a reserved band at the foot. */
export const CHART_HEIGHT_WITH_TRAIL = 584;



export type TextAnchor = "start" | "middle" | "end";
export type { NumberFormatter } from "./numbers";
export { makeFormat, type FormatOptions } from "./numbers";

export interface Datum {
  label: string;
  value: number;
}

export interface Series {
  name: string;
  data: Datum[];
}

/** One column of the machine-provenance trail printed under the figure. */
export interface AgentColumn {
  label: string;
  value: string;
  /** Monospace reads as machine output — use it for ids, hashes, model names, timings. */
  mono?: boolean;
  /** Ink instead of ink2, for the one column the reader should notice first. */
  strong?: boolean;
  /** Draws the good-state dot beside the label. */
  status?: boolean;
}

export interface AgentTrail {
  eyebrow: string;
  columns: AgentColumn[];
}

/** Chrome shared by every chart. Callers guarantee non-empty data; the schema layer enforces that. */
export interface ChartChrome {
  t: Theme;
  /** The figure's description, carried into the SVG so assistive technology can reach it. */
  altText?: string;
  title: string;
  subtitle?: string;
  source?: string;
  /**
   * A short statement about the figure itself, drawn in the figure.
   *
   * For decisions this renderer made that the caller did not ask for. A response header announcing a
   * substitution is invisible to the surface this product exists to serve — an `<img src>` in an email
   * or a README carries the picture and nothing else — so a decision that changes what the marks
   * assert has to be legible in the picture.
   */
  notice?: string;
  agent?: AgentTrail;
}

export const esc = (s: string | number): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// width lives in ./labels so the classic renderer can measure with it too, without depending on this file.
export { width } from "./labels";






export interface TextOptions {
  size?: number;
  /** Required: an undefined fill silently writes fill="undefined" and the glyphs disappear. */
  fill: string;
  weight?: number;
  anchor?: TextAnchor;
  opacity?: number;
  mono?: boolean;
  tracking?: number;
}

export const text = (
  x: number,
  y: number,
  content: string | number,
  { size = 12, fill, weight = 400, anchor = "start", opacity, mono = false, tracking }: TextOptions,
): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${mono ? MONO : SANS}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${tracking ? ` letter-spacing="${tracking}"` : ""}${opacity ? ` opacity="${opacity}"` : ""}>${esc(content)}</text>`;

/** Wraps to a pixel budget using the same approximate advance width the label placement uses. */
export function wrap(content: string | number, size: number, maxWidth: number, maxLines = 2, mono = false): string[] {
  const words = String(content).split(/\s+/);
  const lines: string[][] = [[]];
  for (const word of words) {
    const current = lines[lines.length - 1];
    const candidate = [...current, word].join(" ");
    if (width(candidate, size, 400, mono) > maxWidth && current.length) lines.push([word]);
    else current.push(word);
  }
  const out = lines.slice(0, maxLines).map((l) => l.join(" "));
  if (lines.length > maxLines) out[maxLines - 1] = `${out[maxLines - 1].replace(/[,.;]?$/, "")}…`;
  return out;
}

/**
 * A bar with its data-end rounded and its baseline end square — the spec's asymmetry, drawn as a path.
 *
 * `down` flips which end is rounded. A bar for a negative value hangs below the zero line, so its data
 * end is the bottom; rounding the top instead would put the soft edge against the axis and the hard
 * edge at the number, which reads as a bar that was cut off rather than one that points downward.
 */
export function column(x: number, y: number, w: number, h: number, r: number, fill: string, down = false): string {
  const radius = Math.min(r, w / 2, Math.max(h, 0));
  // Sub-pixel bars are a smudge, not a mark, and a zero-height rounded path folds in on itself.
  if (h <= 0.5) return "";
  if (down) {
    return `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${x.toFixed(1)},${(y + h - radius).toFixed(1)} Q${x.toFixed(1)},${(y + h).toFixed(1)} ${(x + radius).toFixed(1)},${(y + h).toFixed(1)} L${(x + w - radius).toFixed(1)},${(y + h).toFixed(1)} Q${(x + w).toFixed(1)},${(y + h).toFixed(1)} ${(x + w).toFixed(1)},${(y + h - radius).toFixed(1)} L${(x + w).toFixed(1)},${y.toFixed(1)} Z" fill="${fill}"/>`;
  }
  return `<path d="M${x.toFixed(1)},${(y + h).toFixed(1)} L${x.toFixed(1)},${(y + radius).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + radius).toFixed(1)},${y.toFixed(1)} L${(x + w - radius).toFixed(1)},${y.toFixed(1)} Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + radius).toFixed(1)} L${(x + w).toFixed(1)},${(y + h).toFixed(1)} Z" fill="${fill}"/>`;
}

/** Horizontal bar, rounded at the value end only. */
export function rowBar(x: number, y: number, w: number, h: number, r: number, fill: string): string {
  const radius = Math.min(r, h / 2, Math.max(w, 0));
  if (w <= 0.5) return "";
  return `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${(x + w - radius).toFixed(1)},${y.toFixed(1)} Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + radius).toFixed(1)} L${(x + w).toFixed(1)},${(y + h - radius).toFixed(1)} Q${(x + w).toFixed(1)},${(y + h).toFixed(1)} ${(x + w - radius).toFixed(1)},${(y + h).toFixed(1)} L${x.toFixed(1)},${(y + h).toFixed(1)} Z" fill="${fill}"/>`;
}

/** End-dot with the 2px surface ring that keeps it legible where marks cross. */
export const dot = (cx: number, cy: number, fill: string, surface: string, r = 4.5): string =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${fill}" stroke="${surface}" stroke-width="2"/>`;

export const line = (points: Array<[number, number]>, stroke: string, w = 2): string =>
  `<polyline points="${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;

/** Most series any one figure may carry: the validated palette is eight slots deep and is never cycled. */
export const MAX_SERIES = 8;

/**
 * The palette is a fixed order, not a cycle.
 *
 * Indexing it directly drew a fourth series with stroke="undefined" — an invalid paint sharp rejects
 * outright — but the obvious repair, `index % length`, is worse than the crash it fixed: it hands two
 * different series the same hue, so the legend reads blue twice and identity stops meaning anything.
 * The slot order is itself the colour-blind-safety mechanism, every adjacent pair having been checked
 * for separation against both surfaces; a cycle discards that silently.
 *
 * Past eight series no hue is invented. The caller folds the tail into "Other", facets into small
 * multiples, or is refused — the same choice the QA layer already makes for a pie with too many slices.
 */
const seriesColor = (t: Theme, index: number): string => {
  const color = t.series[index];
  if (color === undefined) {
    throw new RangeError(`A chart can carry at most ${MAX_SERIES} series; got ${index + 1}. Fold the smallest into "Other", or draw small multiples.`);
  }
  return color;
};

export interface FrameOptions {
  w: number;
  h: number;
  t: Theme;
  /**
   * The figure's own description, for assistive technology.
   *
   * Without it the SVG claimed `role="img"` and offered no accessible name, so a screen reader
   * announced "image" and nothing else — and the description this product computes so carefully was
   * reachable only through a response header, which an `<img src>` never sees.
   */
  altText?: string;
  title: string;
  subtitle?: string;
  source?: string;
  notice?: string;
  body: string;
  legend?: string;
  agent?: AgentTrail;
}

/**
 * Chart frame. With `agent`, the figure also carries the machine's trail.
 *
 * The trail is kept in a different typographic register from the data — monospace, small, muted, below
 * a hairline — because "an agent made this" should be legible without the chart itself looking generated.
 * Everything above the rule is the same editorial chart a person would draw; everything below it is
 * provenance the reader can audit.
 */
export function frame({ w, h, t, altText, title, subtitle, source, notice, body, legend = "", agent }: FrameOptions): string {
  const eyebrow = agent
    ? text(40, 26, agent.eyebrow.toUpperCase(), { size: 9.5, fill: t.muted, mono: true, tracking: 1.1 })
    : "";
  const titleY = agent ? 58 : 46;
  const parts = [
    `<rect width="${w}" height="${h}" fill="${t.surface}"/>`,
    eyebrow,
    text(40, titleY, title, { size: 19, fill: t.ink, weight: 600 }),
    subtitle ? text(40, titleY + 23, subtitle, { size: 13.5, fill: t.ink2 }) : "",
    legend,
    body,
  ];

  if (agent) {
    const top = h - 116;
    parts.push(`<line x1="40" y1="${top}" x2="${w - 40}" y2="${top}" stroke="${t.grid}" stroke-width="1"/>`);
    const gap = 28;
    // The trail is a three-column grid regardless of how many columns are supplied, so a short trail
    // keeps the same rhythm as a full one instead of stretching to fill the width.
    const colW = (w - 80 - gap * 2) / 3;
    agent.columns.forEach((col, i) => {
      const x = 40 + (colW + gap) * i;
      // The status mark rides on the label row, where nothing wraps into it.
      if (col.status) parts.push(`<circle cx="${x + 4}" cy="${top + 19}" r="3.5" fill="${t.good}"/>`);
      parts.push(text(x + (col.status ? 14 : 0), top + 23, col.label.toUpperCase(), { size: 9.5, fill: t.muted, mono: true, tracking: 1.1 }));
      const size = col.mono ? 10.5 : 11.5;
      wrap(col.value, size, colW, 3, col.mono).forEach((lineText, li) => {
        parts.push(text(x, top + 45 + li * 15, lineText, { size, fill: col.strong ? t.ink : t.ink2, mono: col.mono }));
      });
    });
    if (source) parts.push(text(40, h - 14, source, { size: 10, fill: t.muted, mono: true }));
  } else if (source) {
    parts.push(text(40, h - 20, source, { size: 11, fill: t.muted }));
  }

  if (notice) {
    // Foot-right, in the monospace register the rest of the machine's own statements use, so it reads
    // as a note about the figure rather than as part of the data. The watermark sits top-right.
    const y = agent ? h - 14 : h - 20;
    const room = w - 80 - (source ? width(source, agent ? 10 : 11, 400, Boolean(agent)) + 24 : 0);
    const [line] = wrap(notice, 10.5, room, 1, true);
    parts.push(text(w - 40, y, line, { size: 10.5, fill: t.muted, anchor: "end", mono: true }));
  }

  // aria-labelledby rather than a bare <title>: a <desc> alone is not announced as the image's name by
  // every screen reader, and the pair is what the classic renderer already emits.
  const described = altText ?? title;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="cr-t cr-d"><title id="cr-t">${esc(title)}</title><desc id="cr-d">${esc(described)}</desc>
  ${parts.filter(Boolean).join("\n  ")}
</svg>`;
}

export interface CalloutOptions {
  dx?: number;
  dy?: number;
  maxWidth?: number;
}

/** A leader line from a point on the plot to a short machine-written note. Classic annotation, no box. */
export function callout(x: number, y: number, note: string, t: Theme, { dx = 26, dy = -34, maxWidth = 190 }: CalloutOptions = {}): string {
  const tx = x + dx, ty = y + dy;
  const anchor: TextAnchor = dx < 0 ? "end" : "start";
  const lines = wrap(note, 11, maxWidth, 2, true);
  return [
    `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${(ty + 4).toFixed(1)}" stroke="${t.baseline}" stroke-width="1"/>`,
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${t.ink2}"/>`,
    ...lines.map((l, i) => text(tx + (dx < 0 ? -6 : 6), ty - (lines.length - 1 - i) * 14, l, { size: 11, fill: t.ink2, anchor, mono: true })),
  ].join("\n  ");
}

export interface LegendEntry {
  name: string;
  color: string;
}

export interface LegendOptions {
  x?: number;
  y?: number;
}

/** Legend row: a mark in the series color, the name in ink. Identity never rests on color alone. */
export function legendRow(entries: LegendEntry[], t: Theme, { x = 40, y = 93 }: LegendOptions = {}): string {
  let cursor = x;
  const parts: string[] = [];
  for (const { name, color } of entries) {
    parts.push(`<rect x="${cursor.toFixed(1)}" y="${(y - 7).toFixed(1)}" width="9" height="9" rx="2" fill="${color}"/>`);
    parts.push(text(cursor + 15, y, name, { size: 11.5, fill: t.ink2 }));
    cursor += 15 + width(name, 11.5) + 20;
  }
  return parts.join("\n  ");
}

/** Nice round ceiling for an axis, so gridlines land on numbers a reader would choose. */
export function niceMax(value: number): number {
  // Also the floor for degenerate data: an all-zero series would otherwise scale by 0 and every
  // coordinate would be NaN. A 0..1 axis is the honest way to draw "nothing happened".
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

interface Geometry {
  H: number;
  PAD: { l: number; r: number; t: number; b: number };
}

interface Plot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scale {
  /** Domain foot and head, both snapped out to a round step. Zero always lies between them. */
  lo: number;
  hi: number;
  /** Distance between ticks. The formatter needs it to know how many decimals to print. */
  step: number;
  ticks: number[];
  /** Pixel y for a value within a plot. */
  y: (value: number, plot: Plot) => number;
}

/** Round step for an axis, so gridlines land on numbers a reader would have chosen. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (rough <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

/**
 * The axis domain for signed data.
 *
 * Every editorial chart used to scale against `Math.max(...values, 0)` alone, which is a domain only
 * when no value is negative. All-negative data collapsed that maximum to zero and drew an empty plot
 * under an axis reading 1, 1, 1, 0, 0; mixed-sign data drew the negative marks outside the plot, over
 * the category labels and off the canvas. Either way the alt text still described the numbers, so the
 * figure and its own description disagreed.
 *
 * Zero stays inside the domain even when the data does not reach it, because a bar's length is only
 * proportional to its value when it is measured from zero.
 */
export function linearScale(values: number[], tickCount = 4): Scale {
  const finite = values.filter((value) => Number.isFinite(value));
  const lowest = Math.min(...finite, 0);
  const highest = Math.max(...finite, 0);
  // Zero is always in the domain, so the two ends can only coincide when every value is zero. That series
  // has no range to divide: a 0..1 axis with a single step is the honest way to draw "nothing happened",
  // and it beats the old degenerate axis that printed the same rounded tick three times.
  const degenerate = highest === lowest;
  const step = degenerate ? 1 : niceStep((highest - lowest) / tickCount);
  const lo = degenerate ? 0 : Math.floor(lowest / step) * step;
  const hi = degenerate ? 1 : Math.ceil(highest / step) * step;
  const ticks: number[] = [];
  // Half a step of slack: lo + n*step accumulates binary error, and a tick landing at 29.999999 would
  // otherwise be dropped from an axis that should end at 30.
  for (let value = lo; value <= hi + step / 2; value += step) ticks.push(Number(value.toFixed(10)));
  return {
    lo,
    hi,
    step,
    ticks,
    y: (value, plot) => plot.y + plot.h - ((value - lo) / (hi - lo)) * plot.h,
  };
}

/**
 * Geometry depends on whether the figure carries the agent trail: the trail needs a reserved band at the
 * foot, and the eyebrow above the title pushes the plot down. The plot area itself is unchanged, so the
 * marks are identical in both variants — only the chrome around them differs.
 */
const geom = (agent?: AgentTrail): Geometry => ({
  H: agent ? CHART_HEIGHT_WITH_TRAIL : CHART_HEIGHT,
  PAD: { l: 40, r: 40, t: agent ? 130 : 118, b: agent ? 160 : 56 },
});

/** Gridlines: hairline, solid, recessive — and the only place a number appears on the y side. */
function grid(t: Theme, scale: Scale, plot: Plot, format: NumberFormatter): string {
  const out: string[] = [];
  for (const value of scale.ticks) {
    const y = scale.y(value, plot);
    // Zero is the baseline wherever it lands. With negatives in the data that is no longer the foot of
    // the plot, and the reader needs to see which line the marks are measured from.
    const isZero = Math.abs(value) < 1e-9;
    out.push(`<line x1="${plot.x}" y1="${y.toFixed(1)}" x2="${(plot.x + plot.w).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${isZero ? t.baseline : t.grid}" stroke-width="1"/>`);
    out.push(text(plot.x - 10, y + 4, format(value), { size: 11, fill: t.muted, anchor: "end" }));
  }
  return out.join("\n  ");
}

export interface ColumnsOptions extends ChartChrome {
  data: Datum[];
  /** Index of the bar that carries the argument. Defaults to the last, the usual "where we are now". */
  focus?: number;
  prefix?: string;
}

/**
 * Column chart that says which bar matters.
 *
 * The editorial move: one focus bar in the series hue, the rest in a quiet gray, and the value
 * labelled directly on the focus bar so the reader's eye lands on the point before the axis.
 */
export function columns({ t, altText, title, subtitle, source, data, focus = data.length - 1, prefix = "", agent }: ColumnsOptions): string {
  const { H, PAD } = geom(agent);
  const scale = linearScale(data.map((d) => d.value));
  const format = makeFormat([...data.map((d) => d.value), ...scale.ticks], { prefix, step: scale.step });
  const plot: Plot = { x: PAD.l + 44, y: PAD.t, w: CHART_WIDTH - PAD.l - PAD.r - 44, h: H - PAD.t - PAD.b };
  const band = plot.w / data.length;
  // Capped at 24px: wider than that and a column reads as an area, which invites the eye to compare
  // the bar's mass rather than its height.
  const barW = Math.min(24, band - 14);
  const body = [grid(t, scale, plot, format)];
  const zeroY = scale.y(0, plot);
  // At the schema's 100-point maximum every label used to be drawn at full size, producing an
  // unreadable band across the foot of the chart. The marks still show every point; the labels thin.
  const labelled = labelSlots(data.length, labelStride(data.map((d) => d.label), 11.5, band), [focus]);

  data.forEach((d, i) => {
    // Bars grow from zero, not from the foot of the plot, so a negative value hangs below the baseline
    // instead of being drawn at a negative height and landing outside the figure entirely.
    const valueY = scale.y(d.value, plot);
    const y = Math.min(valueY, zeroY);
    const h = Math.abs(valueY - zeroY);
    const x = plot.x + band * i + (band - barW) / 2;
    const isFocus = i === focus;
    body.push(column(x, y, barW, h, 4, isFocus ? t.series[0] : t.quiet, d.value < 0));
    if (labelled.has(i)) {
      body.push(text(x + barW / 2, plot.y + plot.h + 20, d.label, { size: 11.5, fill: isFocus ? t.ink : t.muted, anchor: "middle", weight: isFocus ? 600 : 400 }));
    }
    if (isFocus) {
      // The value sits outside the bar on the side it grows, so it never overprints the mark it labels.
      body.push(text(x + barW / 2, d.value < 0 ? y + h + 16 : y - 10, format(d.value), { size: 13, fill: t.ink, anchor: "middle", weight: 600 }));
    }
  });
  return frame({ w: CHART_WIDTH, h: H, t, altText, title, subtitle, source, agent, body: body.join("\n  ") });
}

export interface LineAnnotation {
  index: number;
  text: string;
}

export interface LineNote extends CalloutOptions {
  index: number;
  text: string;
}

export interface LinesOptions extends ChartChrome {
  series: Series[];
  /** Currency or unit marker in front of every number, as `columns` takes. A money line needs it too. */
  prefix?: string;
  suffix?: string;
  /** Dashed vertical rule with a heading, for "this is when the thing happened". */
  annotate?: LineAnnotation;
  /** Leader-line note attached to a point on the first series. */
  note?: LineNote;
  /**
   * Suppresses the legend for several series. One series never gets one regardless: the title already
   * names it, so a legend box repeating that name is a second label for a fact already stated, and it
   * sat directly above a line that carries its own end label.
   */
  showLegend?: boolean;
}

/**
 * Multi-series line with direct end labels.
 *
 * A legend is present because there are two or more series, and each line is also labelled at its
 * end — so identity survives both a colorblind reader and a black-and-white printout.
 */
export function lines({ t, altText, title, subtitle, source, notice, series, prefix = "", suffix = "", annotate, agent, note, showLegend = true }: LinesOptions): string {
  const { H, PAD } = geom(agent);
  const points = series[0].data.length;
  const values = series.flatMap((s) => s.data.map((d) => d.value));
  const scale = linearScale(values);
  const format = makeFormat([...values, ...scale.ticks], { prefix, suffix, step: scale.step });
  const labelRoom = 72;
  const plot: Plot = { x: PAD.l + 52, y: PAD.t, w: CHART_WIDTH - PAD.l - PAD.r - 52 - labelRoom, h: H - PAD.t - PAD.b };
  // A single point has no step, and plot.w / 0 is Infinity — which turns the second coordinate into
  // NaN and, from there, every x in the polyline. One point sits at the left edge of the plot.
  const stepX = points > 1 ? plot.w / (points - 1) : 0;
  const body = [grid(t, scale, plot, format)];

  series.forEach((s, si) => {
    const color = seriesColor(t, si);
    const coords: Array<[number, number]> = s.data.map((d, i) => [plot.x + stepX * i, scale.y(d.value, plot)]);
    body.push(line(coords, color));
    const [lx, ly] = coords[coords.length - 1];
    body.push(dot(lx, ly, color, t.surface));
    body.push(text(lx + 12, ly + 4, s.name, { size: 11.5, fill: t.ink2, weight: 600 }));
    body.push(text(lx + 12, ly + 18, format(s.data[s.data.length - 1].value), { size: 11, fill: t.muted }));
  });

  const labelled = labelSlots(points, labelStride(series[0].data.map((d) => d.label), 11.5, stepX || plot.w), [0]);
  series[0].data.forEach((d, i) => {
    // The first point is kept alongside the last: between them they state the span the line covers.
    if (!labelled.has(i)) return;
    body.push(text(plot.x + stepX * i, plot.y + plot.h + 20, d.label, { size: 11.5, fill: t.muted, anchor: "middle" }));
  });

  if (annotate) {
    const ax = plot.x + stepX * annotate.index;
    body.push(`<line x1="${ax.toFixed(1)}" y1="${plot.y}" x2="${ax.toFixed(1)}" y2="${plot.y + plot.h}" stroke="${t.baseline}" stroke-width="1" stroke-dasharray="3 3"/>`);
    // Flip the heading to the left of the rule when it would otherwise run off the plot.
    const anchor: TextAnchor = ax + width(annotate.text, 11.5) + 14 > plot.x + plot.w ? "end" : "start";
    body.push(text(anchor === "end" ? ax - 8 : ax + 8, plot.y - 10, annotate.text, { size: 11.5, fill: t.ink2, anchor, weight: 600 }));
  }

  if (note) {
    const s0 = series[0];
    const px = plot.x + stepX * note.index;
    const py = scale.y(s0.data[note.index].value, plot);
    body.push(callout(px, py, note.text, t, note));
  }

  return frame({
    w: CHART_WIDTH, h: H, t, altText, title, subtitle, source, notice, agent,
    legend: series.length > 1 && showLegend
      ? legendRow(series.map((s, i) => ({ name: s.name, color: seriesColor(t, i) })), t, { y: agent ? 105 : 93 })
      : "",
    body: body.join("\n  "),
  });
}

export interface SlopeRow {
  label: string;
  from: number;
  to: number;
}

export interface SlopeOptions extends ChartChrome {
  /** Axis headings for the two moments, e.g. "2023" and "2024". */
  from: string;
  to: string;
  rows: SlopeRow[];
  prefix?: string;
  suffix?: string;
}

/**
 * Slope chart: two moments, one line each, the thing consultants reach for and dashboard libraries
 * do not ship. Risers and fallers separate by color, and every endpoint is labelled.
 */
export function slope({ t, title, subtitle, source, from, to, rows, prefix = "", suffix = "", agent }: SlopeOptions): string {
  const { H, PAD } = geom(agent);
  const values = rows.flatMap((r) => [r.from, r.to]);
  const format = makeFormat(values, { prefix, suffix });
  const max = niceMax(Math.max(...values, 0)), min = 0;
  const plot: Plot = { x: PAD.l + 132, y: PAD.t + 8, w: CHART_WIDTH - PAD.l - PAD.r - 132 - 214, h: H - PAD.t - PAD.b - 16 };
  const scale = (v: number) => plot.y + plot.h - ((v - min) / (max - min)) * plot.h;
  const body = [
    `<line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.h}" stroke="${t.grid}" stroke-width="1"/>`,
    `<line x1="${plot.x + plot.w}" y1="${plot.y}" x2="${plot.x + plot.w}" y2="${plot.y + plot.h}" stroke="${t.grid}" stroke-width="1"/>`,
    text(plot.x, plot.y - 16, from, { size: 11.5, fill: t.muted, anchor: "middle", weight: 600 }),
    text(plot.x + plot.w, plot.y - 16, to, { size: 11.5, fill: t.muted, anchor: "middle", weight: 600 }),
  ];

  for (const row of rows) {
    const y1 = scale(row.from), y2 = scale(row.to);
    const rose = row.to >= row.from;
    const color = rose ? t.series[0] : t.series[1];
    body.push(line([[plot.x, y1], [plot.x + plot.w, y2]], color));
    body.push(dot(plot.x, y1, color, t.surface));
    body.push(dot(plot.x + plot.w, y2, color, t.surface));
    body.push(text(plot.x - 14, y1 + 4, `${row.label}  ${format(row.from)}`, { size: 11.5, fill: t.ink2, anchor: "end" }));
    // The name repeats on the right: with lines crossing, tracing one back to its left-hand label is work.
    const delta = row.to - row.from;
    const right = `${row.label}  ${format(row.to)}`;
    body.push(text(plot.x + plot.w + 14, y2 + 4, right, { size: 12, fill: t.ink, weight: 600 }));
    // Percent change needs a baseline to be a percentage of. The prototype divided regardless and
    // printed "+Infinity%" beside a row that started at zero, or "NaN%" when both ends were zero.
    if (row.from !== 0) {
      body.push(text(plot.x + plot.w + 14 + width(right, 12, 600) + 10, y2 + 4,
        `${delta >= 0 ? "+" : "−"}${Math.abs(Math.round((delta / row.from) * 100))}%`, { size: 11, fill: t.muted }));
    }
  }
  return frame({ w: CHART_WIDTH, h: H, t, title, subtitle, source, agent, body: body.join("\n  ") });
}

export interface DotPlotOptions extends ChartChrome {
  data: Datum[];
  prefix?: string;
  /** Highlights this category instead of the largest one. */
  focusLabel?: string;
}

/** Ranked dot plot — the honest form for "compare these categories", where a pie would mislead. */
export function dotPlot({ t, title, subtitle, source, data, prefix = "", focusLabel, agent }: DotPlotOptions): string {
  const { H, PAD } = geom(agent);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = niceMax(Math.max(...sorted.map((d) => d.value), 0));
  const format = makeFormat([...sorted.map((d) => d.value), max], { prefix });
  // Seeded with 0: Math.max of an empty list is -Infinity, which would drag the whole plot origin
  // to -Infinity and make every coordinate NaN.
  const labelW = Math.max(...sorted.map((d) => width(d.label, 12)), 0) + 16;
  const plot: Plot = { x: PAD.l + labelW, y: PAD.t, w: CHART_WIDTH - PAD.l - PAD.r - labelW - 70, h: H - PAD.t - PAD.b };
  const step = plot.h / sorted.length;
  const body: string[] = [];

  for (let i = 0; i <= 4; i++) {
    const x = plot.x + (plot.w / 4) * i;
    body.push(`<line x1="${x.toFixed(1)}" y1="${plot.y - 6}" x2="${x.toFixed(1)}" y2="${(plot.y + plot.h).toFixed(1)}" stroke="${i === 0 ? t.baseline : t.grid}" stroke-width="1"/>`);
    body.push(text(x, plot.y + plot.h + 20, format((max / 4) * i), { size: 11, fill: t.muted, anchor: "middle" }));
  }

  sorted.forEach((d, i) => {
    const y = plot.y + step * i + step / 2;
    const x = plot.x + (d.value / max) * plot.w;
    const isFocus = focusLabel ? d.label === focusLabel : i === 0;
    const color = isFocus ? t.series[0] : t.quiet;
    body.push(`<line x1="${plot.x}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="2"/>`);
    body.push(dot(x, y, color, t.surface, 5.5));
    body.push(text(plot.x - 14, y + 4, d.label, { size: 12, fill: isFocus ? t.ink : t.ink2, anchor: "end", weight: isFocus ? 600 : 400 }));
    body.push(text(x + 14, y + 4, format(d.value), { size: 12, fill: isFocus ? t.ink : t.muted, weight: isFocus ? 600 : 400 }));
  });
  return frame({ w: CHART_WIDTH, h: H, t, title, subtitle, source, agent, body: body.join("\n  ") });
}

export interface WaterfallOptions extends ChartChrome {
  start: Datum;
  /** Signed deltas applied in order; the sign picks the color and the label's + or minus. */
  steps: Datum[];
  /** Only the label is used — the closing total is the running sum, not a number the caller asserts. */
  end: { label: string };
  prefix?: string;
}

interface WaterfallBar {
  label: string;
  from: number;
  to: number;
  kind: "total" | "up" | "down";
  delta?: number;
}

/** Waterfall: where a number went, step by step. Gains and losses are separated by color AND by sign in the label. */
export function waterfall({ t, title, subtitle, source, start, steps, end, prefix = "", agent }: WaterfallOptions): string {
  const { H, PAD } = geom(agent);
  const bars: WaterfallBar[] = [];
  let running = start.value;
  bars.push({ label: start.label, from: 0, to: start.value, kind: "total" });
  for (const step of steps) {
    const next = running + step.value;
    bars.push({ label: step.label, from: running, to: next, kind: step.value >= 0 ? "up" : "down", delta: step.value });
    running = next;
  }
  bars.push({ label: end.label, from: 0, to: running, kind: "total" });

  const max = niceMax(Math.max(...bars.flatMap((b) => [b.from, b.to]), 0));
  const format = makeFormat([...bars.map((b) => b.to), ...steps.map((s) => Math.abs(s.value)), max], { prefix });
  const plot: Plot = { x: PAD.l + 50, y: PAD.t, w: CHART_WIDTH - PAD.l - PAD.r - 50, h: H - PAD.t - PAD.b };
  const band = plot.w / bars.length;
  const barW = Math.min(24, band - 20);
  const scale = (v: number) => plot.y + plot.h - (v / max) * plot.h;
  const body = [
    `<line x1="${plot.x}" y1="${(plot.y + plot.h).toFixed(1)}" x2="${(plot.x + plot.w).toFixed(1)}" y2="${(plot.y + plot.h).toFixed(1)}" stroke="${t.baseline}" stroke-width="1"/>`,
  ];

  bars.forEach((b, i) => {
    const x = plot.x + band * i + (band - barW) / 2;
    const top = scale(Math.max(b.from, b.to)), bottom = scale(Math.min(b.from, b.to));
    const color = b.kind === "total" ? t.series[0] : b.kind === "up" ? t.series[2] : t.series[1];
    body.push(column(x, top, barW, bottom - top, 4, color));
    body.push(text(x + barW / 2, plot.y + plot.h + 20, b.label, { size: 11.5, fill: t.ink2, anchor: "middle", weight: b.kind === "total" ? 600 : 400 }));
    const delta = b.delta ?? 0;
    const caption = b.kind === "total" ? format(b.to) : `${delta >= 0 ? "+" : "−"}${format(Math.abs(delta))}`;
    body.push(text(x + barW / 2, top - 10, caption, { size: 12, fill: t.ink, anchor: "middle", weight: 600 }));
    if (i < bars.length - 1) {
      const nextX = plot.x + band * (i + 1) + (band - barW) / 2;
      const y = scale(b.to);
      body.push(`<line x1="${(x + barW).toFixed(1)}" y1="${y.toFixed(1)}" x2="${nextX.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${t.baseline}" stroke-width="1" stroke-dasharray="2 3"/>`);
    }
  });
  return frame({ w: CHART_WIDTH, h: H, t, title, subtitle, source, agent, body: body.join("\n  ") });
}
