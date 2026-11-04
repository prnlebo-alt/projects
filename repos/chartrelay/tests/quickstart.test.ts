import { describe, expect, it, vi } from "vitest";

// The card is a server component; outside a request scope `headers()` has nothing to read.
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "localhost:3000" }) }));

import { chartSpecSchema } from "@/lib/charts/schema";

/** Same default as layout/robots/sitemap; used whenever no trusted origin is configured. */
const FALLBACK = "https://chartrelay-production.up.railway.app";
import {
  KEYS_ANCHOR,
  QUICKSTART_KEY_PLACEHOLDER,
  quickstartCurl,
  quickstartSpec,
  quickstartState,
  resolveQuickstartOrigin,
} from "@/components/quickstart-card";

describe("resolveQuickstartOrigin", () => {
  it("prefers the configured public origin and drops any path or trailing slash", () => {
    expect(resolveQuickstartOrigin({ appUrl: "https://chartrelay.example/", host: "internal:3000" })).toBe("https://chartrelay.example");
    expect(resolveQuickstartOrigin({ appUrl: "http://localhost:3000" })).toBe("http://localhost:3000");
  });

  it("falls back to a loopback request host, so local development still gets a working command", () => {
    expect(resolveQuickstartOrigin({ host: "localhost:3000" })).toBe("http://localhost:3000");
    expect(resolveQuickstartOrigin({ host: "127.0.0.1:3000" })).toBe("http://127.0.0.1:3000");
    expect(resolveQuickstartOrigin({ forwardedHost: "localhost:4000", host: "127.0.0.1:3000" })).toBe("http://localhost:4000");
  });

  it("never lets a request header aim the copyable command at another host", () => {
    // The command is pasted into a shell beside `Authorization: Bearer $CHARTRELAY_API_KEY`, so a
    // poisoned Host or X-Forwarded-Host must not decide where that key is sent.
    expect(resolveQuickstartOrigin({ forwardedHost: "evil.example", host: "chartrelay.app" })).toBe(FALLBACK);
    expect(resolveQuickstartOrigin({ appUrl: "not a url", host: "evil.example" })).toBe(FALLBACK);
    expect(resolveQuickstartOrigin({ host: "evil.example" })).toBe(FALLBACK);
    expect(resolveQuickstartOrigin({ appUrl: "https://chartrelay.example", forwardedHost: "evil.example" })).toBe("https://chartrelay.example");
    // localhost.evil.example must not pass for a loopback host.
    expect(resolveQuickstartOrigin({ host: "localhost.evil.example" })).toBe(FALLBACK);
  });

  it("never renders an origin that serialises to null or a non-http scheme", () => {
    for (const source of [{ host: "chartrelay.app" }, { host: "a host with spaces" }, { appUrl: "   ", host: "" }, { appUrl: "javascript:alert(1)" }]) {
      const origin = resolveQuickstartOrigin(source);
      expect(origin).not.toBe("null");
      expect(origin).toMatch(/^https?:\/\//);
    }
  });
});

describe("quickstartCurl", () => {
  const curl = quickstartCurl("http://localhost:3000");

  it("targets the resolved origin's v1 render endpoint", () => {
    expect(curl).toContain("curl -X POST http://localhost:3000/api/v1/charts");
    expect(quickstartCurl("https://chartrelay.example")).toContain("https://chartrelay.example/api/v1/charts");
  });

  it("carries a shell placeholder rather than anything key-shaped", () => {
    expect(curl).toContain(`Authorization: Bearer ${QUICKSTART_KEY_PLACEHOLDER}`);
    expect(QUICKSTART_KEY_PLACEHOLDER.startsWith("$")).toBe(true);
    // The live key format (see createApiKeyValue) must never appear in copy.
    expect(curl).not.toMatch(/cr_live_[A-Za-z0-9_-]/);
  });

  it("sends a body the render API actually accepts", () => {
    const body = curl.slice(curl.indexOf("--data '") + "--data '".length, curl.lastIndexOf("'"));
    const parsed = chartSpecSchema.safeParse(JSON.parse(body));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.type).toBe("bar");
    expect(parsed.success && parsed.data.series[0]?.data.length).toBe(6);
  });

  it("keeps the exported spec valid on its own", () => {
    expect(chartSpecSchema.safeParse(quickstartSpec).success).toBe(true);
  });
});

