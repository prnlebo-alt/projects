import { describe, expect, it } from "vitest";
import { inferSpec, isTimeLike, parseHumanNumber, type InferResult, type InferSuccess } from "@/lib/charts/infer";
import { analyzeChart, blockingIssues } from "@/lib/charts/qa";
import { chartSpecSchema } from "@/lib/charts/schema";

/**
 * Every success must survive the schema untouched and carry no blocking QA finding: a user who pasted
 * a spreadsheet should never be handed a spec that POST /api/v1/charts would then refuse.
 */
const accept = (result: InferResult): InferSuccess => {
  if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
  expect(() => chartSpecSchema.parse(result.spec)).not.toThrow();
  expect(blockingIssues(analyzeChart(result.spec))).toEqual([]);
  return result;
};

const reject = (result: InferResult): string => {
  if (result.ok) throw new Error(`expected failure, got a ${result.spec.type} chart`);
  return result.error;
};

const values = (result: InferSuccess, series = 0) => result.spec.series[series].data.map((point) => point.value);
const labels = (result: InferSuccess) => result.spec.series[0].data.map((point) => point.label);

// --- Verbatim pastes from the three tools people actually use ------------------------------------

/** Excel puts tabs on the clipboard, and a currency column arrives formatted. */
const EXCEL_TAB_PASTE = "Month\tRevenue\nJan\t$12,400.00\nFeb\t$15,320.50\nMar\t$18,900.00\nApr\t$21,450.75\nMay\t$24,010.00\nJun\t$29,880.25";

/** Google Sheets copies as comma-separated text with CRLF line endings. */
const SHEETS_PERCENT_PASTE = "Channel,Share of signups\r\nOrganic,42%\r\nPaid,28%\r\nReferral,18%\r\nEmail,12%\r\n";

/** A quick two-column paste with no header at all. */
const HEADERLESS_PASTE = "Widgets\t1240\nGadgets\t880\nGizmos\t455";

const RAGGED_PASTE = "Region\tQ1\tQ2\nNorth\t120\t140\nSouth\t90\nEast\t70\t85";

/** Accounting exports write losses in brackets, and Sheets quotes any field holding the delimiter. */
const PARENTHESES_PASTE = 'Quarter,Net income\nQ1,"(1,234)"\nQ2,"2,410"\nQ3,"3,980"';

const THREE_SERIES_PASTE = [
  "Month\tNew\tExpansion\tChurn",
  "Jan\t12,400\t3,100\t(1,200)",
  "Feb\t15,320\t3,600\t(1,450)",
  "Mar\t18,900\t4,200\t(980)",
  "Apr\t21,450\t5,050\t(1,730)",
].join("\n");

describe("number parsing", () => {
  it("reads numbers the way people type them", () => {
    expect(parseHumanNumber("1,234")?.value).toBe(1234);
    expect(parseHumanNumber("$1,234.56")?.value).toBe(1234.56);
    expect(parseHumanNumber("45%")?.value).toBe(45);
    expect(parseHumanNumber("(1,234)")?.value).toBe(-1234);
    expect(parseHumanNumber("  87  ")?.value).toBe(87);
    expect(parseHumanNumber("1.2K")?.value).toBe(1200);
    expect(parseHumanNumber("3.5m")?.value).toBe(3_500_000);
    expect(parseHumanNumber("−5")?.value).toBe(-5);
    expect(parseHumanNumber("-$2,000")?.value).toBe(-2000);
    expect(parseHumanNumber("0")?.value).toBe(0);
    expect(parseHumanNumber(".5")?.value).toBe(0.5);
  });

  it("refuses text rather than calling it zero", () => {
    for (const cell of ["", "   ", "n/a", "N/A", "-", "–", "TBD", "12 units", "1..2", "%"]) {
      expect(parseHumanNumber(cell), cell).toBeNull();
    }
  });

  it("recognises the label shapes that mean time", () => {
    for (const label of ["Jan", "January", "Jan 2024", "Q1", "Q3 2024", "2024-06", "2024-06-30", "2019", "W1", "Week 12", "Mon", "3/14/2024"]) {
      expect(isTimeLike(label), label).toBe(true);
    }
    for (const label of ["North", "Widgets", "Acme Corp", "", "Sales team"]) {
      expect(isTimeLike(label), label).toBe(false);
    }
  });
});

