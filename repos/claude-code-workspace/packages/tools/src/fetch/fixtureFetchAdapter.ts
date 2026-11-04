import { sha256Hex } from "@mi/schemas";
import type { FetchRequest, FetchResult } from "@mi/schemas";
import type { FetchAdapter } from "./types.js";

export interface FetchFixtureEntry {
  url: string;
  rawContent: string;
  /** Defaults to a whitespace-normalized copy of rawContent. */
  normalizedText?: string;
  httpStatus?: number;
}

/**
 * Deterministic fixture-backed FetchAdapter. Content hash is computed from
 * the fixture's raw content, so re-fetching the same fixture URL always
 * yields the same hash — exercising the "unchanged, skip" snapshot path.
 */
export class FixtureFetchAdapter implements FetchAdapter {
  readonly providerName = "fixture";
  private readonly index: Map<string, Required<FetchFixtureEntry>>;

  constructor(entries: FetchFixtureEntry[]) {
    this.index = new Map(
      entries.map((e) => [
        e.url,
        {
          url: e.url,
          rawContent: e.rawContent,
          normalizedText: e.normalizedText ?? normalizeWhitespace(e.rawContent),
          httpStatus: e.httpStatus ?? 200
        }
      ])
    );
  }

  async fetch(request: FetchRequest): Promise<FetchResult> {
    const entry = this.index.get(request.url);
    const fetchedAt = new Date().toISOString();
    if (!entry) {
      return {
        url: request.url,
        status: "not_found",
        httpStatus: null,
        rawContent: null,
        normalizedText: null,
        contentHash: null,
        fetchedAt
      };
    }
    return {
      url: request.url,
      status: "ok",
      httpStatus: entry.httpStatus,
      rawContent: entry.rawContent,
      normalizedText: entry.normalizedText,
      contentHash: sha256Hex(entry.rawContent),
      fetchedAt
    };
  }
}

/**
 * Collapses runs of spaces/tabs but preserves line breaks — real fetched
 * pages carry paragraph/line structure, and Phase 1's fixture extractor
 * (packages/models FakeModelAdapter) relies on that structure to atomize
 * one fact per line.
 */
function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
}
