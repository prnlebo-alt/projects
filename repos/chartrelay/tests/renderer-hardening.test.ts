/**
 * Renderer hardening: per-tier resource caps, the render timeout, and a fuzz corpus.
 *
 * Covers the spec's stress-test row
 *
 *   | 50 MB payload or 10M points | 413 before any credit moves |
 *
 * where "before" is the load-bearing word. A 50 MB body that is parsed and *then* refused has
 * already cost the server the parse, so every test below that claims "before any work" proves it by
 * handing the guard a spy and asserting the spy was never called.
 *
 * And the spec's fuzz requirement: "Fuzz parser and renderer with oversized, deeply nested and
 * malformed input." The invariant for every input is one of exactly two outcomes — a refusal naming
 * a cap, or a well-formed SVG. Never a hang, never `NaN` in a coordinate, never an unparseable
 * document, never a thrown `TypeError`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { renderChart, renderChartWithin, RenderTimeoutError, sanitizeSpec, summary, withRenderDeadline } from "@/lib/charts/render";
import { renderStyled } from "@/lib/charts/style";
import { chartSpecSchema, sampleSpec, type ChartSpec } from "@/lib/charts/schema";
import {
  assertDataPointsWithinLimits,
  assertNestingWithinLimits,
  assertOutputWithinLimits,
  assertPayloadWithinLimits,
  assertSvgWithinLimits,
  countDataPoints,
  guardChartPayload,
  jsonNestingDepth,
  LimitExceededError,
  limitsFor,
  PLAN_TIERS,
  type PlanTier,
} from "@/lib/charts/validation";
import { ERROR_CODES } from "@/lib/http/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

const refused = (fn: () => unknown): LimitExceededError => {
  try {
    fn();
  } catch (error) {
    if (error instanceof LimitExceededError) return error;
    throw error;
  }
  throw new Error("Expected the input to be refused, but it was accepted.");
};

/**
 * XML 1.0 forbids these outright; one of them in the output makes the document unparseable.
 *
 * Surrogates are counted only when they are *lone*. A correctly paired pair is how JavaScript spells
 * an astral character — an emoji is two code units — and flagging those would fail every chart whose
 * title contains one, which is the opposite of the invariant being asserted.
 */
function invalidXmlCodePoints(value: string): string[] {
  const found: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        continue;
      }
      found.push(`lone high surrogate U+${code.toString(16).toUpperCase()} at ${index}`);
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      found.push(`lone low surrogate U+${code.toString(16).toUpperCase()} at ${index}`);
      continue;
    }
    const forbidden = (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0xfffe || code === 0xffff;
    if (forbidden) found.push(`U+${code.toString(16).toUpperCase().padStart(4, "0")} at ${index}`);
  }
  return found;
}

/** The shape of every acceptable render, whatever was fed in. */
function expectWellFormedSvg(svg: string, label: string) {
  expect(svg.startsWith("<svg"), label).toBe(true);
  expect(svg.endsWith("</svg>"), label).toBe(true);
  // "NaN", "Infinity" and "∞" are what broken arithmetic writes into markup and into alt text.
  expect(svg, label).not.toMatch(/NaN|Infinity|∞/);
  expect(invalidXmlCodePoints(svg), label).toEqual([]);
  // Every `<` that is not a tag is an unescaped one, which is the other way to produce bad XML.
  expect(svg.replace(/<\/?[A-Za-z][^<>]*>/g, ""), label).not.toMatch(/[<>]/);
  // Tags opened and closed in equal number. Crude, but it catches a truncated document.
  const opened = (svg.match(/<[A-Za-z]/g) ?? []).length;
  const closed = (svg.match(/<\/[A-Za-z]/g) ?? []).length + (svg.match(/\/>/g) ?? []).length;
  expect(opened, label).toBe(closed);
}

const spec = (overrides: Partial<ChartSpec>): ChartSpec => ({ ...sampleSpec, ...overrides });

/**
 * An array of `length` with no elements allocated, for expressing "ten million points" in a test.
 *
 * Setting `.length` is what keeps this cheap: `Array.from({ length: 10_000_000 })` would allocate
 * ten million slots and make the test the slowest in the suite, which would also hide the property
 * being asserted — that the guard refuses on `data.length` without ever reading an element.
 */
