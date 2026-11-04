import { describe, expect, it } from "vitest";
import { MAX_QUERY_BYTES, parseChartQuery, toChartQuery } from "@/lib/charts/url";
import { renderStyled } from "@/lib/charts/style";
import { watermark, WATERMARK_TEXT } from "@/lib/charts/watermark";

const parse = (query: string) => parseChartQuery(new URLSearchParams(query));
const ok = (query: string) => {
  const result = parse(query);
  if (!result.ok) throw new Error(`expected a chart, got: ${result.error}`);
  return result.value;
};
const err = (query: string) => {
  const result = parse(query);
  if (result.ok) throw new Error("expected a refusal");
  return result.error;
};

describe("the querystring form of a chart", () => {
  it("draws a single series from the shortest URL that can mean anything", () => {
    const { spec, format, style } = ok("data=1,2,3");
    expect(spec.type).toBe("bar");
    expect(spec.series).toHaveLength(1);
    expect(spec.series[0].data.map((d) => d.value)).toEqual([1, 2, 3]);
    // Unlabelled points still get an identity rather than an empty axis.
    expect(spec.series[0].data.map((d) => d.label)).toEqual(["1", "2", "3"]);
    expect(format).toBe("png");
    expect(style).toBe("editorial");
  });

  it("splits several series on a pipe and names them", () => {
    const { spec } = ok("type=line&data=1,2|3,4&names=North,South&labels=Q1,Q2");
    expect(spec.series.map((s) => s.name)).toEqual(["North", "South"]);
    expect(spec.series[1].data.map((d) => d.value)).toEqual([3, 4]);
  });

  it("accepts decimals, negatives and the Unicode minus a spreadsheet emits", () => {
    const { spec } = ok("data=1.5,-5,%E2%88%926");
    expect(spec.series[0].data.map((d) => d.value)).toEqual([1.5, -5, -6]);
  });

  it("does not pretend a thousands separator can work, because the comma is the separator", () => {
    // "1,234" is two values here, and it must stay two rather than quietly becoming 1234 — the split
    // happens before any number is read, so there is no honest way to support both meanings.
    const { spec } = ok("data=1%2C234");
    expect(spec.series[0].data.map((d) => d.value)).toEqual([1, 234]);
  });

  it("refuses a value it cannot read rather than drawing it as zero", () => {
    expect(err("data=1,TBD,3")).toMatch(/"TBD" at position 2 is not a number/);
    expect(err("type=line&data=1,2|3,x")).toMatch(/in series 2/);
  });

  it("refuses shapes that would draw a misleading chart", () => {
    expect(err("data=")).toMatch(/data is required/);
    expect(err("data=1,2&labels=a")).toMatch(/labels has 1 entries but data has 2/);
    expect(err("data=1,2|3,4&names=only-one")).toMatch(/names has 1 entries but data has 2 series/);
    expect(err("data=1,2|3")).toMatch(/same number of values/);
  });

  it("passes the schema's own rules through instead of restating them", () => {
    expect(err("type=flying&data=1,2")).toMatch(/type/);
    expect(err("data=1,2&w=10")).toMatch(/width/);
  });

  it("reads chrome the ChartSpec has no field for", () => {
    const { chrome } = ok("data=1,2,3&source=Source%3A%20ledger&prefix=%24&focus=0&note=here&noteAt=1");
    expect(chrome).toMatchObject({ source: "Source: ledger", prefix: "$", focus: 0, note: { index: 1, text: "here" } });
  });

  it("insists a note says which point it points at", () => {
    expect(err("data=1,2,3&note=something")).toMatch(/noteAt/);
  });

  it("refuses a chrome index that points past the end of the chart", () => {
    // Unbounded, these reached into the renderer and came back as "Cannot read properties of undefined
    // (reading 'value')" drawn on the refusal card — beside carefully worded checks for labels and names.
    expect(err("data=1,2,3&note=late&noteAt=9")).toMatch(/noteAt is 9 but the chart has 3 points, numbered 0 to 2/);
    expect(err("data=1,2,3&focus=7")).toMatch(/focus is 7 but the chart has 3 points/);
    expect(ok("data=1,2,3&focus=2&note=ok&noteAt=0").chrome.focus).toBe(2);
  });

  it("bounds the chrome against a spec handed in whole, not just the readable form", () => {
    const encoded = Buffer.from(JSON.stringify({ type: "line", title: "T", series: [{ name: "S", data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] }] })).toString("base64url");
    expect(err(`spec=${encoded}&note=late&noteAt=5`)).toMatch(/noteAt is 5 but the chart has 2 points/);
  });

  it("carries a whole spec as base64url when the readable form cannot say it", () => {
    const spec = { type: "pie", title: "Share", series: [{ name: "S", data: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }] };
    const encoded = Buffer.from(JSON.stringify(spec)).toString("base64url");
    const { spec: parsed } = ok(`spec=${encoded}`);
    expect(parsed.type).toBe("pie");
    expect(parsed.title).toBe("Share");
  });

  it("refuses a spec parameter that is not base64url JSON", () => {
    expect(err("spec=not-base64-json")).toMatch(/base64url-encoded JSON|not a valid chart/);
  });

  it("refuses a query too long to survive a mail client", () => {
    expect(err(`data=1,2&title=${"x".repeat(MAX_QUERY_BYTES)}`)).toMatch(/longer than/);
  });

  it("validates format and style rather than falling back silently", () => {
    expect(err("data=1&format=webp")).toMatch(/format must be/);
    expect(err("data=1&style=fancy")).toMatch(/style must be/);
    expect(ok("data=1&format=svg").format).toBe("svg");
    expect(ok("data=1&style=classic").style).toBe("classic");
  });
});

