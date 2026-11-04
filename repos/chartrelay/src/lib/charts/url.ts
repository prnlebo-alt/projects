/**
 * The querystring form of a chart.
 *
 * Everything the renderer needs travels in the URL, because that is what makes a chart usable in the
 * places this product is for: an `<img src>` in an email, a Markdown image in a README, a Slack
 * unfurl, a cell in a no-code automation. None of those can POST a body first and fetch a second URL,
 * which is the whole reason /api/v1/charts alone was never enough.
 *
 * Two forms are accepted. The readable one is for a human writing the URL by hand or a no-code tool
 * pasting fields into it. The `spec` form carries a base64url JSON ChartSpec for anything the readable
 * form cannot express, so the two never need to fight over syntax.
 */
import { chartSpecSchema, type ChartSpec } from "./schema";

/**
 * Longest querystring accepted.
 *
 * Browsers, proxies and mail clients all truncate long URLs at different, undocumented lengths, and a
 * chart that renders for the author and breaks in someone's inbox is worse than one that refuses up
 * front. 8 KB is comfortably under the ~8 KB request-line limit that nginx and most CDNs impose, and
 * past that the caller wants POST /api/v1/charts and a short retrieval URL instead.
 */
export const MAX_QUERY_BYTES = 8 * 1024;

/** Series separator in `data`, chosen because it cannot appear in a number and needs no escaping in a URL. */
const SERIES_SEPARATOR = "|";

export type UrlChartFormat = "svg" | "png";
export type UrlChartStyle = "editorial" | "classic";

export interface UrlChartRequest {
  spec: ChartSpec;
  format: UrlChartFormat;
  style: UrlChartStyle;
  /** Present only when the caller supplied one; the route decides what it entitles them to. */
  key: string | null;
  /** Editorial chrome the ChartSpec has no room for, because it is presentation rather than data. */
  chrome: {
    source?: string;
    prefix?: string;
    suffix?: string;
    focus?: number;
    note?: { index: number; text: string };
  };
}

export type UrlChartResult = { ok: true; value: UrlChartRequest } | { ok: false; error: string };

const fail = (error: string): UrlChartResult => ({ ok: false, error });

/** Splits on a separator and trims, dropping the empty tail a trailing separator leaves behind. */
const list = (value: string, separator = ","): string[] =>
  value.split(separator).map((part) => part.trim()).filter((part) => part.length > 0);

/**
 * Parses one number from the querystring.
 *
 * Deliberately stricter than Number(): the empty string, whitespace and `Infinity` all coerce to
 * something numeric-looking, and a chart drawn from a silently coerced value is exactly the class of
 * quiet wrongness the QA layer exists to prevent. An unparseable cell is a refusal, never a zero.
 *
 * Thousands separators are deliberately not stripped. The comma already separates one value from the
 * next, so "1,234" is two points before this function ever sees one — removing commas here would
 * imply a syntax that cannot work and would hide the split rather than repair it. A Unicode minus is
 * accepted because spreadsheets emit it and nothing else in this grammar claims that character.
 */