describe("delimiters and layout", () => {
  it("reads an Excel tab paste with a header and a currency column", () => {
    const result = accept(inferSpec(EXCEL_TAB_PASTE));
    expect(result.spec.series).toHaveLength(1);
    expect(result.spec.series[0].name).toBe("Revenue");
    expect(labels(result)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    expect(values(result)).toEqual([12400, 15320.5, 18900, 21450.75, 24010, 29880.25]);
    expect(result.spec.title).toBe("Revenue by Month");
    expect(result.warnings).toContain("Columns were split on tabs.");
  });

  it("reads a Google Sheets comma paste with percentages and CRLF endings", () => {
    const result = accept(inferSpec(SHEETS_PERCENT_PASTE));
    expect(labels(result)).toEqual(["Organic", "Paid", "Referral", "Email"]);
    expect(values(result)).toEqual([42, 28, 18, 12]);
    expect(result.warnings).toContain('Percent signs were removed: "45%" was read as 45.');
    expect(result.warnings).toContain("Columns were split on commas.");
  });

  it("detects a header row, or the absence of one, from the first row's cells", () => {
    const headed = accept(inferSpec(EXCEL_TAB_PASTE));
    expect(headed.spec.series[0].data).toHaveLength(6);

    const bare = accept(inferSpec(HEADERLESS_PASTE));
    expect(labels(bare)).toEqual(["Widgets", "Gadgets", "Gizmos"]);
    expect(values(bare)).toEqual([1240, 880, 455]);
    // With no header there is nothing to name the series or the chart after.
    expect(bare.spec.series[0].name).toBe("Values");
    expect(bare.spec.title).toBe("Untitled chart");
    expect(bare.warnings.some((note) => note.includes("no title"))).toBe(true);
  });

  it("handles semicolon and pipe pastes", () => {
    const semicolons = accept(inferSpec("Region;Sales\nNorth;120\nSouth;95\nEast;140"));
    expect(values(semicolons)).toEqual([120, 95, 140]);
    expect(semicolons.warnings).toContain("Columns were split on semicolons.");

    const pipes = accept(inferSpec("Region|Sales\nNorth|120\nSouth|95\nEast|140"));
    expect(values(pipes)).toEqual([120, 95, 140]);
    expect(pipes.warnings).toContain("Columns were split on pipes.");
  });

  it("keeps a quoted field that contains the delimiter in one piece", () => {
    const result = accept(inferSpec('Company,Revenue\n"Acme, Inc.",1200\n"Globex, Ltd.",980\n"Initech",760'));
    expect(labels(result)).toEqual(["Acme, Inc.", "Globex, Ltd.", "Initech"]);
    expect(values(result)).toEqual([1200, 980, 760]);
  });

  it("reads a negative written in brackets inside a quoted field", () => {
    const result = accept(inferSpec(PARENTHESES_PASTE));
    expect(values(result)).toEqual([-1234, 2410, 3980]);
    expect(result.warnings).toContain('Values in brackets were read as negative: "(1,234)" was read as -1234.');
  });

  it("turns three numeric columns into three named series", () => {
    const result = accept(inferSpec(THREE_SERIES_PASTE));
    expect(result.spec.series.map((series) => series.name)).toEqual(["New", "Expansion", "Churn"]);
    expect(values(result, 0)).toEqual([12400, 15320, 18900, 21450]);
    expect(values(result, 2)).toEqual([-1200, -1450, -980, -1730]);
    expect(result.spec.showLegend).toBe(true);
    expect(result.reason).toContain("3 series");
    expect(result.spec.title).toBe("New, Expansion, Churn by Month");
  });

  it("ignores a column that is text in every row", () => {
    const result = accept(inferSpec("Region\tOwner\tSales\nNorth\tAmy\t120\nSouth\tBen\t95\nEast\tCara\t140"));
    expect(result.spec.series).toHaveLength(1);
    expect(result.spec.series[0].name).toBe("Sales");
    expect(result.warnings).toContain('The column "Owner" holds text, so it was left out.');
  });
});

describe("refusals", () => {
  it("names the cell it could not read instead of charting a zero", () => {
    const error = reject(inferSpec("Month\tRevenue\nJan\t120\nFeb\tn/a\nMar\t140"));
    expect(error).toContain("row 3");
    expect(error).toContain('"n/a"');
    expect(error).toContain('column "Revenue"');
  });

  it("points at a ragged row by its number", () => {
    const error = reject(inferSpec(RAGGED_PASTE));
    expect(error).toContain("Row 3");
    expect(error).toContain("2 values");
  });

  it("refuses a paste with no numbers in it", () => {
    expect(reject(inferSpec("Region\tOwner\nNorth\tAmy\nSouth\tBen"))).toMatch(/no column of numbers/i);
  });

  it("refuses fewer than two rows, and more than the hundred a series holds", () => {
    expect(reject(inferSpec("Month\tRevenue\nJan\t120"))).toMatch(/at least 2 rows/i);
    const long = ["Day\tVisits", ...Array.from({ length: 101 }, (_, index) => `D${index}\t${index}`)].join("\n");
    expect(reject(inferSpec(long))).toMatch(/101 rows/);
    const atLimit = ["Day\tVisits", ...Array.from({ length: 100 }, (_, index) => `D${index}\t${index}`)].join("\n");
    expect(accept(inferSpec(atLimit)).spec.series[0].data).toHaveLength(100);
  });

  it("refuses more numeric columns than the schema has series", () => {
    const header = ["Region", ...Array.from({ length: 13 }, (_, index) => `M${index}`)].join("\t");
    const row = (name: string) => [name, ...Array.from({ length: 13 }, (_, index) => String(index + 1))].join("\t");
    expect(reject(inferSpec([header, row("North"), row("South")].join("\n")))).toMatch(/at most 12/);
  });

  it("refuses an empty paste and a single-column paste", () => {
    expect(reject(inferSpec("   \n\n"))).toMatch(/nothing was pasted/i);
    expect(reject(inferSpec("120\n140\n160"))).toMatch(/only one value/i);
  });

  it("refuses a row with no label", () => {
    expect(reject(inferSpec("Month\tRevenue\nJan\t120\n\t140\nMar\t160"))).toMatch(/row 3 has no name/i);
  });
});

describe("form selection", () => {
  it("draws time-like labels with four or more rows as a line", () => {
    const months = accept(inferSpec(EXCEL_TAB_PASTE));
    expect(months.spec.type).toBe("line");
    expect(months.reason).toContain("looks like time");
    expect(months.reason).toContain("line chart");

    expect(accept(inferSpec("Week\tSignups\nW1\t40\nW2\t55\nW3\t61\nW4\t72\nW5\t80")).spec.type).toBe("line");
    expect(accept(inferSpec("Quarter\tRevenue\nQ1 2024\t120\nQ2 2024\t140\nQ3 2024\t155\nQ4 2024\t180")).spec.type).toBe("line");
    expect(accept(inferSpec("Date\tVisits\n2024-01-01\t120\n2024-02-01\t140\n2024-03-01\t155\n2024-04-01\t180")).spec.type).toBe("line");
    expect(accept(inferSpec("2019\t120\n2020\t140\n2021\t155\n2022\t180")).spec.type).toBe("line");
  });

  it("keeps a short run of time labels as bars, because three points are not a trend", () => {
    expect(accept(inferSpec("Month\tRevenue\nJan\t120\nFeb\t140\nMar\t155")).spec.type).toBe("bar");
  });

  it("draws two time-like columns per row as bars and says a slope chart would be better", () => {
    const result = accept(inferSpec("Region\t2019\t2024\nNorth\t120\t180\nSouth\t95\t140\nEast\t140\t130"));
    expect(result.spec.type).toBe("bar");
    // The year headers must be read as headers, not as the first row of data.
    expect(labels(result)).toEqual(["North", "South", "East"]);
    expect(result.spec.series.map((series) => series.name)).toEqual(["2019", "2024"]);
    expect(result.reason).toContain("two points in time");
    expect(result.warnings.some((note) => note.includes("slope chart"))).toBe(true);
  });

  it("draws a small set of categories as a bar chart", () => {
    const result = accept(inferSpec(HEADERLESS_PASTE));
    expect(result.spec.type).toBe("bar");
    expect(result.reason).toContain("category names");
    expect(result.spec.showLegend).toBe(false);
    expect(result.warnings.some((note) => note.includes("largest to smallest"))).toBe(false);
  });

  it("flags that a long list of categories would read better ranked", () => {
    const rows = Array.from({ length: 10 }, (_, index) => `Category ${index}\t${100 - index * 7}`).join("\n");
    const result = accept(inferSpec(`Product\tUnits\n${rows}`));
    expect(result.spec.type).toBe("bar");
    expect(result.warnings.some((note) => note.includes("largest to smallest"))).toBe(true);
  });

  it("draws parts of a whole as a pie", () => {
    const shares = accept(inferSpec(SHEETS_PERCENT_PASTE));
    expect(shares.spec.type).toBe("pie");
    expect(shares.reason).toMatch(/pie chart/);

    // Sums to 100 with no percent sign and no share wording in the header.
    const counted = accept(inferSpec("Segment\tCustomers\nSmall\t55\nMedium\t30\nLarge\t15"));
    expect(counted.spec.type).toBe("pie");

    // Within 1% of 100 still counts as a whole.
    expect(accept(inferSpec("Segment\tCustomers\nSmall\t55.4\nMedium\t30\nLarge\t15")).spec.type).toBe("pie");
    // Further out does not.
    expect(accept(inferSpec("Segment\tCustomers\nSmall\t60\nMedium\t30\nLarge\t15")).spec.type).toBe("bar");
  });

  it("never hands back a pie the QA layer would refuse", () => {
    // Negative slice.
    const negative = accept(inferSpec("Segment\tShare\nSmall\t60\nMedium\t50\nLarge\t-10"));
    expect(negative.spec.type).toBe("bar");

    // Seven slices: over the six the QA layer tolerates.
    const rows = Array.from({ length: 7 }, (_, index) => `Part ${index}\t${index === 0 ? 40 : 10}`).join("\n");
    expect(accept(inferSpec(`Segment\tShare\n${rows}`)).spec.type).toBe("bar");

    // More than one series, even when both are labelled as shares.
    const multi = accept(inferSpec("Segment\tShare 2023\tShare 2024\nSmall\t55\t50\nMedium\t30\t35\nLarge\t15\t15"));
    expect(multi.spec.type).toBe("bar");
  });
});
