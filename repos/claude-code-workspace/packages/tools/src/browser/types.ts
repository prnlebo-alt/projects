import type { BrowserNavigateRequest, BrowserResult } from "@mi/schemas";

/**
 * ARCHITECTURE.md §11 — Browser adapter for JS-rendered pages. Real
 * implementation uses Playwright locally, per Engineering Defaults.
 */
export interface BrowserAdapter {
  readonly providerName: string;
  navigate(request: BrowserNavigateRequest): Promise<BrowserResult>;
  close(): Promise<void>;
}
