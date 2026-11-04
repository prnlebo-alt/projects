import type { BrowserNavigateRequest, BrowserResult } from "@mi/schemas";
import type { BrowserAdapter } from "./types.js";

export interface BrowserFixtureEntry {
  url: string;
  visibleText: string;
  screenshotLocation?: string | null;
}

/** Deterministic fixture-backed BrowserAdapter — no real browser launched. */
export class FixtureBrowserAdapter implements BrowserAdapter {
  readonly providerName = "fixture";
  private readonly index: Map<string, BrowserFixtureEntry>;

  constructor(entries: BrowserFixtureEntry[]) {
    this.index = new Map(entries.map((e) => [e.url, e]));
  }

  async navigate(request: BrowserNavigateRequest): Promise<BrowserResult> {
    const entry = this.index.get(request.url);
    const fetchedAt = new Date().toISOString();
    if (!entry) {
      return {
        url: request.url,
        status: "error",
        visibleText: null,
        screenshotLocation: null,
        fetchedAt
      };
    }
    return {
      url: request.url,
      status: "ok",
      visibleText: entry.visibleText,
      screenshotLocation: entry.screenshotLocation ?? null,
      fetchedAt
    };
  }

  async close(): Promise<void> {
    // no-op: no real browser process to tear down.
  }
}
