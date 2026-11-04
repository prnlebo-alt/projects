/**
 * Chooses which renderer draws a spec, and keeps the alt text and QA findings the same either way.
 *
 * The editorial renderer does not cover every form the schema allows — it has no pie, area or scatter
 * — so asking for it is a preference, not a guarantee. Rather than refuse, or silently swap a pie for
 * a chart the caller did not ask for, an unsupported form falls back to the classic renderer and says
 * so in the response. The alternative, quietly changing the chart type, is precisely the kind of
 * unannounced substitution this product refuses to do elsewhere.
 */
import { columns, dark as darkTheme, light as lightTheme, lines, MAX_SERIES, type Datum, type Theme } from "./editorial";
import { renderChart, sanitizeSpec, summary } from "./render";
import type { ChartSpec } from "./schema";
import { analyzeChart, type QaIssue } from "./qa";

export type ChartStyle = "editorial" | "classic";

/** Presentation the ChartSpec has no field for, because it is chrome rather than data. */
export interface StyleChrome {
  source?: string;
  prefix?: string;
  suffix?: string;
  focus?: number;
  note?: { index: number; text: string };
}

export interface StyledRender {
  svg: string;
  altText: string;
  warnings: QaIssue[];
  /** The style actually used, which is not always the style asked for. */
  style: ChartStyle;
  /** Set when `style` differs from the request, in words a caller can show a user. */
  styleNote?: string;
}

/** The schema's own defaults, so "the caller set this" can be told from "the caller said nothing". */
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 520;

/** Forms the editorial renderer can draw today. Everything else falls back, loudly. */
const EDITORIAL_TYPES = new Set(["bar", "line"]);

const themeFor = (spec: ChartSpec): Theme => (spec.theme === "dark" ? darkTheme : lightTheme);

const ignoredNote = (fields: string[]) =>
  `The editorial style composes its own layout, so ${fields.join(" and ")} had no effect. Ask for style=classic to control them.`;

export function renderStyled(input: ChartSpec, style: ChartStyle = "editorial", chrome: StyleChrome = {}): StyledRender {
  // The editorial renderer neither clamps its values nor strips XML-hostile characters; the classic
  // one does both for itself. Sanitising here is what stops a NaN value or a lone surrogate in a
  // label from becoming an SVG that no parser accepts — see `sanitizeSpec` in ./render.ts. A spec
  // that needs nothing is returned unchanged, so clean input renders byte-for-byte as before.
  const spec = sanitizeSpec(input);
  // chartSpecSchema accepts up to 12 series; the editorial palette is a deliberately fixed order of
  // 8 and `seriesColor` throws a RangeError rather than invent or repeat a hue. Those two numbers
  // disagreeing was a caller-triggerable 500: a schema-valid 9-series bar or line chart, with the
  // default style, crashed the renderer. Too many series is a form this renderer cannot draw, so it
  // takes the route this file already has for that — fall back to classic, which cycles the classic
  // palette, and say so. Refusing a chart the classic renderer draws correctly would be worse, and
  // silently dropping the ninth series is the unannounced substitution this file forbids.
  const tooManySeries = spec.series.length > MAX_SERIES;
  if (style === "classic" || !EDITORIAL_TYPES.has(spec.type) || tooManySeries) {
    const classic = renderChart(spec);
    const unsupportedType = style === "editorial" && !EDITORIAL_TYPES.has(spec.type);
    const styleNote = unsupportedType
      ? `The editorial renderer does not draw a ${spec.type} chart yet, so this was drawn in the classic style. Ask for bar or line to get the editorial one.`
      : style === "editorial" && tooManySeries
        ? `The editorial palette carries ${MAX_SERIES} series and this chart has ${spec.series.length}, so it was drawn in the classic style. Fold the smallest series into "Other" to get the editorial one.`
        : undefined;
    return {
      svg: classic.svg,
      altText: classic.altText,
      warnings: classic.warnings,
      style: "classic",
      ...(styleNote ? { styleNote } : {}),
    };
  }

  // The editorial renderer draws at a fixed size and composes its own legend and labels, so a caller's
  // w/h/legend/values are dropped. A type fall-back already announces itself; dropping a field the
  // caller explicitly set has to as well, or this is the silent substitution the file forbids.
  const ignored: string[] = [];
  if (spec.width !== DEFAULT_WIDTH || spec.height !== DEFAULT_HEIGHT) ignored.push("width and height");
  if (spec.showValues) ignored.push("showValues");

  const t = themeFor(spec);
  // Both renderers describe and check the same numbers, so a caller who switches style gets the same
  // alt text and the same findings — the picture changes, the facts about it do not.
  const altText = summary(spec);
  const warnings = analyzeChart(spec);
  const common = { t, altText, title: spec.title, subtitle: spec.subtitle, source: chrome.source };

  if (spec.type === "bar" && spec.series.length === 1) {
    const data: Datum[] = spec.series[0].data.map((point) => ({ label: point.label, value: point.value }));
    const svg = columns({ ...common, data, prefix: chrome.prefix, ...(chrome.focus === undefined ? {} : { focus: chrome.focus }) });
    return { svg, altText, warnings, style: "editorial", ...(ignored.length ? { styleNote: ignoredNote(ignored) } : {}) };
  }

  // A multi-series bar is drawn as lines: the editorial column chart is single-series by design (its
  // whole argument is one focus bar against quiet ones), and grouped bars make a reader do the
  // subtraction themselves. Saying so beats drawing something worse without comment.
  // The substitution is announced in the figure as well as in the response. A caller embedding this as
  // an <img> never sees a header, and lines assert continuity between categories that bars do not — a
  // claim made in the ink has to be corrected in the ink.
  const drawnAsLines = spec.type === "bar" ? `Requested as bars; drawn as lines for ${spec.series.length} series.` : undefined;
  const svg = lines({
    ...common,
    ...(drawnAsLines ? { notice: drawnAsLines } : {}),
    series: spec.series.map((series) => ({ name: series.name, data: series.data.map((point) => ({ label: point.label, value: point.value })) })),
    showLegend: spec.showLegend,
    prefix: chrome.prefix,
    suffix: chrome.suffix,
    ...(chrome.note ? { note: { index: chrome.note.index, text: chrome.note.text } } : {}),
  });
  const notes: string[] = [];
  if (spec.type === "bar") notes.push("Several series were drawn as lines: the editorial column chart carries one series so that a single bar can hold the argument.");
  if (ignored.length) notes.push(ignoredNote(ignored));
  return {
    svg,
    altText,
    warnings,
    style: "editorial",
    ...(notes.length ? { styleNote: notes.join(" ") } : {}),
  };
}
