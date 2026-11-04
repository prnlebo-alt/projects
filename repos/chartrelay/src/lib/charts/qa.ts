import { palette, type ChartSpec } from "./schema";

export type QaIssue = {
  severity: "error" | "warning" | "tip";
  code: string;
  message: string;
  suggestion: string;
};

/**
 * An "error" finding is a contract violation, not advice: the chart cannot show the data it was given
 * (a pie slice for a negative number has no meaning, and a pie with several series draws only the first).
 * POST /api/v1/charts refuses to store a chart with any of these unless the caller explicitly opts in,
 * so this predicate is the single definition of "blocking" shared by the API and the public checker.
 */
export const isBlocking = (issue: QaIssue) => issue.severity === "error";

export const blockingIssues = (issues: QaIssue[]) => issues.filter(isBlocking);

function luminance(hex: string) {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

export function analyzeChart(spec: ChartSpec): QaIssue[] {
  const issues: QaIssue[] = [];
  const points = spec.series.reduce((total, series) => total + series.data.length, 0);
  const background = spec.theme === "dark" ? "#11131A" : "#FFFFFF";

  // Trimmed here as well as in the schema: /chart-check promises this rule fires when "the title is
  // empty or still the placeholder", and a title of spaces is empty to every reader. analyzeChart is
  // also called with specs that never went through the schema, so it cannot assume normalized input.
  const title = spec.title.trim();
  if (!title || title === "Untitled chart") {
    issues.push({ severity: "warning", code: "missing-title", message: "The chart lacks a meaningful title.", suggestion: "State the decision or metric the reader should understand." });
  }
  if (spec.type === "pie" && spec.series.length > 1) {
    issues.push({ severity: "error", code: "pie-multiple-series", message: "Pie charts cannot compare multiple series clearly.", suggestion: "Use a grouped bar chart or keep one series." });
  }
  if (spec.type === "pie" && spec.series[0].data.length > 7) {
    issues.push({ severity: "warning", code: "pie-too-many-slices", message: "Too many slices make the chart hard to scan.", suggestion: "Keep the largest six categories and group the rest as Other." });
  }
  if (spec.type === "pie" && spec.series.some((series) => series.data.some((point) => point.value < 0))) {
    issues.push({ severity: "error", code: "pie-negative-value", message: "A pie chart cannot represent negative values.", suggestion: "Use a bar chart for signed values." });
  }
  if (spec.type !== "pie" && points > 40) {
    issues.push({ severity: "warning", code: "dense-chart", message: `${points} points will be cramped at this size.`, suggestion: "Aggregate, filter, or widen the output." });
  }
  if (spec.series.length > 7) {
    issues.push({ severity: "warning", code: "too-many-series", message: "The legend asks readers to track too many series.", suggestion: "Highlight the important series and mute or remove the rest." });
  }
  if (spec.type === "pie") {
    // Pie slices use the palette per slice (series.color is not drawn) with white percentage labels on top.
    spec.series[0].data.forEach((point, index) => {
      if (contrast(palette[index % palette.length], "#FFFFFF") < 3) {
        issues.push({ severity: "warning", code: "low-contrast", message: `The ${point.label} slice's percentage label has weak contrast.`, suggestion: "Group small categories as Other to use fewer slices." });
      }
    });
  } else {
    spec.series.forEach((series, index) => {
      // Check the color actually drawn, including palette defaults.
      const color = series.color ?? palette[index % palette.length];
      if (contrast(color, background) < 3) {
        issues.push({ severity: "warning", code: "low-contrast", message: `${series.name} has weak contrast against the background.`, suggestion: "Choose a darker or lighter series color." });
      }
    });
  }
  if (spec.type !== "pie" && spec.series.some((series) => series.data.some((point) => point.label.length > 12))) {
    issues.push({ severity: "tip", code: "long-labels", message: "Category labels longer than 12 characters are shortened on the axis.", suggestion: "Use shorter labels, or put the full names in the subtitle." });
  }
  // A chart with one point draws a single mark: there is nothing to compare it with and no trend to read.
  // A tip, not a warning — it is sometimes exactly what the caller wants (a gauge, a placeholder to fill in).
  if (points === 1) {
    issues.push({ severity: "tip", code: "single-point", message: "One data point shows no comparison and no trend.", suggestion: "Add the points the reader should compare, or state the number in a sentence instead of a chart." });
  }
  if (issues.length === 0) {
    issues.push({ severity: "tip", code: "healthy", message: "No structural chart problems detected.", suggestion: "Verify the source data and intended takeaway before publishing." });
  }
  return issues;
}
