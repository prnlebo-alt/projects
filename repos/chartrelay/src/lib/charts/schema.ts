import { z } from "zod";

// Every default color keeps at least 3:1 contrast against both theme backgrounds and under white pie labels.
export const palette = ["#6C5CE7", "#00A383", "#0984E3", "#E17055", "#E84393", "#B7791F", "#00898A"] as const;

/**
 * Largest magnitude accepted for a data value, and the clamp the renderer falls back on.
 *
 * Generous for real data: 1e15 is a thousand times world GDP in dollars, and it is inside the 2^53
 * range where an integer is still exact in a double, so no legitimate figure is refused or bent.
 * Safe for the arithmetic: the scale subtracts the minimum from the maximum (at most 2e15), a pie
 * sums at most 100 points (at most 1e17) and shares multiply by 100 (at most 1e19) — every step
 * stays far below Number.MAX_VALUE (~1.8e308). Merely requiring a finite number was not enough:
 * [-1e308, 1e308] overflows that first subtraction to Infinity, after which every coordinate is
 * Infinity / Infinity = NaN and the stored SVG is unparseable.
 */
export const MAX_VALUE_MAGNITUDE = 1e15;

const datumSchema = z.object({
  // Trimmed before the length check, so a whitespace-only label is rejected rather than drawn blank.
  label: z.string().trim().min(1).max(80),
  value: z.number().finite().min(-MAX_VALUE_MAGNITUDE).max(MAX_VALUE_MAGNITUDE),
});

const seriesSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  data: z.array(datumSchema).min(1).max(100),
});

export const chartSpecSchema = z.object({
  type: z.enum(["bar", "line", "area", "pie", "scatter"]),
  // Trimmed first, so "   " arrives as "" and trips the missing-title QA rule instead of passing as a title.
  title: z.string().trim().max(120).default("Untitled chart"),
  subtitle: z.string().trim().max(180).optional(),
  width: z.number().int().min(320).max(2400).default(900),
  height: z.number().int().min(240).max(1600).default(520),
  theme: z.enum(["light", "dark"]).default("light"),
  showLegend: z.boolean().default(true),
  showValues: z.boolean().default(false),
  series: z.array(seriesSchema).min(1).max(12),
});

export type ChartSpec = z.infer<typeof chartSpecSchema>;

/**
 * Request-level options that are not part of the chart itself.
 *
 * They travel in the same JSON object as the spec but are parsed separately and never stored: chartSpecSchema
 * strips unknown keys, so the saved spec is the chart alone. `allowQualityErrors` is the deliberate escape
 * hatch for POST /api/v1/charts — by default a QA finding with severity "error" is refused with 422, and a
 * caller who wants the chart anyway has to say so explicitly per request.
 */
export const chartRequestOptionsSchema = z.object({
  allowQualityErrors: z.boolean().default(false),
  /**
   * Which renderer draws it. "editorial" is the default because it is the better chart; "classic" is
   * kept so a caller who has already built a page around the old drawing can pin it and not be moved
   * by a deployment. Forms the editorial renderer cannot draw yet fall back to classic and say so,
   * rather than silently becoming a different chart.
   */
  style: z.enum(["editorial", "classic"]).default("editorial"),
});

export type ChartRequestOptions = z.infer<typeof chartRequestOptionsSchema>;

export const sampleSpec: ChartSpec = {
  type: "bar",
  title: "Monthly recurring revenue",
  subtitle: "Revenue grew 84% over six months",
  width: 900,
  height: 520,
  theme: "light",
  showLegend: true,
  showValues: true,
  series: [
    {
      name: "MRR",
      color: "#6C5CE7",
      data: [
        { label: "Apr", value: 18400 },
        { label: "May", value: 21300 },
        { label: "Jun", value: 24700 },
        { label: "Jul", value: 26900 },
        { label: "Aug", value: 31200 },
        { label: "Sep", value: 33900 },
      ],
    },
  ],
};
