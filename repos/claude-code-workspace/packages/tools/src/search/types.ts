import type { SearchQuery, SearchResponse } from "@mi/schemas";

/**
 * ARCHITECTURE.md §11 — Search adapter. Candidate real providers: Exa,
 * Tavily, Parallel, general web search. Phase 1 ships only the fixture
 * implementation; a paid provider can be added later behind this same
 * interface without touching any caller.
 */
export interface SearchAdapter {
  readonly providerName: string;
  search(query: SearchQuery): Promise<SearchResponse>;
}
