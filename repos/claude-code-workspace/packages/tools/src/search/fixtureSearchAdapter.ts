import type { SearchQuery, SearchResponse, SearchResult } from "@mi/schemas";
import type { SearchAdapter } from "./types.js";

export interface SearchFixtureEntry {
  query: string;
  results: SearchResult[];
}

/**
 * Deterministic fixture-backed SearchAdapter. Exact-match lookup on the
 * normalized query string. An unmatched query returns zero results rather
 * than throwing — that maps to `not_found_after_search`, never
 * `confirmed_absence` (ARCHITECTURE.md §7.3), one layer up in the pipeline.
 */
export class FixtureSearchAdapter implements SearchAdapter {
  readonly providerName = "fixture";
  private readonly index: Map<string, SearchResult[]>;

  constructor(entries: SearchFixtureEntry[]) {
    this.index = new Map(entries.map((e) => [normalize(e.query), e.results]));
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const results = this.index.get(normalize(query.query)) ?? [];
    const limited = results.slice(0, query.maxResults);
    return { results: limited, deduplicated: true };
  }
}

function normalize(query: string): string {
  return query.trim().toLowerCase();
}
