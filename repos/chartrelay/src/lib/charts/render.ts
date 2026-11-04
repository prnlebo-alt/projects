import { analyzeChart } from "./qa";
import { MAX_VALUE_MAGNITUDE, palette, type ChartSpec } from "./schema";
import { SANS } from "./fonts";
import { labelSlots, labelStride } from "./labels";
import { makeFormat } from "./numbers";
import { decimalsForValues, fixed, preciseFormat } from "./numbers";
import { assertSvgWithinLimits, limitsFor, type PlanTier } from "./validation";

/**
 * A render that ran out of time.
 *
 * Mapped to the published `render_failed` code (HTTP 500), which the billing spec says is **never
 * charged** — the caller gets nothing, so the caller pays nothing.
 */
export class RenderTimeoutError extends Error {
  readonly code = "render_failed" as const;
  readonly status = 500 as const;
  readonly budgetMs: number;
  readonly elapsedMs: number;

  constructor(budgetMs: number, elapsedMs: number) {
    super(`The chart took longer than the ${budgetMs} ms render budget (${elapsedMs} ms) and was abandoned.`);
    this.name = "RenderTimeoutError";
    this.budgetMs = budgetMs;
    this.elapsedMs = elapsedMs;
  }
}

/**
 * The 10 s render timeout from docs/BILLING_SPEC.md, enforced cooperatively.
 *
 * Rendering is synchronous and CPU-bound, so there is no `setTimeout` that could ever fire while it
 * runs and no `AbortSignal` anything would observe: a watchdog on the event loop is a watchdog that
 * gets its turn only after the thing it was watching has finished. The only way to bound a
 * synchronous renderer in-process is for the renderer to look at the clock itself, which is what
 * `checkDeadline()` below does — at the start, once per gridline, once per series and every 256
 * points, so the cost is a `Date.now()` per few hundred emitted elements and the abort lands
 * mid-render rather than after it.
 *
 * The deadline is module state rather than a parameter threaded through every drawing function
 * because nothing can interleave with it: the renderer contains no `await`, so between
 * `beginDeadline` and the `finally` that clears it, this is the only code running in the process.
 * `withRenderDeadline` is the only way to set it, and it always clears it.
 *
 * What this is not: a cap on resident memory. That belongs to the container (a Railway memory limit
 * and `--max-old-space-size`), which is outside this module and is called out as missing in
 * `reports/BILLING_AUDIT.md` §7. The in-render stand-in is the output cap — `maxSvgBytes` per tier,
 * checked in `renderChartWithin` — since for this renderer the SVG string *is* the allocation that
 * grows with hostile input.
 */
let deadlineAt = Number.POSITIVE_INFINITY;
let deadlineBudgetMs = 0;
let deadlineStartedAt = 0;

function checkDeadline() {
  if (deadlineAt === Number.POSITIVE_INFINITY) return;
  const now = Date.now();
  if (now >= deadlineAt) throw new RenderTimeoutError(deadlineBudgetMs, now - deadlineStartedAt);
}

/** How often the point loops look at the clock. Small enough to abort promptly, large enough to be free. */
const DEADLINE_CHECK_STRIDE = 256;

/**
 * Runs `fn` under a wall-clock budget.
 *
 * Two layers, because only one renderer is instrumented. Inside, `checkDeadline()` aborts the
 * classic renderer part-way. Outside, the elapsed time is checked once `fn` returns, so a renderer
 * with no checkpoints of its own (the editorial one, `./editorial.ts`) still cannot quietly serve a
 * chart that took a minute — it is refused after the fact instead of aborted during. Nesting is
 * allowed and the inner, nearer deadline wins.
 */
export function withRenderDeadline<T>(budgetMs: number, fn: () => T): T {
  const previousAt = deadlineAt;
  const previousBudget = deadlineBudgetMs;
  const previousStart = deadlineStartedAt;
  const startedAt = Date.now();
  deadlineStartedAt = startedAt;
  deadlineBudgetMs = budgetMs;
  deadlineAt = Math.min(previousAt, startedAt + budgetMs);
  try {
    const result = fn();
    const elapsed = Date.now() - startedAt;
    if (elapsed >= budgetMs) throw new RenderTimeoutError(budgetMs, elapsed);
    return result;
  } finally {
    deadlineAt = previousAt;
    deadlineBudgetMs = previousBudget;
    deadlineStartedAt = previousStart;
  }
}

