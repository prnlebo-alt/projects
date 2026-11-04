import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { categoryAxis, renderChart } from "@/lib/charts/render";
import { chartSpecSchema, sampleSpec, type ChartSpec } from "@/lib/charts/schema";
import { validationDetails } from "@/lib/charts/validation";

const spec = (overrides: Partial<ChartSpec>): ChartSpec => chartSpecSchema.parse({ ...sampleSpec, ...overrides });
const visibleText = (svg: string) => [...svg.replace(/<title[^>]*>.*?<\/title>|<desc[^>]*>.*?<\/desc>/g, "").matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
const attrs = (svg: string, tag: string, name: string) => [...svg.matchAll(new RegExp(`<${tag} [^>]*?\\b${name}="([^"]+)"`, "g"))].map((match) => Number(match[1]));

describe("chart renderer", () => {
  it("renders deterministic accessible SVG", () => {
    const first = renderChart(sampleSpec);
    const second = renderChart(sampleSpec);
    expect(first.svg).toBe(second.svg);
    expect(first.svg).toContain('role="img"');
    // The ids are derived from the render so two charts on one page cannot collide; they must
    // still be stable for the same spec, and aria-labelledby must point at both of them.
    const ids = first.svg.match(/aria-labelledby="(cr-title-\w+) (cr-desc-\w+)"/);
    expect(ids).not.toBeNull();
    expect(first.svg).toContain(`<title id="${ids![1]}">Monthly recurring revenue</title>`);
    expect(first.svg).toContain(`<desc id="${ids![2]}">`);
    expect(first.altText).toContain("increased");
  });

  it("escapes user-controlled XML", () => {
    const result = renderChart({ ...sampleSpec, title: '<script>alert("x")</script>' });
    expect(result.svg).not.toContain("<script>");
    expect(result.svg).toContain("&lt;script&gt;");
  });

  it("supports every declared chart type", () => {
    for (const type of ["bar", "line", "area", "pie", "scatter"] as const) {
      expect(renderChart({ ...sampleSpec, type }).svg).toContain("<svg");
    }
  });

  it("describes pie charts by share, not as a trend", () => {
    const { altText } = renderChart({ ...sampleSpec, type: "pie", title: "Traffic by source", series: [{ name: "Visits", data: [{ label: "Search", value: 50 }, { label: "Direct", value: 30 }, { label: "Social", value: 15 }, { label: "Email", value: 5 }] }] });
    expect(altText).toBe("Traffic by source. Pie chart of Visits across 4 categories. Largest: Search 50%, Direct 30%, Social 15%. Smallest: Email 5%.");
    expect(altText).not.toContain("increased");
  });

  it("omits a first-to-last trend for scatter plots", () => {
    expect(renderChart({ ...sampleSpec, type: "scatter" }).altText).not.toMatch(/increased|decreased/);
  });

  it("mentions additional series in the summary", () => {
    const altText = renderChart({ ...sampleSpec, series: [...sampleSpec.series, { name: "Target", data: sampleSpec.series[0].data }] }).altText;
    expect(altText).toContain("1 more series shown.");
  });

  it("rejects excessive output dimensions", () => {
    expect(chartSpecSchema.safeParse({ ...sampleSpec, width: 5000 }).success).toBe(false);
  });

  it("drops XML-invalid control characters so the SVG parses and rasterizes", async () => {
    const bad = spec({ title: "Q3\u0001 revenue", series: [{ name: "Sales\u0002", data: [{ label: "Jan\u0008", value: 1 }, { label: "Feb\uFFFE", value: 2 }, { label: "Mar\uD800", value: 3 }] }] });
    const { svg } = renderChart(bad);
    // eslint-disable-next-line no-control-regex
    expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/);
    expect(svg).toContain("Q3 revenue");
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(png.subarray(1, 4).toString()).toBe("PNG");
  });

  it("places each point by its label, not its array index", () => {
    const mismatched = spec({ type: "bar", width: 900, series: [
      { name: "A", data: [{ label: "Jan", value: 1 }, { label: "Feb", value: 2 }] },
      { name: "B", data: [{ label: "Feb", value: 200 }, { label: "Jan", value: 100 }, { label: "Mar", value: 50 }, { label: "Apr", value: 60 }] },
    ] });
    expect(categoryAxis(mismatched).labels).toEqual(["Jan", "Feb", "Mar", "Apr"]);
    const { svg } = renderChart(mismatched);
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="[^"]+" width="([\d.]+)"[^>]*><title>([^<]+)<\/title>/g)].map((match) => ({ x: Number(match[1]), width: Number(match[2]), title: match[3] }));
    const find = (title: string) => rects.find((rect) => rect.title.startsWith(title))!;
    const left = 82;
    const xStep = (900 - left - 40) / 4;
    const slot = (x: number) => Math.floor((x - left) / xStep);
    expect(slot(find("A, Feb").x)).toBe(1);
    expect(slot(find("B, Feb").x)).toBe(1);
    expect(slot(find("B, Jan").x)).toBe(0);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(left);
      expect(rect.x + rect.width).toBeLessThanOrEqual(900 - 40);
    }
    for (const type of ["line", "area", "scatter"] as const) {
      for (const cx of attrs(renderChart({ ...mismatched, type }).svg, "circle", "cx")) {
        expect(cx).toBeGreaterThanOrEqual(left);
        expect(cx).toBeLessThanOrEqual(900 - 40);
      }
    }
  });

  it("keeps repeated labels in their own slots, as before", () => {
    const repeated = spec({ series: [{ name: "A", data: [{ label: "Q1", value: 1 }, { label: "Q1", value: 2 }] }, { name: "B", data: [{ label: "Q1", value: 3 }, { label: "Q1", value: 4 }] }] });
    expect(categoryAxis(repeated)).toEqual({ labels: ["Q1", "Q1"], positions: [[0, 1], [0, 1]] });
  });

  it("names every pie slice in the visible legend", () => {
    const pie = spec({ type: "pie", title: "Share", series: [{ name: "Browser", data: [{ label: "Chrome", value: 60 }, { label: "Safari", value: 30 }, { label: "Edge", value: 10 }] }] });
    const text = visibleText(renderChart(pie).svg);
    expect(text).toEqual(expect.arrayContaining(["Chrome", "Safari", "Edge", "60%", "30%", "10%"]));
    expect(text).not.toContain("Browser");
    // Without a legend the slices are labeled directly.
    expect(visibleText(renderChart({ ...pie, showLegend: false }).svg)).toEqual(expect.arrayContaining(["Chrome", "Safari", "Edge"]));
  });

  it("reports a zero total for an all-zero pie", () => {
    const text = visibleText(renderChart(spec({ type: "pie", series: [{ name: "S", data: [{ label: "A", value: 0 }, { label: "B", value: 0 }] }] })).svg);
    expect(text).toContain("Total 0");
  });

  it("keeps grouped bars inside a narrow canvas", () => {
    const dense = spec({ type: "bar", width: 320, series: Array.from({ length: 12 }, (_, s) => ({ name: `S${s}`, data: Array.from({ length: 100 }, (_, i) => ({ label: `L${i}`, value: i + s })) })) });
    const { svg } = renderChart(dense);
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="[^"]+" width="([\d.]+)"/g)].map((match) => Number(match[1]) + Number(match[2]));
    expect(Math.max(...rects)).toBeLessThanOrEqual(320);
  });

  it("reports validation errors with the full path to the bad field", () => {
    const series = [{ name: "A", data: [{ label: "x", value: 1 }] }, { name: "B", data: [{ label: "a", value: 1 }, { label: "b", value: 1 }, { label: "c", value: 1 }, { label: "", value: 1 }] }];
    const parsed = chartSpecSchema.safeParse({ type: "bar", series });
    expect(parsed.success).toBe(false);
    expect(validationDetails(parsed.error!).issues).toContainEqual({ path: "series.1.data.3.label", message: expect.any(String) });
  });
});
