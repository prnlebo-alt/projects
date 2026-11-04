import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const request = (url: string, headers: Record<string, string>) => new NextRequest(new Request(url, { headers }));

describe("canonical host middleware", () => {
  it("redirects a legacy hostname to the canonical domain, preserving path and query", () => {
    vi.stubEnv("APP_URL", "https://chartrelay.dev");
    const response = proxy(request("https://chartrelay.dev/pricing?ref=hn", { "x-forwarded-host": "chartrelay-production.up.railway.app" }));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://chartrelay.dev/pricing?ref=hn");
    vi.unstubAllEnvs();
  });

  it("leaves the canonical host and localhost alone", () => {
    vi.stubEnv("APP_URL", "https://chartrelay.dev");
    expect(proxy(request("https://chartrelay.dev/", { "x-forwarded-host": "chartrelay.dev" })).headers.get("location")).toBeNull();
    expect(proxy(request("http://localhost:3000/", { host: "localhost:3000" })).headers.get("location")).toBeNull();
    vi.unstubAllEnvs();
  });

  it("does nothing when APP_URL is unset or unparseable", () => {
    vi.stubEnv("APP_URL", "");
    expect(proxy(request("https://anything.example/", { host: "anything.example" })).headers.get("location")).toBeNull();
    vi.stubEnv("APP_URL", "not a url");
    expect(proxy(request("https://anything.example/", { host: "anything.example" })).headers.get("location")).toBeNull();
    vi.unstubAllEnvs();
  });
});