/**
 * Second line of defence behind the schema's magnitude bound. renderChart is also reachable with
 * specs that never passed through chartSpecSchema — specs stored before the bound existed, and
 * direct calls from the playground and the marketing pages — and one value near Number.MAX_VALUE is
 * enough to make `maxValue - minValue` overflow to Infinity, after which every coordinate is
 * Infinity / Infinity = NaN and the SVG contains literal "NaN" attributes. Clamping keeps every
 * later step finite; anything that is not a number at all is treated as zero.
 */
function safeValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_VALUE_MAGNITUDE, Math.max(-MAX_VALUE_MAGNITUDE, value));
}

/** Returns the spec unchanged (so rendering stays byte-identical) unless some value needs clamping. */
function clampValues(spec: ChartSpec): ChartSpec {
  if (spec.series.every((series) => series.data.every((point) => point.value === safeValue(point.value)))) return spec;
  return { ...spec, series: spec.series.map((series) => ({ ...series, data: series.data.map((point) => ({ ...point, value: safeValue(point.value) })) })) };
}

/**
 * A spec with every value finite and every string XML-safe, for a renderer that does not do it itself.
 *
 * The classic renderer below clamps its values (`clampValues`) and strips XML-hostile characters as
 * it writes each string (`escapeXml` → `stripInvalidXml`). The editorial renderer in `./editorial.ts`
 * does neither: its `esc` handles `& < >` only, and its scale divides by a domain it computes from
 * the values it is given. Fuzzing found both halves of that:
 *
 * - a value of NaN, ±Infinity or ±Number.MAX_VALUE put the literal strings `NaN` or `Infinity` into
 *   coordinate attributes (`Math.max(…) - Math.min(…)` overflows, then every y is NaN), producing an
 *   SVG that no parser will accept and `sharp` refuses to rasterise;
 * - a null byte, a lone surrogate (`\uD800`), U+FFFE or a C0 control in a title, series name or
 *   label travelled straight through into the markup, which is the same unparseable outcome by a
 *   different route.
 *
 * Applied at the one place that reaches the editorial renderer (`./style.ts`) rather than at each of
 * its entry points, and returning the identical object when nothing needs changing so that a clean
 * spec still renders byte-for-byte as before.
 */
export function sanitizeSpec(spec: ChartSpec): ChartSpec {
  const clamped = clampValues(spec);
  const clean = (value: string) => stripInvalidXml(value);
  const needsStrip = (value: string | undefined) => value !== undefined && clean(value) !== value;
  const dirty =
    needsStrip(clamped.title) ||
    needsStrip(clamped.subtitle) ||
    clamped.series.some((series) => needsStrip(series.name) || series.data.some((point) => needsStrip(point.label)));
  if (!dirty) return clamped;
  return {
    ...clamped,
    title: clean(clamped.title),
    ...(clamped.subtitle === undefined ? {} : { subtitle: clean(clamped.subtitle) }),
    series: clamped.series.map((series) => ({ ...series, name: clean(series.name), data: series.data.map((point) => ({ ...point, label: clean(point.label) })) })),
  };
}

/** True for code points XML 1.0 forbids: C0 controls other than tab/LF/CR, U+FFFE/U+FFFF, and lone surrogates. */
function invalidInXml(code: number) {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffe || code === 0xffff || (code >= 0xd800 && code <= 0xdfff);
}

/** Drops characters that would make the SVG malformed (common in spreadsheet exports). */
export function stripInvalidXml(value: string) {
  let out = "";
  for (const char of value) if (!invalidInXml(char.codePointAt(0)!)) out += char;
  return out;
}

const escapeXml = (value: string) => stripInvalidXml(value).replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
/**
 * One compact formatter for a whole chart, chosen from every number it will print.
 *
 * Each number used to be compacted on its own, so a chart could label 900,000 as "900K" beside
 * 10,000,000 as "10M" — two quantities 11% apart printed in two different units, over an axis whose
 * ticks were all in millions. Deciding the unit once is the same rule the editorial renderer follows,
 * and this is now the same function.
 */
const compactFor = (values: number[]) => makeFormat(values);
/**
 * A single number in a tooltip or a description.
 *
 * Two decimals is the ordinary case, and a number smaller than that widens it rather than rounding
 * away: a point of -0.004 was described as "-0", which is both a quantity no reader recognises and a
 * description that contradicts the mark it is attached to.
 */
const precise = (value: number) => fixed(value, Math.max(2, decimalsForValues([value])));