describe("choosing a renderer", () => {
  const bar = ok("data=10,20,30&labels=a,b,c&title=Revenue").spec;

  it("draws bar and line in the editorial style by default", () => {
    const result = renderStyled(bar, "editorial");
    expect(result.style).toBe("editorial");
    expect(result.styleNote).toBeUndefined();
    expect(result.svg).toContain("<svg");
    expect(result.svg).not.toContain("NaN");
  });

  it("falls back loudly for a form the editorial renderer cannot draw", () => {
    const pie = ok(`spec=${Buffer.from(JSON.stringify({ type: "pie", title: "Share", series: [{ name: "S", data: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }] })).toString("base64url")}`).spec;
    const result = renderStyled(pie, "editorial");
    expect(result.style).toBe("classic");
    expect(result.styleNote).toMatch(/does not draw a pie chart yet/);
  });

  it("describes a chart the same way whichever renderer drew it", () => {
    // The picture may change with the style; the facts stated about it must not.
    expect(renderStyled(bar, "editorial").altText).toBe(renderStyled(bar, "classic").altText);
  });

  it("announces a field it silently dropped, not only a form it substituted", () => {
    // style.ts refuses unannounced substitution. Quietly ignoring a w=2000 the caller set is the same
    // class of thing as quietly drawing a different chart type.
    const wide = ok("data=1,2,3&w=2000&h=1200").spec;
    expect(renderStyled(wide, "editorial").styleNote).toMatch(/width and height had no effect/);
    const plain = ok("data=1,2,3").spec;
    expect(renderStyled(plain, "editorial").styleNote).toBeUndefined();
  });

  it("says so when several series force a different form", () => {
    const grouped = ok("data=1,2|3,4&names=A,B&labels=x,y").spec;
    expect(renderStyled(grouped, "editorial").styleNote).toMatch(/drawn as lines/);
  });
});

describe("the free-tier mark", () => {
  const svg = renderStyled(ok("data=1,2,3&title=T").spec, "editorial").svg;

  it("stamps the mark inside the drawing, above everything else", () => {
    const marked = watermark(svg);
    expect(marked).toContain(WATERMARK_TEXT);
    // Last thing drawn, so nothing paints over it.
    expect(marked.lastIndexOf(WATERMARK_TEXT)).toBeGreaterThan(marked.lastIndexOf("</text>") - marked.length - 1);
    expect(marked.indexOf(WATERMARK_TEXT)).toBeGreaterThan(marked.indexOf("<svg"));
    expect(marked.endsWith("</svg>")).toBe(true);
  });

  it("does not disturb the chart it marks", () => {
    const marked = watermark(svg);
    expect(marked).toContain(svg.slice(0, svg.lastIndexOf("</svg>")));
    expect(marked).not.toContain("NaN");
  });

  it("leaves a drawing it cannot measure alone rather than stamping it at NaN", () => {
    expect(watermark("<svg><rect/></svg>")).toBe("<svg><rect/></svg>");
    expect(watermark("not an svg")).toBe("not an svg");
  });
});

