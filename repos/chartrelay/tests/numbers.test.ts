import { describe, expect, it } from "vitest";
import { collapsesToZero, decimalsForValues, decimalsToPrint, fixed, preciseFormat } from "@/lib/charts/numbers";
import { columns, light, makeFormat, type Datum } from "@/lib/charts/editorial";
import { renderChart, summary } from "@/lib/charts/render";
import type { ChartSpec } from "@/lib/charts/schema";

const points = (values: number[]): Datum[] => values.map((value, i) => ({ label: `P${i}`, value }));
const tickLabels = (svg: string) =>
  [...svg.matchAll(/<text[^>]*text-anchor="end"[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);

const spec = (values: number[]): ChartSpec => ({
  type: "bar",
  title: "T",
  series: [{ name: "S", data: values.map((value, i) => ({ label: `P${i}`, value })) }],
  width: 900,
  height: 520,
  theme: "light",
  showLegend: true,
  showValues: false,
} as ChartSpec);

describe("a number may be shortened, never restated", () => {
  it("never writes a negative zero", () => {
    expect(fixed(-0.004, 2)).toBe("0");
    expect(fixed(-0.4, 0)).toBe("0");
    expect(fixed(-0.004, 3)).toBe("-0.004");
  });

  it("knows when rounding would turn a real number into zero", () => {
    expect(collapsesToZero(0.004, 2)).toBe(true);
    expect(collapsesToZero(0.006, 2)).toBe(false);
    // Zero is allowed to print as zero. Only a non-zero number collapsing is a defect.
    expect(collapsesToZero(0, 2)).toBe(false);
  });

  it("widens for the smallest number present, not the largest", () => {
    expect(decimalsForValues([0.00001, 0.00002, 0.000015])).toBeGreaterThanOrEqual(5);
    expect(decimalsForValues([10, 25, 40])).toBe(0);
    expect(decimalsToPrint(0.25, 4)).toBe(2);
  });
});

describe("an axis for data smaller than its own rounding", () => {
  it("does not print four identical zeros over four different bar heights", () => {
    // Bars drawn correctly and proportionally over an axis reading 0, 0, 0, 0: the picture showed a
    // trend and every number on it said nothing happened.
    const ticks = tickLabels(columns({ t: light, title: "Tiny", data: points([0.00001, 0.00002, 0.000015]) }));
    expect(new Set(ticks).size).toBe(ticks.length);
  });

  it("labels the focus value as itself", () => {
    const svg = columns({ t: light, title: "Tiny", data: points([0.00001, 0.00002, 0.000015]) });
    expect(svg).toContain(">0.000015<");
  });
});

describe("compaction picks its precision from the step", () => {
  it("does not label 250,000 as 0.3M on a 0 to 1M axis", () => {
    const format = makeFormat([0, 1_000_000], { step: 250_000 });
    expect(format(250_000)).toBe("0.25M");
    expect(format(750_000)).toBe("0.75M");
    expect(format(1_000_000)).toBe("1M");
  });

  it("keeps one decimal when there is no step to follow", () => {
    const format = makeFormat([0, 50_000]);
    expect(format(33_900)).toBe("33.9K");
  });

  it("prints a small value at its own scale rather than as 0M", () => {
    // Mixing units in one figure is a cost; restating a real number as zero is a lie, and it is worse.
    const format = makeFormat([2, 10_000_000], { step: 2_500_000 });
    expect(format(2)).toBe("2");
    expect(format(10_000_000)).toBe("10M");
  });

  it("still gives zero no unit", () => {
    expect(makeFormat([0, 10_000_000])(0)).toBe("0");
  });
});

describe("the description uses one precision for the whole chart", () => {
  it("does not call a negative point '-0'", () => {
    const text = summary(spec([-0.004, 0.006, 0.002]));
    expect(text).not.toContain("-0 ");
    // The word boundary after "0" is satisfied by the decimal point, so -0.004 would match a naive \b.
    expect(text).not.toMatch(/bottoms at -0(?![.\d])/);
    expect(text).toContain("-0.004");
  });

  it("describes both ends on the same scale", () => {
    const text = summary(spec([-0.004, 0.006, 0.002]));
    expect(text).toContain("0.006");
  });

  it("leaves ordinary money alone", () => {
    const text = summary(spec([1234.56, 2000, 1500]));
    expect(text).toContain("1,234.56");
    expect(text).not.toContain("1,234.5600");
  });

  it("picks a sensible precision for whole numbers", () => {
    expect(preciseFormat([10, 25, 40])(25)).toBe("25");
  });
});

describe("the classic renderer speaks one unit per chart", () => {
  const classic = (values: number[], showValues: boolean): string => {
    const spec = {
      type: "bar", title: "T", theme: "light", width: 900, height: 520, showLegend: true, showValues,
      series: [{ name: "S", data: values.map((value, i) => ({ label: `P${i}`, value })) }],
    } as ChartSpec;
    return renderChart(spec).svg;
  };
  const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

  it("does not label 900,000 as 900K beside 10M", () => {
    // Each number used to be compacted on its own, so two quantities 11% apart printed in two
    // different units over an axis whose ticks were all in millions.
    const drawn = texts(classic([10_000_000, 900_000, 400_000, 3_000_000], true));
    expect(drawn).not.toContain("900K");
    expect(drawn).toContain("0.9M");
  });

  it("keeps the axis and the value labels in the same unit", () => {
    const drawn = texts(classic([10_000_000, 900_000, 400_000, 3_000_000], true)).filter((t) => /[KMB]$/.test(t));
    const units = new Set(drawn.map((t) => t.slice(-1)));
    expect(units.size).toBe(1);
  });

  it("leaves a small-number chart uncompacted", () => {
    expect(texts(classic([1, 2, 3], true))).toContain("3");
  });
});

describe("percentage change needs a baseline worth dividing by", () => {
  it("does not report a percentage across a sign change", () => {
    // -40 to 30 is arithmetically "increased 175%" and editorially nonsense. One real probe produced
    // "increased 20100.0%".
    const text = summary(spec([-40, -10, 15, 30]));
    expect(text).not.toMatch(/increased [\d.]+%/);
    expect(text).toContain("moved from -40 to 30");
  });

  it("does not report a percentage against a negative baseline", () => {
    // -10 to -30 is a loss getting worse, reported as "decreased 200%".
    const text = summary(spec([-10, -20, -30]));
    expect(text).not.toMatch(/decreased [\d.]+%/);
    expect(text).toContain("moved from -10 to -30");
  });

  it("still reports a percentage when the baseline is positive", () => {
    expect(summary(spec([10, 20, 30]))).toMatch(/increased 200\.0% from first to last point/);
  });

  it("still says nothing about a trend when the baseline is zero", () => {
    const text = summary(spec([0, 10, 20]));
    expect(text).not.toContain("%");
    expect(text).not.toContain("moved from");
  });
});