/**
 * Counted nouns in the alt text, agreeing with their count. The description is read aloud by screen
 * readers, so "across 1 categories" is not a cosmetic slip — it is the sentence the reader hears.
 */
const counted = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

function pieSummary(spec: ChartSpec) {
  const first = spec.series[0];
  const total = first.data.reduce((sum, point) => sum + Math.max(0, point.value), 0) || 1;
  const shares = first.data.map((point) => ({ label: point.label, share: (Math.max(0, point.value) / total) * 100 })).sort((a, b) => b.share - a.share);
  const top = shares.slice(0, 3).map((part) => `${part.label} ${part.share.toFixed(0)}%`).join(", ");
  const smallest = shares.at(-1)!;
  return `${spec.title}. Pie chart of ${first.name} across ${counted(shares.length, "category", "categories")}. Largest: ${top}.${shares.length > 3 ? ` Smallest: ${smallest.label} ${smallest.share.toFixed(0)}%.` : ""}`;
}

/**
 * The chart's alt text, derived from the numbers. Exported so every renderer describes a spec identically.
 *
 * Clamped here as well as in `renderChart`, because this is reachable without it: `renderStyled`
 * calls `summary(spec)` on the spec as handed in, so the editorial path never saw `clampValues`.
 * With one NaN among the values that was a crash, not a cosmetic slip — `Math.max(...values)` is
 * NaN, `values.indexOf(NaN)` is -1, and `values[-1]` is `undefined`, which reaches
 * `fixed(undefined, 2)` and throws `TypeError: Cannot read properties of undefined (reading
 * 'toFixed')`. A 500 on the editorial renderer for an input the classic renderer drew correctly.
 * Describing the clamped numbers is also the right answer on its own terms: the alt text has to
 * describe the chart that was drawn.
 */
export function summary(input: ChartSpec) {
  const spec = clampValues(input);
  if (spec.type === "pie") return pieSummary(spec);
  const first = spec.series[0];
  // One precision for the whole description, chosen from every number in it. Per-value rounding is what
  // let the same sentence call one point "0.01" and another "-0" while the figure drew both correctly.
  const say = preciseFormat(first.data.map((point) => point.value));
  const values = first.data.map((point) => point.value);
  // "series" is spelled the same in the singular and the plural, so this counted noun needs no
  // agreement — "1 more series shown." and "3 more series shown." both read. It is written without a
  // verb for that reason; adding "is"/"are" would reintroduce the agreement problem.
  const others = spec.series.length > 1 ? ` ${spec.series.length - 1} more series shown.` : "";
  // A single point has no peak, no bottom and no trend. The old wording named the same point as both
  // the peak and the bottom and then claimed it "increased 0.0% from first to last point", which is
  // the kind of sentence that makes a reader distrust the rest of the description.
  if (values.length === 1) {
    return `${spec.title}. ${first.name} has a single data point: ${say(values[0])} for ${first.data[0].label}.${others}`;
  }
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  // Identical values have no peak either; "peaks at 7 for Jan and bottoms at 7 for Jan" describes a
  // shape the chart does not have. Say what a reader actually sees: a flat line at one value.
  if (maxValue === minValue) {
    return `${spec.title}. ${first.name} stays flat at ${say(maxValue)} across all ${counted(values.length, "point")}.${others}`;
  }
  // `indexOf` returning -1 would index past the start of the array and hand `undefined` to the
  // formatter. The clamp above makes that unreachable; this keeps the next variant of it from
  // being a 500 rather than a slightly wrong sentence.
  const maxIndex = Math.max(0, values.indexOf(maxValue));
  const minIndex = Math.max(0, values.indexOf(minValue));
  const start = values[0];
  const end = values.at(-1)!;
  const ratio = start === 0 ? null : ((end - start) / Math.abs(start)) * 100;
  // A denormal first point (5e-324) divides into a percentage of Infinity, which toFixed would write
  // as the word "Infinity" into the chart's own description. No finite percentage, no trend sentence.
  const change = ratio !== null && Number.isFinite(ratio) ? ratio : null;
  /**
   * A percentage needs a baseline that means something to be a percentage of.
   *
   * Across a sign change it does not: -40 to 30 is arithmetically "increased 175%" and editorially
   * nonsense, and one probe of a real chart produced "increased 20100.0%". A negative baseline is the
   * same problem quieter — -10 to -30 is a loss getting worse, reported as "decreased 200%". Both now
   * say what happened in the units the reader can see, which is the honest sentence and also the
   * shorter one. Negative charts reach this far more often since the renderer started drawing them.
   */
  const crossesZero = start < 0 !== end < 0;
  const negativeBase = start < 0;
  // A first-to-last change only means something when points are ordered, as in a time series.
  const trend = change === null || spec.type === "scatter"
    ? ""
    : crossesZero || negativeBase
      ? ` It moved from ${say(start)} to ${say(end)} between the first and last point.`
      : ` It ${change >= 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(1)}% from first to last point.`;
  return `${spec.title}. ${first.name} peaks at ${say(values[maxIndex])} for ${first.data[maxIndex].label} and bottoms at ${say(values[minIndex])} for ${first.data[minIndex].label}.${trend}${others}`;
}