const holeyArray = (length: number): unknown[] => {
  const array: unknown[] = [];
  array.length = length;
  return array;
};

const seriesOf = (values: number[], labels?: string[]): ChartSpec["series"] => [
  { name: "Series", data: values.map((value, index) => ({ label: labels?.[index] ?? `L${index}`, value })) },
];

// ---------------------------------------------------------------------------
// Stress-test row: 50 MB payload or 10M points
// ---------------------------------------------------------------------------

describe("the stress-test row: 50 MB payload or 10M points", () => {
  it("refuses a 50 MB body with 413 payload_too_large before it is parsed or rendered", () => {
    // 50 MB of bytes, never turned into a JS string: if the guard touched it, this test would be
    // the slowest in the suite.
    const body = Buffer.alloc(50 * 1024 * 1024, 0x78);
    const parse = vi.spyOn(JSON, "parse");
    const work = vi.fn(() => "rendered");

    const error = refused(() => guardChartPayload(body, "developer", work));

    expect(error.code).toBe("payload_too_large");
    expect(error.status).toBe(413);
    expect(ERROR_CODES.payload_too_large.status).toBe(413);
    expect(error.limit).toBe("payload_bytes");
    expect(error.observed).toBe(50 * 1024 * 1024);
    expect(error.allowed).toBe(limitsFor("developer").maxPayloadBytes);
    // The whole point of the row. Nothing was parsed, nothing was rendered, so nothing was charged.
    expect(work).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("refuses 10,000,000 data points on the array length alone, without walking the array", () => {
    // Read from `data.length`, so a ten-million-element array costs one property read to refuse.
    // A holey array is the cheapest way to express "ten million points" in a test; the guard never
    // looks at an element, which is exactly the property being asserted.
    const huge = { type: "bar", series: [{ name: "S", data: holeyArray(10_000_000) }] };
    for (const tier of PLAN_TIERS) {
      const error = refused(() => assertDataPointsWithinLimits(huge, tier));
      expect(error.code, tier).toBe("payload_too_large");
      expect(error.status, tier).toBe(413);
      expect(error.limit, tier).toBe("data_points");
      expect(error.observed, tier).toBe(10_000_000);
    }
  });

  it("stops counting points as soon as the cap is passed", () => {
    // Short-circuiting is what keeps the refusal cheap. Without it the count is O(series).
    const many = { series: Array.from({ length: 5_000 }, () => ({ name: "S", data: holeyArray(10_000) })) };
    expect(countDataPoints(many, 400)).toBeGreaterThan(400);
    // Counted only as far as it had to: the first series already blows a 400-point cap.
    expect(countDataPoints(many, 400)).toBe(10_000);
    // With no ceiling it counts everything, which is how we know the ceiling did the work above.
    expect(countDataPoints(many)).toBe(50_000_000);
  });

  it("refuses an over-cap point count before any work is done", () => {
    // Same row, taken through the full guard with a body small enough that the byte cap cannot be
    // what refused it — so the refusal is attributable to the point count and to nothing else.
    const body = JSON.stringify({ type: "bar", title: "t", series: [{ name: "S", data: Array.from({ length: 1_000 }, (_, index) => ({ label: `L${index}`, value: index })) }] });
    expect(Buffer.byteLength(body)).toBeLessThan(limitsFor("free").maxPayloadBytes);
    const work = vi.fn(() => "rendered");

    const error = refused(() => guardChartPayload(body, "free", work));

    expect(error.limit).toBe("data_points");
    expect(error.status).toBe(413);
    expect(error.observed).toBe(1_000);
    expect(error.allowed).toBe(400);
    expect(work).not.toHaveBeenCalled();
  });

  it("runs the work when, and only when, every cap is satisfied", () => {
    // A guard that refuses everything passes every test above and ships a broken product.
    const body = JSON.stringify(sampleSpec);
    const work = vi.fn((value: unknown) => (value as { title: string }).title);
    expect(guardChartPayload(body, "free", work)).toBe("Monthly recurring revenue");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Per-tier caps
// ---------------------------------------------------------------------------

describe("per-tier caps", () => {
  it("exposes every cap as a function of the tier, with no tier getting less than Free", () => {
    // The plan ladder is being built separately; whoever wires it up changes the table, not the
    // call sites. This asserts the ladder is a ladder.
    const ladder: PlanTier[] = ["free", "developer", "pro", "business"];
    for (let index = 1; index < ladder.length; index += 1) {
      const lower = limitsFor(ladder[index - 1]);
      const higher = limitsFor(ladder[index]);
      expect(higher.maxPayloadBytes, ladder[index]).toBeGreaterThanOrEqual(lower.maxPayloadBytes);
      expect(higher.maxDataPoints, ladder[index]).toBeGreaterThanOrEqual(lower.maxDataPoints);
      expect(higher.maxOutputPixels, ladder[index]).toBeGreaterThanOrEqual(lower.maxOutputPixels);
      expect(higher.maxSvgBytes, ladder[index]).toBeGreaterThanOrEqual(lower.maxSvgBytes);
    }
    // Free has to be strictly smaller somewhere, or "per-tier" is decoration.
    expect(limitsFor("free").maxPayloadBytes).toBeLessThan(limitsFor("business").maxPayloadBytes);
    expect(limitsFor("free").maxDataPoints).toBeLessThan(limitsFor("business").maxDataPoints);
    expect(limitsFor("free").maxOutputPixels).toBeLessThan(limitsFor("business").maxOutputPixels);
  });

  it("gives the 10 s render timeout to every tier, because it is a safety limit and not a feature", () => {
    for (const tier of PLAN_TIERS) expect(limitsFor(tier).renderTimeoutMs, tier).toBe(10_000);
  });

  it("falls back to the smallest caps for an unknown or missing tier", () => {
    // Fail closed: a tier string nobody recognises must not be a way to buy Business limits.
    expect(limitsFor("enterprise")).toEqual(limitsFor("free"));
    expect(limitsFor(undefined)).toEqual(limitsFor("free"));
    expect(limitsFor(null)).toEqual(limitsFor("free"));
  });

  it("refuses on Free what it accepts on Pro, for each of payload, points and pixels", () => {
    const payload = Buffer.alloc(limitsFor("free").maxPayloadBytes + 1);
    expect(refused(() => assertPayloadWithinLimits(payload, "free")).limit).toBe("payload_bytes");
    expect(() => assertPayloadWithinLimits(payload, "pro")).not.toThrow();

    const points = { series: [{ name: "S", data: holeyArray(limitsFor("free").maxDataPoints + 1) }] };
    expect(refused(() => assertDataPointsWithinLimits(points, "free")).limit).toBe("data_points");
    expect(() => assertDataPointsWithinLimits(points, "pro")).not.toThrow();

    const big = { width: 2400, height: 1600 };
    expect(refused(() => assertOutputWithinLimits(big, "free")).limit).toBe("output_pixels");
    expect(() => assertOutputWithinLimits(big, "pro")).not.toThrow();
  });

  it("caps the output size, which is the in-render stand-in for a memory cap", () => {
    const oversized = "x".repeat(limitsFor("free").maxSvgBytes + 1);
    const error = refused(() => assertSvgWithinLimits(oversized, "free"));
    expect(error.limit).toBe("svg_bytes");
    expect(error.status).toBe(413);
    expect(() => assertSvgWithinLimits(oversized, "business")).not.toThrow();
    // A real chart is nowhere near any tier's cap; the limit is for pathological input only.
    expect(() => assertSvgWithinLimits(renderChart(sampleSpec).svg, "free")).not.toThrow();
  });

  it("measures the payload in bytes, not characters", () => {
    // A multi-byte title is the easy way past a `.length` check: 40,000 emoji is 160 KB of UTF-8.
    const body = "\u{1F600}".repeat(20_000);
    expect(body.length).toBeLessThan(limitsFor("free").maxPayloadBytes);
    expect(refused(() => assertPayloadWithinLimits(body, "free")).observed).toBe(Buffer.byteLength(body, "utf8"));
  });
});

// ---------------------------------------------------------------------------
// Deep nesting
// ---------------------------------------------------------------------------

describe("deeply nested input", () => {
  it("refuses 200,000 levels of nesting on the text, before the object graph is built", () => {
    const deep = `${"[".repeat(200_000)}${"]".repeat(200_000)}`;
    // Why the check has to run *before* the parse rather than on the result. V8's JSON parser is
    // iterative on this version of Node, so it does not overflow — it succeeds, and hands back a
    // 200,000-deep graph of 200,000 objects that is then a liability for anything recursive that
    // touches it. `structuredClone`, in the standard library, overflows the stack on exactly this
    // value, and so would any recursive walk we or a dependency add later. Refusing on the text
    // costs O(depth cap) and allocates nothing.
    const parsed = JSON.parse(deep);
    expect(() => structuredClone(parsed)).toThrow(RangeError);

    const parse = vi.spyOn(JSON, "parse");
    const work = vi.fn();
    const error = refused(() => guardChartPayload(deep, "business", work));

    expect(error.limit).toBe("nesting_depth");
    expect(error.code).toBe("invalid_chart_spec");
    expect(error.status).toBe(400);
    expect(work).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("measures depth without reading the whole body once the ceiling is passed", () => {
    const deep = `${"[".repeat(1_000_000)}`;
    expect(jsonNestingDepth(deep, 16)).toBeGreaterThan(16);
    expect(jsonNestingDepth('{"a":{"b":{"c":1}}}')).toBe(3);
    expect(jsonNestingDepth(JSON.stringify(sampleSpec))).toBe(5);
  });

  it("does not mistake brackets inside a string for nesting", () => {
    // A legitimate label of "[[[[[[" is a label. Refusing it would be a cap that punishes real data.
    const brackets = "[".repeat(20) + "]".repeat(5) + "{".repeat(8) + "}".repeat(3);
    const body = JSON.stringify({ title: brackets, series: [{ name: `a"${brackets}`, data: [{ label: `\\${brackets}`, value: 1 }] }] });
    expect(jsonNestingDepth(body)).toBe(5);
    expect(() => assertNestingWithinLimits(body, "free")).not.toThrow();
  });

  it("accepts a real chart spec at every tier, including the smallest depth cap", () => {
    for (const tier of PLAN_TIERS) expect(() => assertNestingWithinLimits(JSON.stringify(sampleSpec), tier), tier).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Render timeout
// ---------------------------------------------------------------------------

describe("the 10 s render timeout", () => {
  it("abandons a render part-way through rather than after it finished", () => {
    // The distinction this test exists for: a post-hoc "how long did that take?" check still bills
    // the full render in CPU before noticing. `completed` is false only if the renderer itself
    // looked at the clock and gave up mid-flight.
    let completed = false;
    let clockReads = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      clockReads += 1;
      // Read 1 is the budget's start; read 2 is the renderer's first checkpoint, still in time.
      // Everything after that is 20 s later, so the next checkpoint must abort.
      return clockReads <= 2 ? 1_000 : 21_000;
    });

    const error = (() => {
      try {
        withRenderDeadline(10_000, () => {
          renderChart(spec({ series: seriesOf(Array.from({ length: 100 }, (_, index) => index)) }));
          completed = true;
        });
      } catch (thrown) {
        return thrown;
      }
      throw new Error("Expected the render to time out.");
    })();

    expect(error).toBeInstanceOf(RenderTimeoutError);
    expect((error as RenderTimeoutError).budgetMs).toBe(10_000);
    expect((error as RenderTimeoutError).elapsedMs).toBe(20_000);
    expect(completed, "the renderer ran to completion instead of aborting at a checkpoint").toBe(false);
  });

  it("refuses immediately when the budget is already gone", () => {
    let completed = false;
    expect(() =>
      withRenderDeadline(0, () => {
        renderChart(sampleSpec);
        completed = true;
      }),
    ).toThrow(RenderTimeoutError);
    expect(completed, "a spent budget must stop the render, not be noticed after it").toBe(false);
  });

  it("maps to render_failed, which the billing spec never charges for", () => {
    const error = new RenderTimeoutError(10_000, 12_345);
    expect(error.code).toBe("render_failed");
    expect(error.status).toBe(500);
    expect(ERROR_CODES.render_failed.status).toBe(500);
    expect(error.message).toMatch(/10000 ms/);
  });

  it("lets an ordinary render finish, and clears the deadline afterwards", () => {
    const result = withRenderDeadline(10_000, () => renderChart(sampleSpec));
    expect(result.svg).toContain("<svg");
    // The deadline is module state; a leak would make the next unbudgeted render fail at random.
    expect(() => renderChart(sampleSpec)).not.toThrow();
  });

  it("keeps the nearer deadline when budgets nest", () => {
    expect(() => withRenderDeadline(10_000, () => withRenderDeadline(0, () => renderChart(sampleSpec)))).toThrow(RenderTimeoutError);
    // The outer budget is restored, not clobbered, by the inner one unwinding.
    expect(withRenderDeadline(10_000, () => renderChart(sampleSpec)).svg).toContain("<svg");
  });

  it("renderChartWithin takes its budget and its output cap from the tier", () => {
    expect(renderChartWithin(sampleSpec, "free").svg).toContain("<svg");
    expect(renderChartWithin(sampleSpec, "business", 10_000).altText).toBe(summary(sampleSpec));
    expect(() => renderChartWithin(sampleSpec, "free", 0)).toThrow(RenderTimeoutError);
  });
});

// ---------------------------------------------------------------------------
// Malformed input
// ---------------------------------------------------------------------------

describe("malformed input", () => {
  it("refuses bodies that are not JSON, naming the parser's own complaint", () => {
    for (const body of ["", "   ", "{", "}{", "[1,2,", '{"a":}', "undefined", "{'a':1}", '{"a":1}trailing', "\u0000\u0000"]) {
      const error = refused(() => guardChartPayload(body, "free", () => "rendered"));
      expect(error.code, JSON.stringify(body)).toBe("invalid_chart_spec");
      expect(error.status, JSON.stringify(body)).toBe(400);
      expect(error.limit, JSON.stringify(body)).toBe("json");
    }
  });

  it("refuses NaN and Infinity as JSON literals, because JSON has no such thing", () => {
    for (const body of ['{"value":NaN}', '{"value":Infinity}', '{"value":-Infinity}', '{"value":undefined}']) {
      expect(refused(() => guardChartPayload(body, "free", () => 1)).limit).toBe("json");
    }
  });

  it("refuses a spec whose numbers are not numbers, at the schema", () => {
    // The schema is the layer that owns field-level validity; these are the values that reach it
    // once a client sends them as strings or nulls.
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "5", null, {}, []]) {
      const parsed = chartSpecSchema.safeParse({ ...sampleSpec, series: [{ name: "S", data: [{ label: "A", value }] }] });
      expect(parsed.success, String(value)).toBe(false);
    }
  });

  it("refuses a spec whose structure is wrong, rather than rendering a hole", () => {
    for (const bad of [
      { ...sampleSpec, series: [] },
      { ...sampleSpec, series: [{ name: "S", data: [] }] },
      { ...sampleSpec, series: [{ name: "S", data: holeyArray(3) }] },
      { ...sampleSpec, series: [{ name: "", data: [{ label: "A", value: 1 }] }] },
      { ...sampleSpec, series: [{ name: "S", data: [{ label: "   ", value: 1 }] }] },
      { ...sampleSpec, series: [{ name: "S", color: "red", data: [{ label: "A", value: 1 }] }] },
      { ...sampleSpec, type: "donut" },
      { ...sampleSpec, width: Number.NaN },
      { ...sampleSpec, width: 2400.5 },
      { ...sampleSpec, series: Array.from({ length: 13 }, () => ({ name: "S", data: [{ label: "A", value: 1 }] })) },
      { ...sampleSpec, series: [{ name: "S", data: Array.from({ length: 101 }, () => ({ label: "A", value: 1 })) }] },
      null,
      [],
      "a string",
    ]) {
      expect(chartSpecSchema.safeParse(bad).success, JSON.stringify(bad)?.slice(0, 60)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Fuzzing the renderers
// ---------------------------------------------------------------------------

/** Values chosen to break arithmetic: the float boundaries, the degenerate cases, and non-numbers. */
const HOSTILE_VALUES = [
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  Number.MIN_VALUE,
  -Number.MIN_VALUE,
  Number.EPSILON,
  Number.MAX_SAFE_INTEGER,
  -Number.MAX_SAFE_INTEGER,
  5e-324,
  1e308,
  -1e308,
  1e15,
  -1e15,
  0,
  -0,
];

/** Strings chosen to break XML: the characters XML 1.0 forbids, plus markup that wants to escape. */
const HOSTILE_STRINGS = [
  "\u0000",
  "\u0001\u0002\u0008",
  "\u001f",
  "￾",
  "￿",
  "\uD800", // lone high surrogate
  "\uDFFF", // lone low surrogate
  "a\uD800b\uDC00c", // surrogates in the wrong order, so they never pair
  "]]>",
  "<![CDATA[",
  "<!-- -->",
  "</svg><script>alert(1)</script>",
  '" onload="alert(1)',
  "' onload='alert(1)",
  "&amp;",
  "&#x41;",
  "&nosuchentity;",
  "<>&\"'",
  "\\u0000",
  "\t\n\r",
  "‮​", // bidi override and zero-width space: legal XML, hostile typography
  "\u{1F4A9}",
  "ok",
];

/** Deterministic PRNG, so a failure is reproducible from the seed printed in the name. */
function randomiser(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("fuzzing the parser and the renderers", () => {
  it("never emits malformed SVG for any combination of hostile strings and values", () => {
    const types: ChartSpec["type"][] = ["bar", "line", "area", "pie", "scatter"];
    for (const text of HOSTILE_STRINGS) {
      for (const type of types) {
        const candidate = spec({
          type,
          title: `T${text}`,
          subtitle: `S${text}`,
          showValues: true,
          series: [{ name: `N${text}`, data: [{ label: `A${text}`, value: 1 }, { label: `B${text}`, value: -2 }, { label: `C${text}`, value: 0 }] }],
        });
        const label = `${type} ${JSON.stringify(text)}`;
        expectWellFormedSvg(renderChart(candidate).svg, `classic ${label}`);
        expectWellFormedSvg(renderStyled(candidate, "editorial").svg, `editorial ${label}`);
        expectWellFormedSvg(renderStyled(candidate, "classic").svg, `classic-via-style ${label}`);
        // The alt text is read aloud and sent in a header; it may not carry the forbidden set either.
        expect(invalidXmlCodePoints(summary(sanitizeSpec(candidate))), `alt ${label}`).toEqual([]);
      }
    }
  });

  it("never emits NaN or Infinity for any value at the float boundaries, in either renderer", () => {
    // render-numeric.test.ts covers the classic renderer's finite extremes. This adds the values
    // that are not finite at all, and the editorial renderer, which had neither.
    for (const value of HOSTILE_VALUES) {
      for (const partner of [1, -1, 0, Number.MAX_VALUE, Number.NaN]) {
        for (const type of ["bar", "line", "area", "pie", "scatter"] as ChartSpec["type"][]) {
          const candidate = spec({ type, series: seriesOf([value, partner, -partner]) });
          const label = `${type} ${value} / ${partner}`;
          expectWellFormedSvg(renderChart(candidate).svg, `classic ${label}`);
          const styled = renderStyled(candidate, "editorial");
          expectWellFormedSvg(styled.svg, `editorial ${label}`);
          expect(styled.altText, `alt ${label}`).not.toMatch(/NaN|Infinity|∞/);
        }
      }
    }
  });

  it("survives randomly generated hostile specs without hanging or throwing", () => {
    const startedAt = Date.now();
    const next = randomiser(0x5eed);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)];
    const types: ChartSpec["type"][] = ["bar", "line", "area", "pie", "scatter"];

    for (let iteration = 0; iteration < 400; iteration += 1) {
      const seriesCount = 1 + Math.floor(next() * 12);
      const candidate = spec({
        type: pick(types),
        title: `${pick(HOSTILE_STRINGS)}${pick(HOSTILE_STRINGS)}`.slice(0, 120),
        subtitle: pick(HOSTILE_STRINGS).slice(0, 180),
        width: 320 + Math.floor(next() * 2081),
        height: 240 + Math.floor(next() * 1361),
        theme: next() < 0.5 ? "light" : "dark",
        showLegend: next() < 0.5,
        showValues: next() < 0.5,
        series: Array.from({ length: seriesCount }, (_, seriesIndex) => ({
          name: `${seriesIndex}${pick(HOSTILE_STRINGS)}`.slice(0, 80),
          data: Array.from({ length: 1 + Math.floor(next() * 40) }, (__, pointIndex) => ({
            label: `${pointIndex}${pick(HOSTILE_STRINGS)}`.slice(0, 80),
            value: pick(HOSTILE_VALUES),
          })),
        })),
      });
      const label = `seed 0x5eed iteration ${iteration}`;
      expectWellFormedSvg(renderChart(candidate).svg, `classic ${label}`);
      expectWellFormedSvg(renderStyled(candidate, "editorial").svg, `editorial ${label}`);
    }

    // "Never hang" is an assertion, not a hope: 400 iterations over two renderers, bounded.
    expect(Date.now() - startedAt).toBeLessThan(8_000);
  });

  it("rasterises the hostile output, because a parser stricter than ours is the real judge", async () => {
    // Our own string checks could agree with a bug. libvips parses the SVG for real and throws on a
    // document it cannot read, which is what an `<img src>` would do in a customer's page.
    for (const text of ["\u0000", "\uD800", "]]>", "</svg><script>x</script>", "￾", '" onload="x']) {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
        const candidate = spec({ width: 480, height: 320, title: `T${text}`, series: seriesOf([value, 1, -1], [`A${text}`, "B", "C"]) });
        for (const svg of [renderChart(candidate).svg, renderStyled(candidate, "editorial").svg]) {
          const png = await sharp(Buffer.from(svg)).png().toBuffer();
          expect(png.subarray(0, 8), `${JSON.stringify(text)} / ${value}`).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        }
      }
    }
  }, 30_000);

  it("describes a spec with non-finite values instead of crashing on it", () => {
    // `summary` is exported and documented as the one description every renderer shares, and
    // render.ts says specs reach the renderer without having passed the schema (stored specs, the
    // playground, the marketing pages). Called directly with a NaN among the values it used to
    // throw: Math.max(...values) is NaN, values.indexOf(NaN) is -1, values[-1] is undefined, and
    // that reaches `fixed(undefined, 2)` as "Cannot read properties of undefined (reading
    // 'toFixed')". Tested on `summary` itself rather than through renderStyled, because
    // `sanitizeSpec` would otherwise be the thing under test and this clamp would be untested.
    for (const values of [[Number.NaN, 1], [Number.NaN, Number.NaN], [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY], [Number.MAX_VALUE, -Number.MAX_VALUE]]) {
      for (const type of ["bar", "line", "area", "pie", "scatter"] as ChartSpec["type"][]) {
        const candidate = spec({ type, series: seriesOf(values) });
        const label = `${type} ${values.join("/")}`;
        let described = "";
        expect(() => {
          described = summary(candidate);
        }, label).not.toThrow();
        expect(described, label).not.toMatch(/NaN|Infinity|∞|undefined/);
        expect(described.length, label).toBeGreaterThan(0);
      }
    }
  });

  it("draws a schema-valid 9-to-12-series chart instead of throwing a RangeError", () => {
    // Found by the fuzz loop above. chartSpecSchema accepts 12 series; the editorial palette is a
    // fixed order of 8 and throws rather than repeat a hue, so a 9-series bar or line chart with
    // the default style was a caller-triggerable 500. It now falls back to classic and says so.
    for (const count of [9, 10, 12]) {
      for (const type of ["bar", "line"] as const) {
        const candidate = spec({ type, series: Array.from({ length: count }, (_, index) => ({ name: `S${index}`, data: [{ label: "A", value: index + 1 }, { label: "B", value: index + 2 }] })) });
        expect(chartSpecSchema.safeParse(candidate).success, `${type} ${count}`).toBe(true);
        const result = renderStyled(candidate, "editorial");
        expectWellFormedSvg(result.svg, `${type} ${count} series`);
        expect(result.style, `${type} ${count}`).toBe("classic");
        // Announced, not silent: a substitution the caller cannot see is the one that bites later.
        expect(result.styleNote, `${type} ${count}`).toMatch(/8 series/);
      }
    }
    // Eight still gets the editorial renderer, so the fallback did not swallow the whole feature.
    const eight = spec({ type: "line", series: Array.from({ length: 8 }, (_, index) => ({ name: `S${index}`, data: [{ label: "A", value: index + 1 }, { label: "B", value: index + 2 }] })) });
    expect(renderStyled(eight, "editorial").style).toBe("editorial");
  });

  it("leaves a clean spec byte-identical, so hardening did not quietly redraw every chart", () => {
    // The sanitiser returns the same object when nothing needs changing. Without that, every
    // golden image in reports/golden/ would have moved and nobody would know which change did it.
    expect(sanitizeSpec(sampleSpec)).toBe(sampleSpec);
    expect(renderStyled(sampleSpec, "classic").svg).toBe(renderChart(sampleSpec).svg);
  });
});