function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/−/g, "-");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Decodes the base64url `spec` parameter. Returns null for anything that is not valid JSON. */
function decodeSpecParam(raw: string): unknown {
  const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/**
 * Checks the chrome indices against the chart they point into.
 *
 * `focus` and `noteAt` are positions in a series, and neither can be checked until the series exists —
 * so they are validated here rather than where they are read. Leaving it out was a real defect: a
 * noteAt past the end dereferenced undefined deep in the renderer, and the reader got
 * "Cannot read properties of undefined (reading 'value')" drawn on the refusal card, beside the
 * carefully worded length checks for labels and names.
 */
function withBoundedChrome(spec: ChartSpec, format: UrlChartFormat, style: UrlChartStyle, key: string | null, chrome: UrlChartRequest["chrome"]): UrlChartResult {
  const points = spec.series[0]?.data.length ?? 0;
  if (chrome.focus !== undefined && chrome.focus >= points) {
    return fail(`focus is ${chrome.focus} but the chart has ${points} ${points === 1 ? "point" : "points"}, numbered 0 to ${points - 1}.`);
  }
  if (chrome.note && chrome.note.index >= points) {
    return fail(`noteAt is ${chrome.note.index} but the chart has ${points} ${points === 1 ? "point" : "points"}, numbered 0 to ${points - 1}.`);
  }
  return { ok: true, value: { spec, format, style, key, chrome } };
}

/**
 * Turns a URL's query into a validated chart request.
 *
 * The caller passes the URL's own searchParams, so percent-decoding and repeated keys are already
 * handled by the platform rather than re-implemented here.
 */
export function parseChartQuery(params: URLSearchParams): UrlChartResult {
  const query = params.toString();
  if (Buffer.byteLength(query, "utf8") > MAX_QUERY_BYTES) {
    return fail(`The query is longer than ${MAX_QUERY_BYTES} bytes. Post the chart to /api/v1/charts and use the short URL it returns.`);
  }

  const format = (params.get("format") ?? "png").toLowerCase();
  if (format !== "svg" && format !== "png") return fail('format must be "svg" or "png".');

  const style = (params.get("style") ?? "editorial").toLowerCase();
  if (style !== "editorial" && style !== "classic") return fail('style must be "editorial" or "classic".');

  const key = params.get("key");

  const chrome: UrlChartRequest["chrome"] = {};
  const source = params.get("source");
  if (source) chrome.source = source;
  const prefix = params.get("prefix");
  if (prefix) chrome.prefix = prefix;
  const suffix = params.get("suffix");
  if (suffix) chrome.suffix = suffix;

  const focusRaw = params.get("focus");
  if (focusRaw !== null) {
    const focus = parseNumber(focusRaw);
    if (focus === null || !Number.isInteger(focus) || focus < 0) return fail("focus must be a whole number, counting from 0.");
    chrome.focus = focus;
  }

  const noteText = params.get("note");
  if (noteText) {
    const atRaw = params.get("noteAt");
    const at = atRaw === null ? null : parseNumber(atRaw);
    if (at === null || !Number.isInteger(at) || at < 0) return fail("note needs noteAt, a whole number counting from 0, saying which point it points at.");
    chrome.note = { index: at, text: noteText };
  }

  // The escape hatch wins outright when present: mixing half a JSON spec with half a readable one
  // would give two sources of truth for the same field and no sane rule for which one loses.
  const specParam = params.get("spec");
  if (specParam) {
    const decoded = decodeSpecParam(specParam);
    if (decoded === null) return fail("spec must be base64url-encoded JSON.");
    const parsed = chartSpecSchema.safeParse(decoded);
    if (!parsed.success) return fail(`spec is not a valid chart: ${parsed.error.issues[0]?.message ?? "unknown problem"}.`);
    return withBoundedChrome(parsed.data, format, style, key, chrome);
  }

  const dataRaw = params.get("data");
  if (!dataRaw) return fail("data is required: a comma-separated list of numbers, or several lists separated by |.");

  const groups = dataRaw.split(SERIES_SEPARATOR).map((group) => list(group));
  if (groups.some((group) => group.length === 0)) return fail("Every series in data needs at least one number.");

  const values: number[][] = [];
  for (const [groupIndex, group] of groups.entries()) {
    const parsed: number[] = [];
    for (const [cellIndex, cell] of group.entries()) {
      const value = parseNumber(cell);
      if (value === null) {
        const where = groups.length > 1 ? ` in series ${groupIndex + 1}` : "";
        return fail(`"${cell}" at position ${cellIndex + 1}${where} is not a number.`);
      }
      parsed.push(value);
    }
    values.push(parsed);
  }

  const width = values[0].length;
  if (values.some((group) => group.length !== width)) return fail("Every series in data needs the same number of values.");

  const labelsRaw = params.get("labels");
  // Without labels the points still need an identity: a 1-based index is the least surprising default,
  // and it keeps the chart honest about the fact that nobody named these categories.
  const labels = labelsRaw ? list(labelsRaw) : Array.from({ length: width }, (_, i) => String(i + 1));
  if (labels.length !== width) return fail(`labels has ${labels.length} entries but data has ${width} values per series.`);

  const namesRaw = params.get("names");
  const names = namesRaw ? list(namesRaw) : [];
  if (names.length > 0 && names.length !== values.length) {
    return fail(`names has ${names.length} entries but data has ${values.length} series.`);
  }

  const candidate = {
    type: params.get("type") ?? "bar",
    title: params.get("title") ?? undefined,
    subtitle: params.get("subtitle") ?? undefined,
    theme: params.get("theme") ?? undefined,
    width: params.get("w") ?? undefined,
    height: params.get("h") ?? undefined,
    showLegend: params.get("legend") ?? undefined,
    showValues: params.get("values") ?? undefined,
    series: values.map((group, index) => ({
      name: names[index] ?? (values.length > 1 ? `Series ${index + 1}` : (params.get("title") ?? "Value")),
      data: group.map((value, i) => ({ label: labels[i], value })),
    })),
  };

  // Numbers and booleans arrive as strings from a querystring; coerce only these known fields, so a
  // typo in one of them is still reported by the schema rather than silently becoming a default.
  const coerced = {
    ...candidate,
    ...(candidate.width === undefined ? {} : { width: Number(candidate.width) }),
    ...(candidate.height === undefined ? {} : { height: Number(candidate.height) }),
    ...(candidate.showLegend === undefined ? {} : { showLegend: candidate.showLegend !== "0" && candidate.showLegend !== "false" }),
    ...(candidate.showValues === undefined ? {} : { showValues: candidate.showValues !== "0" && candidate.showValues !== "false" }),
  };

  const parsed = chartSpecSchema.safeParse(coerced);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`${issue?.path.join(".") || "chart"}: ${issue?.message ?? "invalid"}.`);
  }
  return withBoundedChrome(parsed.data, format, style, key, chrome);
}

