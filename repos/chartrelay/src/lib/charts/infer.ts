import { chartSpecSchema, MAX_VALUE_MAGNITUDE, type ChartSpec } from "./schema";

/**
 * Paste-to-chart inference: the entry-level on-ramp for someone who will never write a ChartSpec by hand.
 *
 * Everything here is pure string work — no database, no filesystem, no network — so the same function runs
 * in a route handler, in a script, or in the browser as the user types.
 */

export type InferSuccess = { ok: true; spec: ChartSpec; reason: string; warnings: string[] };
export type InferFailure = { ok: false; error: string };
export type InferResult = InferSuccess | InferFailure;

/** Mirrors the schema's own caps (100 points per series, 12 series) so the refusal is friendly instead of a ZodError. */
const MAX_ROWS = 100;
const MAX_SERIES = 12;
const MIN_ROWS = 2;

/** Tab first: it is what Excel and Google Sheets put on the clipboard, so it wins ties against the others. */
const DELIMITERS = ["\t", ",", ";", "|"] as const;
type Delimiter = (typeof DELIMITERS)[number];
const DELIMITER_NAMES: Record<Delimiter, string> = { "\t": "tabs", ",": "commas", ";": "semicolons", "|": "pipes" };

const MONTH_WORDS = new Set([
  "jan", "january", "feb", "february", "mar", "march", "apr", "april", "may", "jun", "june",
  "jul", "july", "aug", "august", "sep", "sept", "september", "oct", "october", "nov", "november", "dec", "december",
]);
const DAY_WORDS = new Set([
  "mon", "monday", "tue", "tues", "tuesday", "wed", "wednesday", "thu", "thur", "thurs", "thursday",
  "fri", "friday", "sat", "saturday", "sun", "sunday",
]);

const SHARE_WORDS = /%|share|split|percent|proportion|mix|breakdown|of total/i;

/** Suffixes people type instead of zeros. Lower-cased before lookup, so "1.2k" and "1.2K" agree. */
const MAGNITUDE_SUFFIXES: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

type ParsedNumber = { value: number; percent: boolean; parenthesized: boolean; scaled: boolean };

/**
 * Reads a number the way a person wrote it, or returns null.
 *
 * Null is never coerced to zero by the caller: a cell that cannot be read is reported with its row and
 * column, because silently charting a zero invents a data point the user never gave us.
 */
export function parseHumanNumber(cell: string): ParsedNumber | null {
  let text = cell
    .trim()
    // Spreadsheets and European locales use these as thousands separators; they are not data.
    .replace(/[   ]/g, "")
    // A Unicode minus, en dash or em dash pasted from a formatted sheet still means "negative".
    .replace(/[−‒–—]/g, "-")
    .replace(/[$€£¥₹]/g, "")
    .trim();
  if (!text) return null;

  // Accounting notation: (1,234) is -1234 everywhere outside a spreadsheet's own formatting.
  const parenthesized = /^\(.*\)$/.test(text);
  if (parenthesized) text = text.slice(1, -1).trim();

  const percent = text.endsWith("%");
  if (percent) text = text.slice(0, -1).trim();

  let multiplier = 1;
  const suffix = /^(.*?)\s*([kmbt])$/i.exec(text);
  if (suffix) {
    multiplier = MAGNITUDE_SUFFIXES[suffix[2].toLowerCase()];
    text = suffix[1].trim();
  }

  text = text.replace(/,/g, "");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;

  const magnitude = Number.parseFloat(text) * multiplier;
  if (!Number.isFinite(magnitude)) return null;
  return { value: parenthesized ? -magnitude : magnitude, percent, parenthesized, scaled: multiplier !== 1 };
}

/**
 * Splits one pasted line, honouring the quotes Google Sheets adds around a field that contains the delimiter.
 *
 * A quote only opens a field at its start, so an inch mark in `5" pipe` stays literal instead of swallowing
 * the rest of the row.
 */
function splitRow(line: string, delimiter: Delimiter): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character !== '"') current += character;
      else if (line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = false;
    } else if (character === '"' && current.trim() === "") {
      current = "";
      quoted = true;
    } else if (character === delimiter) {
      cells.push(current);
      current = "";
    } else current += character;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/** Picks the delimiter that splits every line into the same number of columns; falls back to the widest split so a ragged paste can still name the row that is wrong. */
function detectDelimiter(lines: string[]): Delimiter | null {
  let best: { delimiter: Delimiter; consistent: boolean; columns: number } | null = null;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => splitRow(line, delimiter).length);
    const columns = Math.max(...counts);
    if (columns < 2) continue;
    const consistent = counts.every((count) => count === counts[0]);
    const better =
      best === null ||
      (consistent && !best.consistent) ||
      (consistent === best.consistent && columns > best.columns);
    if (better) best = { delimiter, consistent, columns };
  }
  return best === null ? null : best.delimiter;
}