describe("what the site says about the mark", () => {
  // The mark is the paid upgrade, so a page that denies it exists is not a copy slip — it is the
  // product lying about the one thing a customer is being asked to pay for. This is the guard that
  // caught exactly that: /pricing still read "no watermark" for a while after the mark shipped.
  const pages = ["src/app/pricing/page.tsx", "src/app/page.tsx", "src/app/compare/page.tsx"];

  it("never claims charts carry no mark", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const page of pages) {
      const source = await readFile(page, "utf8");
      expect(source, `${page} denies a watermark that the renderer applies`).not.toMatch(/no watermark|without a watermark|watermark-free/i);
    }
  });

  it("names the mark on the page that sells its removal", async () => {
    const { readFile } = await import("node:fs/promises");
    const pricing = await readFile("src/app/pricing/page.tsx", "utf8");
    expect(pricing).toMatch(/chartrelay\.dev mark/);
  });
});

describe("writing a chart back out as a URL", () => {
  // The studio shows people the URL that drew what is on their screen. If these two functions ever
  // disagree, that link renders a different chart than the one they just approved — so they are tested
  // against each other rather than against a fixed string.
  const roundTrip = (query: string) => {
    const first = ok(query);
    const second = ok(toChartQuery(first.spec, { format: first.format, style: first.style, ...first.chrome }));
    return { first, second };
  };

  const cases: Array<[string, string]> = [
    ["the shortest chart", "data=1,2,3"],
    ["labels and a title", "data=10,20&labels=Jan,Feb&title=Revenue"],
    ["several named series", "type=line&data=1,2|3,4&names=North,South&labels=Q1,Q2&title=Split"],
    ["a subtitle and a theme", "data=5,6&labels=a,b&title=T&subtitle=Why%20it%20matters&theme=dark"],
    ["non-default canvas and toggles", "data=1,2&labels=a,b&title=T&w=1200&h=800&legend=0&values=1&style=classic"],
    ["chrome the spec has no field for", "data=1,2,3&labels=a,b,c&title=T&source=Ledger&prefix=%24&focus=1&note=here&noteAt=2"],
    ["svg instead of png", "data=1,2&labels=a,b&title=T&format=svg"],
    ["negatives and decimals", "data=-1.5,2,0&labels=a,b,c&title=T"],
  ];

  for (const [name, query] of cases) {
    it(`survives a round trip: ${name}`, () => {
      const { first, second } = roundTrip(query);
      expect(second.spec).toEqual(first.spec);
      expect(second.format).toBe(first.format);
      expect(second.style).toBe(first.style);
      expect(second.chrome).toEqual(first.chrome);
    });
  }

  it("leaves defaults out, so every parameter present is one the caller chose", () => {
    const query = toChartQuery(ok("data=1,2,3&title=T").spec);
    expect(query).not.toMatch(/type=|theme=|w=|h=|legend=|values=|format=|style=/);
    expect(query).toMatch(/data=1%2C2%2C3/);
  });

  it("falls back to the encoded form only when the readable one cannot say it", () => {
    const readable = toChartQuery(ok("data=1,2&labels=a,b&title=T").spec);
    expect(readable).not.toContain("spec=");

    // Series with different label sets have no readable spelling; a colour does not either.
    const ragged = { type: "line" as const, title: "T", width: 900, height: 520, theme: "light" as const, showLegend: true, showValues: false,
      series: [
        { name: "A", data: [{ label: "x", value: 1 }] },
        { name: "B", data: [{ label: "y", value: 2 }] },
      ] };
    expect(toChartQuery(ragged)).toContain("spec=");
    const tinted = ok("data=1,2&labels=a,b&title=T").spec;
    expect(toChartQuery({ ...tinted, series: [{ ...tinted.series[0], color: "#2a78d6" }] })).toContain("spec=");
  });

  it("keeps a single series' name when it is not simply the title", () => {
    const named = ok("data=1,2&labels=a,b&title=Revenue&names=MRR").spec;
    expect(named.series[0].name).toBe("MRR");
    expect(ok(toChartQuery(named)).spec.series[0].name).toBe("MRR");
  });
});