/** Everything that rides alongside the spec in a chart URL. */
export interface ChartQueryOptions {
  format?: UrlChartFormat;
  style?: UrlChartStyle;
  source?: string;
  prefix?: string;
  suffix?: string;
  focus?: number;
  note?: { index: number; text: string };
}

/** The schema's defaults, which never need to appear in a URL. */
const SPEC_DEFAULTS = { type: "bar", theme: "light", width: 900, height: 520, showLegend: true, showValues: false } as const;

/**
 * Writes a chart back out as a query.
 *
 * The studio shows people the URL that drew their chart, so this has to be the exact inverse of
 * parseChartQuery — a link that renders something other than what is on screen is worse than no link.
 * A round-trip test holds the two functions to each other.
 *
 * Defaults are left out, because the URL is read by humans: every parameter present should be one the
 * caller actually chose. The readable form is used whenever it can carry the spec, and the base64url
 * escape hatch only when it cannot — series with different label sets have no readable spelling.
 */
export function toChartQuery(spec: ChartSpec, options: ChartQueryOptions = {}): string {
  const params = new URLSearchParams();
  const labels = spec.series[0].data.map((point) => point.label);
  const sharedLabels = spec.series.every((series) =>
    series.data.length === labels.length && series.data.every((point, i) => point.label === labels[i]));
  const hasColors = spec.series.some((series) => series.color !== undefined);

  if (!sharedLabels || hasColors) {
    params.set("spec", Buffer.from(JSON.stringify(spec), "utf8").toString("base64url"));
  } else {
    if (spec.type !== SPEC_DEFAULTS.type) params.set("type", spec.type);
    params.set("title", spec.title);
    if (spec.subtitle) params.set("subtitle", spec.subtitle);
    params.set("labels", labels.join(","));
    params.set("data", spec.series.map((series) => series.data.map((point) => point.value).join(",")).join(SERIES_SEPARATOR));
    // parseChartQuery invents "Series N" for several series and falls back to the title for one, so a
    // name is only worth spelling out when it differs from what a reader would get for free.
    const implied = spec.series.map((_, i) => (spec.series.length > 1 ? `Series ${i + 1}` : spec.title));
    if (spec.series.some((series, i) => series.name !== implied[i])) {
      params.set("names", spec.series.map((series) => series.name).join(","));
    }
    if (spec.theme !== SPEC_DEFAULTS.theme) params.set("theme", spec.theme);
    if (spec.width !== SPEC_DEFAULTS.width) params.set("w", String(spec.width));
    if (spec.height !== SPEC_DEFAULTS.height) params.set("h", String(spec.height));
    if (spec.showLegend !== SPEC_DEFAULTS.showLegend) params.set("legend", spec.showLegend ? "1" : "0");
    if (spec.showValues !== SPEC_DEFAULTS.showValues) params.set("values", spec.showValues ? "1" : "0");
  }

  if (options.format && options.format !== "png") params.set("format", options.format);
  if (options.style && options.style !== "editorial") params.set("style", options.style);
  if (options.source) params.set("source", options.source);
  if (options.prefix) params.set("prefix", options.prefix);
  if (options.suffix) params.set("suffix", options.suffix);
  if (options.focus !== undefined) params.set("focus", String(options.focus));
  if (options.note) {
    params.set("note", options.note.text);
    params.set("noteAt", String(options.note.index));
  }
  return params.toString();
}
