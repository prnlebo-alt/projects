import type { FetchRequest, FetchResult } from "@mi/schemas";

/**
 * ARCHITECTURE.md §11 — Fetch/extraction adapter. Candidate real provider:
 * Firecrawl or equivalent. Phase 1 ships only the fixture implementation.
 */
export interface FetchAdapter {
  readonly providerName: string;
  fetch(request: FetchRequest): Promise<FetchResult>;
}
