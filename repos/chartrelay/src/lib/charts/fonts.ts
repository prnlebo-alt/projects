/**
 * The font stacks every renderer draws with.
 *
 * This exists because of a bug that reached production and stayed there: the container is
 * node:22-alpine, which ships with no fonts at all, so librsvg resolved every family in the stack to
 * nothing and rasterised each glyph as .notdef — a tofu box. The SVG was correct, the PNG was correct
 * in dimensions and byte count, and every chart the product had ever served as a PNG was unreadable.
 * Checking that a render "returned a 200 and a real PNG" cannot catch this; only looking at the image,
 * or asserting the stack itself, can.
 *
 * Two halves to the fix. The image installs the packages named below (see the Dockerfile), and every
 * stack here names a family from one of them explicitly. Naming them matters more than it looks: a
 * stack that ends in the generic `sans-serif` still resolves to nothing when nothing is installed, and
 * adding the fonts without naming them would leave the product one base-image change away from the
 * same failure.
 *
 * Liberation Sans is metric-compatible with Arial, so it substitutes for the Helvetica the design was
 * drawn against without moving any of the label positions this renderer computes by hand.
 *
 * Liberation and DejaVu between them cover Latin, Cyrillic and Greek and nothing else, which made every
 * CJK, Korean, Arabic or emoji character a tofu box — a chart that returned 200 and could not be read.
 * The Noto packages cover the rest. They are named last so that nothing about a Latin chart changes:
 * fontconfig falls through to them per character, only for the characters the earlier families lack.
 */

/**
 * Which font package provides which families, and the single source of truth for both halves.
 *
 * Adding a family here is a promise the Dockerfile has to keep. The fonts test reads this mapping and
 * fails if a stack names a family whose package the image does not install, so the two files cannot
 * drift apart the way they did when this renderer had no fonts at all.
 */
export const FONT_PACKAGES = {
  "font-liberation": ["Liberation Sans", "Liberation Mono"],
  "font-dejavu": ["DejaVu Sans", "DejaVu Sans Mono"],
  "font-noto-cjk": ["Noto Sans CJK SC", "Noto Sans Mono CJK SC"],
  "font-noto-arabic": ["Noto Sans Arabic"],
  "font-noto-devanagari": ["Noto Sans Devanagari"],
  "font-noto-bengali": ["Noto Sans Bengali"],
  "font-noto-tamil": ["Noto Sans Tamil"],
  "font-noto-thai": ["Noto Sans Thai"],
  "font-noto-ethiopic": ["Noto Sans Ethiopic"],
  "font-noto-emoji": ["Noto Color Emoji"],
} as const;

/**
 * The scripts whose coverage is asserted rather than assumed.
 *
 * Installing the first three Noto packages fixed the scripts that were checked and left five more
 * rendering as hex boxes — at HTTP 200, so the failure was silent where it had at least been loud
 * before. A list of families proves only the families someone thought to list, which is why this names
 * sample text per script and a test renders each one.
 */
export const SCRIPT_SAMPLES = [
  { script: "Japanese", sample: "売上高" },
  { script: "Korean", sample: "한국어" },
  { script: "Chinese", sample: "年度报告" },
  { script: "Arabic", sample: "العربية" },
  { script: "Hebrew", sample: "עברית" },
  { script: "Cyrillic", sample: "Привет" },
  { script: "Greek", sample: "Ελλάδα" },
  { script: "Devanagari", sample: "हिन्दी" },
  { script: "Bengali", sample: "বাংলা" },
  { script: "Tamil", sample: "தமிழ்" },
  { script: "Thai", sample: "ภาษาไทย" },
  { script: "Ethiopic", sample: "አማርኛ" },
] as const;

/** Families the runtime image is guaranteed to provide, flattened from the package mapping. */
export const GUARANTEED_FAMILIES = Object.values(FONT_PACKAGES).flat();

/** The package that provides a family, or undefined when nothing here promises it. */
export const packageFor = (family: string): string | undefined =>
  Object.entries(FONT_PACKAGES).find(([, families]) => (families as readonly string[]).includes(family))?.[0];

/** Proportional text: titles, labels, values. */
export const SANS = "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'DejaVu Sans', 'Noto Sans CJK SC', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Tamil', 'Noto Sans Thai', 'Noto Sans Ethiopic', 'Noto Color Emoji', sans-serif";

/** The machine's register: provenance, checks, annotations, the free-tier mark. */
export const MONO = "'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', 'Noto Sans Mono CJK SC', 'Noto Color Emoji', monospace";

/** Every stack this product renders with, for the test that holds them to the guarantee. */
export const ALL_STACKS = [SANS, MONO] as const;