function axisScaffold(spec: ChartSpec, left: number, top: number, plotWidth: number, plotHeight: number, minValue: number, maxValue: number, text: string, grid: string) {
  const lines: string[] = [];
  const range = maxValue - minValue || 1;
  const compact = compactFor([minValue, maxValue, ...spec.series.flatMap((series) => series.data.map((point) => point.value))]);
  for (let i = 0; i <= 4; i++) {
    checkDeadline();
    const y = top + (plotHeight * i) / 4;
    const value = maxValue - (range * i) / 4;
    lines.push(`<line x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}" stroke="${grid}" stroke-width="1"/>`);
    lines.push(`<text x="${left - 12}" y="${y + 4}" text-anchor="end" fill="${text}" font-size="12">${escapeXml(compact(value))}</text>`);
  }
  return lines.join("");
}

/**
 * The category axis is the union of every series' labels in first-seen order, and each point is placed by its
 * label, so series whose categories arrive in a different order (or with extra points) line up correctly.
 * A label repeated within one series gets its own slot per occurrence.
 */
export function categoryAxis(spec: ChartSpec) {
  const slots = new Map<string, number>();
  const labels: string[] = [];
  const positions = spec.series.map((series) => {
    const seen = new Map<string, number>();
    return series.data.map((point) => {
      const occurrence = seen.get(point.label) ?? 0;
      seen.set(point.label, occurrence + 1);
      const key = `${occurrence}\u0000${point.label}`;
      let slot = slots.get(key);
      if (slot === undefined) {
        slot = labels.length;
        slots.set(key, slot);
        labels.push(point.label);
      }
      return slot;
    });
  });
  return { labels, positions };
}

