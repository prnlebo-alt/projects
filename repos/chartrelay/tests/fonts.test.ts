import { describe, expect, it } from "vitest";
import { ALL_STACKS, FONT_PACKAGES, GUARANTEED_FAMILIES, MONO, packageFor, SANS } from "@/lib/charts/fonts";
import { columns, light } from "@/lib/charts/editorial";
import { renderChart } from "@/lib/charts/render";
import { watermark } from "@/lib/charts/watermark";
import { sampleSpec } from "@/lib/charts/schema";

/**
 * The bug this file exists for: the runtime image had no fonts, so every font-family resolved to
 * nothing and every PNG the product served came back as tofu boxes at the correct dimensions. A test
 * that asserts "200, image/png, non-zero bytes" passes happily through that, which is how it survived.
 */
const familiesIn = (svg: string): string[] =>
  [...svg.matchAll(/font-family="([^"]+)"/g)].map((match) => match[1]);

const namesGuaranteed = (stack: string): boolean =>
  GUARANTEED_FAMILIES.some((family) => stack.includes(family));

describe("font stacks the runtime can actually resolve", () => {
  it("names a family the image installs, not just a generic that resolves to nothing", () => {
    for (const stack of ALL_STACKS) {
      expect(namesGuaranteed(stack), `${stack} names no installed family`).toBe(true);
    }
  });

  it("holds the Dockerfile to the same promise", async () => {
    const { readFile } = await import("node:fs/promises");
    // Shell line continuations are joined first: the package list is long enough to wrap, and a regex
    // that stops at the newline would report an installed package as missing.
    const dockerfile = (await readFile("Dockerfile", "utf8")).replace(/\\\n\s*/g, " ");
    // The mapping in fonts.ts is the source of truth: every package it names has to be installed in the
    // same commit that starts promising a family from it.
    for (const [pkg, families] of Object.entries(FONT_PACKAGES)) {
      expect(dockerfile, `${families.join(", ")} promised but ${pkg} is not installed`).toMatch(new RegExp(`apk add[^\n]*\\b${pkg}\\b`));
    }
  });

  it("can name the package behind every family a stack relies on", () => {
    for (const family of GUARANTEED_FAMILIES) {
      expect(packageFor(family), `${family} is guaranteed by nothing`).toBeDefined();
    }
  });

  it("covers the scripts a non-English customer will actually use", () => {
    // Cyrillic and Greek were already covered by DejaVu; CJK, Korean, Arabic and emoji were not, and
    // rendered as last-resort glyph boxes in a chart that still returned 200.
    for (const family of ["Noto Sans CJK SC", "Noto Sans Arabic", "Noto Color Emoji"]) {
      expect(GUARANTEED_FAMILIES).toContain(family);
      expect(SANS).toContain(family);
    }
  });

  it("puts a resolvable stack on every piece of text every renderer draws", () => {
    const data = [{ label: "a", value: 1 }, { label: "b", value: 2 }];
    const svgs = [
      renderChart(sampleSpec).svg,
      columns({ t: light, title: "T", source: "s", data }),
      watermark(renderChart(sampleSpec).svg),
    ];
    for (const svg of svgs) {
      const families = familiesIn(svg);
      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        expect(namesGuaranteed(family), `"${family}" would render as tofu in the container`).toBe(true);
      }
    }
  });

  it("keeps the two registers distinct, so the machine's trail never wears the data's face", () => {
    expect(SANS).not.toBe(MONO);
    expect(MONO).toMatch(/Mono/);
  });
});
