import type { Browser } from "playwright";
import { chromium } from "playwright";
import type { BrowserNavigateRequest, BrowserResult } from "@mi/schemas";
import type { BrowserAdapter } from "./types.js";

/**
 * Real Playwright implementation of BrowserAdapter (Engineering Defaults:
 * "Playwright browser adapter"). Not exercised by core Phase 1 tests, which
 * run entirely on deterministic fixtures per PHASE1_BUILD_DIRECTIVE.md — but
 * fully wired so a live monitoring loop can use it starting Phase 6.
 */
export class PlaywrightBrowserAdapter implements BrowserAdapter {
  readonly providerName = "playwright";
  private browserPromise: Promise<Browser> | undefined;

  private getBrowser(): Promise<Browser> {
    this.browserPromise ??= chromium.launch({ headless: true });
    return this.browserPromise;
  }

  async navigate(request: BrowserNavigateRequest): Promise<BrowserResult> {
    const fetchedAt = new Date().toISOString();
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.goto(request.url, { waitUntil: "domcontentloaded" });
        if (request.waitForSelector) {
          await page.waitForSelector(request.waitForSelector, { timeout: 10_000 });
        }
        const visibleText = await page.innerText("body").catch(() => "");
        return {
          url: request.url,
          status: "ok",
          visibleText,
          screenshotLocation: null,
          fetchedAt
        };
      } finally {
        await page.close();
      }
    } catch {
      return {
        url: request.url,
        status: "error",
        visibleText: null,
        screenshotLocation: null,
        fetchedAt
      };
    }
  }

  async close(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise;
      await browser.close();
      this.browserPromise = undefined;
    }
  }
}