function cartesian(spec: ChartSpec, left: number, top: number, plotWidth: number, plotHeight: number, text: string, grid: string) {
  const allValues = spec.series.flatMap((series) => series.data.map((point) => point.value));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const range = maxValue - minValue || 1;
  const { labels, positions } = categoryAxis(spec);
  const xStep = plotWidth / Math.max(labels.length, 1);
  const xFor = (slot: number) => left + xStep * slot + xStep / 2;
  const yFor = (value: number) => top + plotHeight - ((value - minValue) / range) * plotHeight;
  const zeroY = yFor(0);
  const out: string[] = [axisScaffold(spec, left, top, plotWidth, plotHeight, minValue, maxValue, text, grid)];
  // The same formatter the axis uses, so a value label and the gridline beside it cannot disagree
  // about which unit this chart is in.
  const compact = compactFor([minValue, maxValue, ...spec.series.flatMap((series) => series.data.map((point) => point.value))]);

  // Truncating to 12 characters kept one label from being long; it did nothing about a hundred of them
  // sitting on top of each other. The shown labels are measured after truncation, since that is what is
  // actually drawn.
  const shown = labels.map((label) => (label.length > 12 ? `${label.slice(0, 11)}…` : label));
  const labelled = labelSlots(shown.length, labelStride(shown, 12, xStep));
  labels.forEach((_, index) => {
    if (!labelled.has(index)) return;
    const x = xFor(index);
    out.push(`<text x="${x}" y="${top + plotHeight + 28}" text-anchor="middle" fill="${text}" font-size="12">${escapeXml(shown[index])}</text>`);
  });

  if (spec.type === "bar") {
    const groupWidth = xStep * 0.72;
    // The gap scales with the slot so a group never spills into its neighbours at narrow widths.
    const perSeries = groupWidth / spec.series.length;
    const gap = Math.min(4, perSeries / 4);
    const barWidth = perSeries - gap;
    spec.series.forEach((series, seriesIndex) => {
      checkDeadline();
      const color = series.color ?? palette[seriesIndex % palette.length];
      series.data.forEach((point, index) => {
        if (index % DEADLINE_CHECK_STRIDE === 0) checkDeadline();
        const x = left + xStep * positions[seriesIndex][index] + (xStep - groupWidth) / 2 + seriesIndex * perSeries + gap / 2;
        const y = Math.min(zeroY, yFor(point.value));
        const height = Math.max(1, Math.abs(zeroY - yFor(point.value)));
        out.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="4" fill="${color}"><title>${escapeXml(`${series.name}, ${point.label}: ${precise(point.value)}`)}</title></rect>`);
        if (spec.showValues) out.push(`<text x="${x + barWidth / 2}" y="${y - 7}" text-anchor="middle" fill="${text}" font-size="11">${escapeXml(compact(point.value))}</text>`);
      });
    });
  } else {
    spec.series.forEach((series, seriesIndex) => {
      checkDeadline();
      const color = series.color ?? palette[seriesIndex % palette.length];
      // Lines follow the axis order, not the input order, so a reordered series does not zig-zag.
      const ordered = series.data.map((point, index) => ({ slot: positions[seriesIndex][index], value: point.value })).sort((a, b) => a.slot - b.slot);
      const points = ordered.map((point) => `${xFor(point.slot)},${yFor(point.value)}`);
      if (spec.type === "area") {
        const polygon = [`${xFor(ordered[0].slot)},${zeroY}`, ...points, `${xFor(ordered.at(-1)!.slot)},${zeroY}`].join(" ");
        out.push(`<polygon points="${polygon}" fill="${color}" opacity="0.16"/>`);
      }
      if (spec.type !== "scatter") out.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
      series.data.forEach((point, index) => {
        if (index % DEADLINE_CHECK_STRIDE === 0) checkDeadline();
        const x = xFor(positions[seriesIndex][index]);
        const y = yFor(point.value);
        out.push(`<circle cx="${x}" cy="${y}" r="${spec.type === "scatter" ? 6 : 4}" fill="${color}" stroke-width="2"><title>${escapeXml(`${series.name}, ${point.label}: ${precise(point.value)}`)}</title></circle>`);
        if (spec.showValues) out.push(`<text x="${x}" y="${y - 10}" text-anchor="middle" fill="${text}" font-size="11">${escapeXml(compact(point.value))}</text>`);
      });
    });
  }
  return out.join("");
}

function pie(spec: ChartSpec, left: number, top: number, plotWidth: number, plotHeight: number, text: string) {
  const data = spec.series[0].data;
  const total = data.reduce((sum, point) => sum + Math.max(0, point.value), 0);
  const divisor = total || 1;
  // The total is compacted against the slices it sums, not on its own, so the caption stays in the
  // same unit as the figure it belongs to.
  const compact = compactFor([total, ...data.map((point) => point.value)]);
  const radius = Math.max(50, Math.min(plotWidth, plotHeight) * 0.34);
  const cx = left + plotWidth / 2;
  const cy = top + plotHeight / 2;
  let angle = -Math.PI / 2;
  return data.map((point, index) => {
    if (index % DEADLINE_CHECK_STRIDE === 0) checkDeadline();
    const slice = (Math.max(0, point.value) / divisor) * Math.PI * 2;
    const end = angle + slice;
    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(end) * radius;
    const y2 = cy + Math.sin(end) * radius;
    const large = slice > Math.PI ? 1 : 0;
    const path = slice >= Math.PI * 1.999
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${palette[index % palette.length]}"/>`
      : `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z" fill="${palette[index % palette.length]}"/>`;
    const mid = angle + slice / 2;
    const labelX = cx + Math.cos(mid) * radius * 0.68;
    const labelY = cy + Math.sin(mid) * radius * 0.68;
    angle = end;
    // Without a legend, name each slice beside it so the PNG still says which slice is which.
    const outside = spec.showLegend ? "" : `<text x="${cx + Math.cos(mid) * (radius + 14)}" y="${cy + Math.sin(mid) * (radius + 14)}" text-anchor="${Math.cos(mid) >= 0 ? "start" : "end"}" dominant-baseline="middle" fill="${text}" font-size="12">${escapeXml(point.label)}</text>`;
    return `<g>${path}<title>${escapeXml(`${point.label}: ${precise(point.value)}`)}</title>${outside}<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-size="12" font-weight="700">${Math.round((Math.max(0, point.value) / divisor) * 100)}%</text></g>`;
  }).join("") + `<text x="${cx}" y="${cy + radius + 30}" text-anchor="middle" fill="${text}" font-size="12">Total ${escapeXml(compact(total))}</text>`;
}

/**
 * Deterministic, content-derived suffix for the ids inside one SVG. The markup is injected into a
 * page with dangerouslySetInnerHTML, so the ids land in the document's global id space: fixed ids
 * would collide as soon as a page holds two charts (or any element called "title"), and
 * aria-labelledby would then resolve to whichever node came first. A hash keeps the renderer
 * deterministic — the same spec still produces byte-identical SVG.
 */
function idSuffix(input: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

export function renderChart(input: ChartSpec) {
  // Before anything is allocated: a budget already spent (by an earlier stage, or by a caller who
  // handed us zero) refuses here rather than after a full render nobody will be served.
  checkDeadline();
  // Clamp once, then draw, describe and QA the same numbers, so the picture and its alt text agree.
  const spec = clampValues(input);
  const { width, height } = spec;
  const dark = spec.theme === "dark";
  const background = dark ? "#11131A" : "#FFFFFF";
  const text = dark ? "#F4F6FA" : "#171923";
  const muted = dark ? "#A8AFBF" : "#647084";
  const grid = dark ? "#2A2E3A" : "#E7EAF0";
  const left = 82;
  const top = spec.subtitle ? 112 : 90;
  const legendSpace = spec.showLegend ? 54 : 16;
  const plotWidth = width - left - 40;
  const plotHeight = height - top - 54 - legendSpace;
  const altText = summary(spec);
  const warnings = analyzeChart(spec);
  const chart = spec.type === "pie" ? pie(spec, left, top, plotWidth, plotHeight, text) : cartesian(spec, left, top, plotWidth, plotHeight, text, grid);
  // A pie's legend names its slices (the category labels); other charts name their series.
  const legendItems = spec.type === "pie"
    ? spec.series[0].data.map((point, index) => ({ name: point.label, color: palette[index % palette.length] }))
    : spec.series.map((series, index) => ({ name: series.name, color: series.color ?? palette[index % palette.length] }));
  const legend = spec.showLegend ? legendItems.map((item, index) => {
    const x = left + index * Math.min(170, plotWidth / legendItems.length);
    const y = height - 22;
    return `<g><circle cx="${x}" cy="${y - 4}" r="5" fill="${item.color}"/><text x="${x + 12}" y="${y}" fill="${muted}" font-size="12">${escapeXml(item.name)}</text></g>`;
  }).join("") : "";
  const uid = idSuffix(`${spec.type}|${width}x${height}|${spec.title}|${altText}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="cr-title-${uid} cr-desc-${uid}"><title id="cr-title-${uid}">${escapeXml(spec.title)}</title><desc id="cr-desc-${uid}">${escapeXml(altText)}</desc><rect width="100%" height="100%" rx="18" fill="${background}"/><text x="${left}" y="48" fill="${text}" font-family="${SANS}" font-size="24" font-weight="750">${escapeXml(spec.title)}</text>${spec.subtitle ? `<text x="${left}" y="76" fill="${muted}" font-family="${SANS}" font-size="14">${escapeXml(spec.subtitle)}</text>` : ""}<g font-family="${SANS}">${chart}${legend}</g></svg>`;
  return { svg, altText, warnings };
}

/**
 * `renderChart` under one tier's render budget and output cap.
 *
 * The two limits the spec names for a single render — "10 s render timeout, memory cap" — expressed
 * as a function of the tier, because the plan ladder is being built separately and the caps belong
 * to it. Nothing here hard-codes a number: the budget and the output cap both come from
 * `limitsFor(tier)`.
 *
 * Failures are `RenderTimeoutError` (`render_failed`, 500) and `LimitExceededError`
 * (`payload_too_large`, 413). Both are "never charged" outcomes under the billing spec.
 */
export function renderChartWithin(input: ChartSpec, tier: PlanTier = "free", budgetMs = limitsFor(tier).renderTimeoutMs) {
  const result = withRenderDeadline(budgetMs, () => renderChart(input));
  // After the render, not before: the output size is not knowable from the spec alone once labels,
  // tooltips and an alt text derived from the data are in it.
  assertSvgWithinLimits(result.svg, tier);
  return result;
}
