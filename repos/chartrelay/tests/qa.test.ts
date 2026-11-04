import { describe, expect, it } from "vitest";
import { analyzeChart } from "@/lib/charts/qa";
import { palette, sampleSpec, type ChartSpec } from "@/lib/charts/schema";

const codes = (spec: ChartSpec) => analyzeChart(spec).map((issue) => issue.code);
const series = (count: number, points = 3) => Array.from({ length: count }, (_, s) => ({ name: `S${s}`, data: Array.from({ length: points }, (_, i) => ({ label: `L${i}`, value: i + s })) }));

describe("chart QA", () => {
  it("flags invalid negative pie values", () => {
    const issues = analyzeChart({ ...sampleSpec, type: "pie", series: [{ name: "Share", data: [{ label: "A", value: -1 }, { label: "B", value: 2 }] }] });
    expect(issues.some((issue) => issue.code === "pie-negative-value" && issue.severity === "error")).toBe(true);
  });

  it("flags overloaded pie charts", () => {
    const issues = analyzeChart({ ...sampleSpec, type: "pie", series: [{ name: "Share", data: Array.from({ length: 8 }, (_, index) => ({ label: String(index), value: 1 })) }] });
    expect(issues.some((issue) => issue.code === "pie-too-many-slices")).toBe(true);
  });

  it("returns a healthy publication tip for a clean chart", () => {
    expect(analyzeChart(sampleSpec)[0].code).toBe("healthy");
  });

  it("keeps every default palette color readable on both themes and under white pie labels", () => {
    // Seven series without custom colors use the whole palette; none may be flagged.
    expect(codes({ ...sampleSpec, type: "line", series: series(7) })).not.toContain("low-contrast");
    expect(codes({ ...sampleSpec, type: "line", theme: "dark", series: series(7) })).not.toContain("low-contrast");
    expect(codes({ ...sampleSpec, type: "pie", series: [{ name: "Share", data: palette.map((_, i) => ({ label: `P${i}`, value: 1 })) }] })).not.toContain("low-contrast");
  });

  it("flags a low-contrast custom color only where it is drawn", () => {
    const pale = [{ name: "Pale", color: "#FDCB6E", data: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }];
    expect(codes({ ...sampleSpec, type: "line", series: pale })).toContain("low-contrast");
    // Pie slices use the palette, so a series color that is never drawn must not be reported.
    expect(codes({ ...sampleSpec, type: "pie", series: pale })).not.toContain("low-contrast");
  });

  it("flags dense area and scatter charts, not only bar and line", () => {
    expect(codes({ ...sampleSpec, type: "area", series: series(1, 100) })).toContain("dense-chart");
    expect(codes({ ...sampleSpec, type: "scatter", series: series(1, 100) })).toContain("dense-chart");
  });

  it("tells the user when axis labels will be shortened", () => {
    expect(codes({ ...sampleSpec, series: [{ name: "A", data: [{ label: "A very long category name", value: 1 }] }] })).toContain("long-labels");
  });
});