/** Recognises the label shapes that mean "this axis is time": months, quarters, weeks, weekdays, years and ISO dates. */
export function isTimeLike(label: string): boolean {
  const text = label.trim().toLowerCase();
  if (!text) return false;
  if (/^\d{4}-\d{1,2}(-\d{1,2})?$/.test(text)) return true;
  if (/^\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?$/.test(text)) return true;
  if (/^(fy\s*)?(19|20)\d{2}$/.test(text)) return true;
  if (/^q[1-4]([\s\-/']*(19|20)?\d{2})?$/.test(text)) return true;
  if (/^(19|20)\d{2}[\s\-/]*q[1-4]$/.test(text)) return true;
  if (/^(w|wk|week)\s*-?\d{1,2}$/.test(text)) return true;
  const firstWord = text.split(/[\s\-/,.]+/)[0];
  return MONTH_WORDS.has(firstWord) || DAY_WORDS.has(firstWord);
}

function describeCell(line: number, columnIndex: number, header: string[] | null): string {
  const columnName = header?.[columnIndex]?.trim();
  return columnName ? `row ${line}, column "${columnName}"` : `row ${line}, column ${columnIndex + 1}`;
}

/**
 * A row of years as headers ("Region  2019  2024") parses entirely as numbers, so the plain
 * "does the first row contain numbers?" test would read it as data and chart the word "Region".
 * Four-digit years in the first row that are not repeated down the column are a header, not values.
 */
function looksLikeYearHeader(rows: string[][], valueColumns: number[]): boolean {
  if (rows.length < MIN_ROWS + 1) return false;
  const isYear = (cell: string) => /^(19|20)\d{2}$/.test(cell.trim());
  return valueColumns.every((column) => isYear(rows[0][column])) && !valueColumns.every((column) => isYear(rows[1][column]));
}

export function inferSpec(raw: string): InferResult {
  const warnings: string[] = [];

  const lines = raw
    .replace(/^﻿/, "")
    .split(/\r\n|\r|\n/)
    .map((text, index) => ({ text, line: index + 1 }))
    .filter((entry) => entry.text.trim().length > 0);

  if (lines.length === 0) return { ok: false, error: "Nothing was pasted. Copy the cells from your spreadsheet and paste them here." };

  const delimiter = detectDelimiter(lines.map((entry) => entry.text));
  if (delimiter === null) {
    return { ok: false, error: "Each line has only one value, so there is nothing to chart. Paste a column of names next to a column of numbers." };
  }
  warnings.push(`Columns were split on ${DELIMITER_NAMES[delimiter]}.`);

  const rows = lines.map((entry) => ({ cells: splitRow(entry.text, delimiter), line: entry.line }));
  const width = rows[0].cells.length;
  const ragged = rows.find((row) => row.cells.length !== width);
  if (ragged) {
    return {
      ok: false,
      error: `Row ${ragged.line} has ${ragged.cells.length} values but the first row has ${width}. Every row needs the same number of columns.`,
    };
  }
  if (width < 2) return { ok: false, error: "Only one column was found. Paste a column of names next to at least one column of numbers." };

  const valueColumns = Array.from({ length: width - 1 }, (_, index) => index + 1);
  const grid = rows.map((row) => row.cells);
  const firstRowIsNumeric = valueColumns.every((column) => parseHumanNumber(grid[0][column]) !== null);
  const hasHeader = !firstRowIsNumeric || looksLikeYearHeader(grid, valueColumns);

  const header = hasHeader ? rows[0].cells : null;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  if (dataRows.length < MIN_ROWS) {
    return { ok: false, error: `Only ${dataRows.length} row of data was found. A chart needs at least ${MIN_ROWS} rows to compare.` };
  }
  if (dataRows.length > MAX_ROWS) {
    return { ok: false, error: `${dataRows.length} rows were pasted and a chart holds at most ${MAX_ROWS}. Summarise or trim the data first.` };
  }

  // A column that is text in every row is a note, not a measure; a column that is numeric except in one
  // cell is a typo the user must see. Splitting on "all" versus "some" keeps both cases honest.
  const numericColumns: { index: number; cells: ParsedNumber[] }[] = [];
  for (const column of valueColumns) {
    const parsed = dataRows.map((row) => parseHumanNumber(row.cells[column]));
    if (parsed.every((entry) => entry === null)) {
      const name = header?.[column]?.trim();
      warnings.push(name ? `The column "${name}" holds text, so it was left out.` : `Column ${column + 1} holds text, so it was left out.`);
      continue;
    }
    const badIndex = parsed.findIndex((entry) => entry === null);
    if (badIndex >= 0) {
      const cell = dataRows[badIndex].cells[column];
      const where = describeCell(dataRows[badIndex].line, column, header);
      return { ok: false, error: `${cell ? `"${cell}"` : "An empty cell"} at ${where} is not a number. Fix or remove that cell and paste again.` };
    }
    // Narrowed by the two checks above: every entry in this column is a ParsedNumber from here on.
    const parsedCells = parsed.filter((entry): entry is ParsedNumber => entry !== null);
    const huge = parsedCells.findIndex((entry) => Math.abs(entry.value) > MAX_VALUE_MAGNITUDE);
    if (huge >= 0) {
      return { ok: false, error: `The value at ${describeCell(dataRows[huge].line, column, header)} is too large to chart.` };
    }
    numericColumns.push({ index: column, cells: parsedCells });
  }

  if (numericColumns.length === 0) {
    return { ok: false, error: "No column of numbers was found. The first column holds the names and at least one other column must hold numbers." };
  }
  if (numericColumns.length > MAX_SERIES) {
    return { ok: false, error: `${numericColumns.length} columns of numbers were pasted and a chart holds at most ${MAX_SERIES}. Chart them in smaller groups.` };
  }

  const labels: string[] = [];
  let truncatedLabels = false;
  for (const row of dataRows) {
    const label = row.cells[0].trim();
    if (!label) return { ok: false, error: `Row ${row.line} has no name in the first column. Every row needs a label.` };
    if (label.length > 80) truncatedLabels = true;
    labels.push(label.slice(0, 80));
  }
  if (truncatedLabels) warnings.push("Labels longer than 80 characters were shortened.");

  const everyCell = numericColumns.flatMap((column) => column.cells);
  if (everyCell.some((entry) => entry.percent)) warnings.push('Percent signs were removed: "45%" was read as 45.');
  if (everyCell.some((entry) => entry.parenthesized)) warnings.push('Values in brackets were read as negative: "(1,234)" was read as -1234.');
  if (everyCell.some((entry) => entry.scaled)) warnings.push('Shorthand sizes were expanded: "1.2K" was read as 1200.');

  const seriesNames = numericColumns.map((column, index) => {
    const name = header?.[column.index]?.trim();
    if (name) return name.slice(0, 80);
    return numericColumns.length === 1 ? "Values" : `Series ${index + 1}`;
  });

  const series = numericColumns.map((column, index) => ({
    name: seriesNames[index],
    data: labels.map((label, row) => ({ label, value: column.cells[row].value })),
  }));

  // --- Form selection ---------------------------------------------------------------------------
  const timeLikeLabels = labels.filter(isTimeLike).length;
  const labelsAreTime = timeLikeLabels / labels.length >= 0.8;
  const headersAreTime = header !== null && numericColumns.every((column) => isTimeLike(header[column.index]));
  const values = everyCell.map((entry) => entry.value);
  const hasNegative = values.some((value) => value < 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  const sharePhrasing = numericColumns.some((column) => SHARE_WORDS.test(header?.[column.index] ?? "") || column.cells.some((entry) => entry.percent));
  const sumsToWhole = Math.abs(total - 100) <= 1;

  const seriesNote = series.length > 1 ? ` with ${series.length} series, one per column of numbers` : "";
  let type: ChartSpec["type"];
  let reason: string;

  if (numericColumns.length === 2 && headersAreTime) {
    // A before/after pair per row is a slope chart, which the schema has no type for yet.
    type = "bar";
    reason = `Each row is measured at two points in time (${seriesNames[0]} and ${seriesNames[1]}), so this is drawn as a bar chart with one bar per period.`;
    warnings.push(`A slope chart would show the move from ${seriesNames[0]} to ${seriesNames[1]} more directly, but that form does not exist yet, so the two periods are drawn side by side.`);
  } else if (labelsAreTime && labels.length >= 4) {
    type = "line";
    reason = `Your first column looks like time (${labels[0]} through ${labels[labels.length - 1]}) and there are ${labels.length} rows, so this is drawn as a line chart${seriesNote}.`;
  } else if (series.length === 1 && labels.length <= 6 && !hasNegative && (sumsToWhole || sharePhrasing)) {
    // The QA layer refuses a pie with negatives, several series or a crowd of slices, so those never reach here.
    type = "pie";
    reason = sumsToWhole
      ? `These ${labels.length} values are parts of one whole that add up to about 100, so this is drawn as a pie chart.`
      : `Your numbers are labelled as shares of a whole and there are only ${labels.length} of them, so this is drawn as a pie chart.`;
  } else {
    type = "bar";
    reason = `Your first column holds ${labels.length} category names rather than dates, so this is drawn as a bar chart${seriesNote}.`;
    if (labels.length > 8) {
      warnings.push(`${labels.length} categories is a lot for a bar chart — sorting them largest to smallest would read better.`);
    }
  }

  const labelHeading = header?.[0]?.trim().slice(0, 80) ?? "";
  let title = "";
  if (labelHeading) {
    title = series.length === 1 ? `${seriesNames[0]} by ${labelHeading}` : `${seriesNames.join(", ")} by ${labelHeading}`;
    if (title.length > 120) title = `${series.length} measures by ${labelHeading}`;
  } else if (header) {
    title = seriesNames.join(", ").slice(0, 120);
  }
  if (!title) warnings.push("The chart has no title yet — add one saying what the reader should take away.");

  const candidate = {
    type,
    ...(title ? { title } : {}),
    // One series needs no legend: its name is already the title, and the key only steals room from the plot.
    showLegend: series.length > 1,
    series,
  };

  const parsed = chartSpecSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: `The pasted data could not be turned into a valid chart: ${parsed.error.issues[0]?.message ?? "unknown problem"}.` };
  }
  return { ok: true, spec: parsed.data, reason, warnings };
}
