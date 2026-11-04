import type { GroundingStatus } from "@mi/schemas";

const FUZZY_SIMILARITY_THRESHOLD = 0.6;
const FUZZY_WINDOW_SLACK_TOKENS = 6;

export interface GroundingResult {
  status: GroundingStatus;
  matchedSpan: string | null;
  similarity: number | null;
}

/**
 * EVIDENCE_DOCTRINE.md grounding gate: a model-provided excerpt is never
 * trusted by itself. Every claim's excerpt must resolve to the actual
 * stored source snapshot text:
 *   1. exact normalized-text match, else
 *   2. deterministic local fuzzy match above threshold, else
 *   3. terminal `grounding_failed`.
 *
 * Numeric tokens (prices, percentages, counts) are held to exact-match
 * regardless of overall fuzzy similarity: paraphrase tolerance must never
 * extend to the specific figure a claim asserts, or a hallucinated number
 * close in shape to the real one (e.g. "$999" vs "$1200") could slip
 * through the fuzzy path (ARCHITECTURE.md §25 adversarial test:
 * "hallucinated source excerpt").
 */
export function groundExcerpt(excerptText: string, sourceNormalizedText: string): GroundingResult {
  const normalizedExcerpt = normalize(excerptText);
  const normalizedSource = normalize(sourceNormalizedText);

  if (normalizedExcerpt.length === 0) {
    return { status: "grounding_failed", matchedSpan: null, similarity: null };
  }

  if (normalizedSource.includes(normalizedExcerpt)) {
    return { status: "grounded_exact", matchedSpan: excerptText, similarity: 1 };
  }

  if (!numericTokensAllPresent(normalizedExcerpt, normalizedSource)) {
    return { status: "grounding_failed", matchedSpan: null, similarity: 0 };
  }

  const fuzzy = bestFuzzyWindowMatch(normalizedExcerpt, normalizedSource);
  if (fuzzy.similarity >= FUZZY_SIMILARITY_THRESHOLD) {
    return { status: "grounded_fuzzy", matchedSpan: fuzzy.window, similarity: fuzzy.similarity };
  }

  return { status: "grounding_failed", matchedSpan: null, similarity: fuzzy.similarity };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function tokenize(text: string): string[] {
  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function numericTokensAllPresent(normalizedExcerpt: string, normalizedSource: string): boolean {
  const numericTokens = tokenize(normalizedExcerpt).filter((t) => /\d/.test(t));
  return numericTokens.every((t) => normalizedSource.includes(t));
}

/**
 * Slides a window across the source text and returns the window with the
 * lowest token-level Levenshtein distance (normalized to a 0-1 similarity)
 * against the excerpt. Deterministic, local, no model call.
 */
function bestFuzzyWindowMatch(
  normalizedExcerpt: string,
  normalizedSource: string
): { window: string | null; similarity: number } {
  const excerptTokens = tokenize(normalizedExcerpt);
  const sourceTokens = tokenize(normalizedSource);
  if (excerptTokens.length === 0 || sourceTokens.length === 0) {
    return { window: null, similarity: 0 };
  }

  const minSize = Math.max(1, excerptTokens.length - 3);
  const maxSize = excerptTokens.length + FUZZY_WINDOW_SLACK_TOKENS;
  let best = { window: null as string | null, similarity: 0 };

  for (let start = 0; start < sourceTokens.length; start += 1) {
    for (let size = minSize; size <= maxSize; size += 1) {
      const windowTokens = sourceTokens.slice(start, start + size);
      if (windowTokens.length === 0) continue;
      const similarity = tokenLevenshteinSimilarity(excerptTokens, windowTokens);
      if (similarity > best.similarity) {
        best = { window: windowTokens.join(" "), similarity };
      }
    }
  }

  return best;
}

function tokenLevenshteinSimilarity(a: string[], b: string[]): number {
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function levenshtein(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }
  return dp[a.length]![b.length]!;
}
