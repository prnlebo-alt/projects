/**
 * Deterministic text-similarity primitives. This is intentionally separate
 * from any model-proposed similarity feature (packages/models) — deterministic
 * code owns source-family clustering finalization (ARCHITECTURE.md §12), so
 * the number that actually decides family membership must never come from a
 * model call.
 */
export function jaccardShingleSimilarity(a: string, b: string, shingleSize = 5): number {
  const shinglesA = wordShingles(a, shingleSize);
  const shinglesB = wordShingles(b, shingleSize);
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) intersection += 1;
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function wordShingles(text: string, size: number): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i + size <= words.length; i += 1) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  // Short texts that don't reach one full shingle still get compared as a
  // single unit so near-duplicate short snippets aren't scored as 0.
  if (shingles.size === 0 && words.length > 0) {
    shingles.add(words.join(" "));
  }
  return shingles;
}

/**
 * Whole-document bag-of-words similarity. Unlike positional shingles, this
 * is tolerant of word insertions/reordering (the kind of light copy-editing
 * a wire service or a second outlet applies to a near-duplicate item), which
 * is what makes it usable as the §8.3 rule 3/4 similarity score — it should
 * stay high for a lightly-edited duplicate and drop sharply for a genuinely
 * independently-written report on the same event.
 */
export function wordSetJaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(significantWords(a));
  const wordsB = new Set(significantWords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection += 1;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/** Quoted spans of 8+ characters, used as one kind of shared-origin fingerprint. */
export function extractQuotedFingerprints(text: string): string[] {
  const matches = text.match(/"([^"]{8,})"/g) ?? [];
  return matches.map((m) => m.slice(1, -1).trim().toLowerCase());
}

/** Distinctive numeric fingerprints (dollar figures, percentages) of some specificity. */
export function extractNumericFingerprints(text: string): string[] {
  const matches = text.match(/\$[0-9][0-9,]*(\.[0-9]+)?\s?(million|billion|k|m|b)?/gi) ?? [];
  return matches.map((m) => m.replace(/\s+/g, "").toLowerCase()).filter((m) => m.length > 2);
}

export function sharedFingerprints(a: string, b: string): string[] {
  const quotedA = new Set(extractQuotedFingerprints(a));
  const numericA = new Set(extractNumericFingerprints(a));
  const quotedB = extractQuotedFingerprints(b);
  const numericB = extractNumericFingerprints(b);
  return [...quotedB.filter((q) => quotedA.has(q)), ...numericB.filter((n) => numericA.has(n))];
}

export function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}
