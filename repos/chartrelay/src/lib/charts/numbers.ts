/**
 * How this product prints a number, in one place.
 *
 * There were three formatters: one for the editorial axis, one for the classic axis, and one for the
 * alt text. Each rounded on its own terms, so the same chart could describe itself three different
 * ways — and an independent review found all three ways of being wrong at once. A figure whose axis
 * read "0, 0, 1, 1, 1", a value of 250,000 labelled "0.3M", and a description that called −0.004 "−0".
 *
 * The rule underneath every function here: a number may be shortened, never restated. Rounding 0.45 to
 * "0.5" and rounding 2.5 to "0M" are the same defect at different magnitudes, and the second one is
 * only more obvious. Where shortening would change what a number says, this module prints more digits
 * rather than fewer, and takes the loss in tidiness.
 */

/** The most decimals any of this ever prints. Past this a label is noise rather than precision. */
const MAX_DECIMALS = 8;

/** Decimals a single number needs to come back as itself, up to a limit. */
export function decimalsToPrint(value: number, cap: number): number {
  for (let decimals = 0; decimals < cap; decimals++) {
    if (Number(value.toFixed(decimals)) === value) return decimals;
  }
  return cap;
}

/**
 * A number with thousands separators, no trailing zeros, and no negative zero.
 *
 * "-0" is not a quantity a reader recognises: it appears whenever a small negative rounds away, and it
 * reads as a typo rather than as a number.
 */
export function fixed(value: number, decimals: number): string {
  const rounded = Number(value.toFixed(decimals));
  return (rounded === 0 ? 0 : rounded).toLocaleString("en-US", { maximumFractionDigits: decimals });
}

/** True when printing this value at this many decimals would turn a real number into zero. */
export const collapsesToZero = (value: number, decimals: number): boolean =>
  value !== 0 && Number(value.toFixed(decimals)) === 0;

/**
 * Decimals that keep every value in a chart distinguishable from zero.
 *
 * Driven by the smallest number present, not the largest. A chart of 0.00001, 0.00002 and 0.000015
 * drew three bars of visibly different heights over an axis that read "0, 0, 0, 0" — the picture said
 * one thing and every number on it said nothing happened.
 */
export function decimalsForValues(values: number[], floor = 0): number {
  const magnitudes = values.filter((value) => Number.isFinite(value) && value !== 0).map(Math.abs);
  if (!magnitudes.length) return floor;
  const smallest = Math.min(...magnitudes);
  // Two significant digits on the smallest number present: enough to tell it from zero and from its
  // neighbours, which is the entire job of a label.
  const needed = smallest >= 1 ? 0 : Math.min(MAX_DECIMALS, Math.ceil(-Math.log10(smallest)) + 1);
  return Math.max(floor, needed);
}

/**
 * The formatter the alt text uses.
 *
 * Chosen once from the whole series, for the same reason the axis is: a description that says "0.01"
 * for one point and "0.006" for another is describing two different scales. Two decimals is the
 * ordinary case — money, counts, percentages — and smaller data widens it rather than rounding away.
 */
export function preciseFormat(values: number[]): (value: number) => string {
  const decimals = Math.max(2, decimalsForValues(values));
  return (value) => fixed(value, decimals);
}

/** A number as this chart prints it. */
export type NumberFormatter = (value: number) => string;

export interface FormatOptions {
  prefix?: string;
  suffix?: string;
  /**
   * The axis step this formatter has to print, when there is one.
   *
   * Without it the formatter rounds to whole numbers, which is right for most charts and silently
   * destroys the rest: a 0..1 axis stepping by 0.25 printed "0, 0, 1, 1, 1", and a rate of -0.45 was
   * labelled "-0". Any percentage, rate or ratio hits this.
   */
  step?: number;
}

/**
 * How many decimals this chart prints.
 *
 * Enough for the axis step — a 0..1 axis stepping by 0.25 printed "0, 0, 1, 1, 1" when everything was
 * rounded to whole numbers — and enough that no value is restated as a different number: 0.45 labelled
 * "0.5" is the same defect as a value of 2 labelled "0M", quieter only because the number is small.
 *
 * Trailing zeros are not padded on, so an axis still reads "0, 0.2, 0.4" rather than "0.00, 0.20, 0.40"
 * while a highlighted 0.45 keeps both of its digits.
 */
function decimalsFor(values: number[], step: number | undefined): number {
  const fromStep = step !== undefined && step > 0 && step < 1 ? decimalsToPrint(step, 4) : 0;
  const fromValues = values.reduce((most, value) => Math.max(most, decimalsToPrint(value, 4)), 0);
  // decimalsForValues is the floor, not the ceiling: it is what keeps the smallest number on the chart
  // from printing as zero, which no amount of agreement with the step would prevent.
  return Math.max(fromStep, fromValues, decimalsForValues(values));
}

/**
 * One formatter per chart, chosen once from the whole data range.
 *
 * Deciding the unit per value is what produces "$34K" beside "$33.9K" in the same figure, or an axis
 * reading "1.0Kms". The scale and the decimal places are fixed for the chart, so every number in it is
 * directly comparable — and a unit suffix suppresses compaction entirely, because "1.0Kms" is not a unit
 * any reader has ever wanted.
 */
export function makeFormat(values: number[], { prefix = "", suffix = "", step }: FormatOptions = {}): NumberFormatter {
  const max = Math.max(...values.map((v) => Math.abs(v)), 0);
  // Only compact once the numbers are genuinely long. Below 10K, "0.6K" and "0K" are harder to read
  // than "610" and "0" — compaction is meant to shorten, not to impose a unit the data does not need.
  if (suffix || max < 10_000) {
    const decimals = decimalsFor(values, step);
    return (v) => `${prefix}${fixed(v, decimals)}${suffix}`;
  }
  const [divisor, unit] = max >= 1e9 ? [1e9, "B"] : max >= 1e6 ? [1e6, "M"] : [1e3, "K"];
  // One decimal was hardcoded here, so a tick at 250,000 on a 0..1M axis printed "0.3M" — a mislabelled
  // gridline on an axis whose spacing was even. The step decides the precision, exactly as it does
  // below 10K; without a step, one decimal remains the sensible default.
  const compactDecimals = Math.max(1, decimalsToPrint(step === undefined ? 0 : step / divisor, 3));
  return (v) => {
    // Zero carries no unit. "0K" reads as a rounded number rather than as nothing, and it sits on the
    // baseline of every chart whose values are large enough to compact.
    if (v === 0) return `${prefix}0`;
    // A value the chart's unit would round away entirely is printed at its own scale rather than as
    // "0M": restating a real number as zero is a lie, and a missing suffix beside "10M" reads as the
    // smaller quantity it is. Deliberately narrow. Anything the unit can still express keeps the unit,
    // so 900,000 stays "0.9M" rather than becoming "900K" next to "10M" — two quantities 11% apart in
    // two different units is the "$34K beside $33.9K" problem this formatter exists to prevent.
    if (collapsesToZero(v / divisor, compactDecimals)) return `${prefix}${fixed(v, decimalsForValues([v]))}`;
    const scaled = fixed(v / divisor, compactDecimals);
    return `${prefix}${scaled}${unit}`;
  };
}