describe("quickstartState", () => {
  it("stays open and unstarted for a brand new workspace", () => {
    expect(quickstartState(0, 0)).toEqual({ done: false, hasKey: false, statusLabel: "Not started", tone: "warning" });
  });

  it("credits step one once an active key exists but no render has landed", () => {
    expect(quickstartState(0, 2)).toEqual({ done: false, hasKey: true, statusLabel: "1 of 3 done", tone: "warning" });
  });

  it("is done after the first authenticated render, whether or not a key is still active", () => {
    expect(quickstartState(1, 1).done).toBe(true);
    expect(quickstartState(6, 0)).toEqual({ done: true, hasKey: false, statusLabel: "First render done", tone: "good" });
  });
});

describe("keys anchor", () => {
  it("points at the dashboard section that owns the one-time reveal flow", () => {
    expect(KEYS_ANCHOR).toBe("#api-keys");
  });
});

describe("QuickstartCard markup", () => {
  async function render(props: { renderCount: number; activeKeyCount: number; keyPrefix: string | null }) {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { QuickstartCard } = await import("@/components/quickstart-card");
    return renderToStaticMarkup(await QuickstartCard(props));
  }

  it("opens for a workspace with no renders and shows the create-key call to action", async () => {
    const html = await render({ renderCount: 0, activeKeyCount: 0, keyPrefix: null });
    expect(html).toContain("<details open=\"\"");
    expect(html).toContain('href="#api-keys"');
    expect(html).toContain("Create your API key");
    expect(html).toContain("http://localhost:3000/api/v1/charts");
    expect(html).toContain("Not started");
  });

  it("shows only the stored prefix, never a full key, once one exists", async () => {
    const html = await render({ renderCount: 0, activeKeyCount: 1, keyPrefix: "cr_live_abcd" });
    expect(html).toContain("cr_live_abcd");
    expect(html).toContain("stores only a hash");
    // The prefix is all that is stored; nothing key-length may be rendered.
    expect(html).not.toMatch(/cr_live_[A-Za-z0-9_-]{16,}/);
  });

  it("points a just-registered user at the key being revealed below, not at creating a second one", async () => {
    // Registration creates the account's first key, so this is what every new user sees on their first
    // dashboard load — while the API keys card fifteen lines down is displaying that key in full.
    const html = await render({ renderCount: 0, activeKeyCount: 1, keyPrefix: "cr_live_abcd" });
    const body = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    expect(body).toContain("You already have a key");
    expect(body).toContain("Its full value appears once, in the API keys section further down this page");
    expect(body).toContain("Go to your API keys");
    // The old copy declared the key unrecoverable and offered a new one as the way forward.
    expect(body).not.toContain("it cannot be displayed again");
    expect(body).not.toContain("Create a new key");
    // Step one is complete, and the pill has to agree.
    expect(html).toContain("1 of 3 done");
  });

  it("collapses to a done state after the first authenticated render", async () => {
    const html = await render({ renderCount: 3, activeKeyCount: 1, keyPrefix: "cr_live_abcd" });
    expect(html).not.toContain("<details open");
    expect(html).toContain("First render done");
    // The steps stay in the DOM so the card can be reopened without another request.
    expect(html).toContain("Read the response");
  });

  it("links on to the docs and the MCP server", async () => {
    const html = await render({ renderCount: 0, activeKeyCount: 1, keyPrefix: "cr_live_abcd" });
    expect(html).toContain('href="/docs"');
    expect(html).toContain('href="/mcp"');
  });

  it("labels the card with a real heading and announces copy feedback politely", async () => {
    const html = await render({ renderCount: 0, activeKeyCount: 1, keyPrefix: "cr_live_abcd" });
    expect(html).toContain('aria-labelledby="quickstart-heading"');
    expect(html).toContain('id="quickstart-heading"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
