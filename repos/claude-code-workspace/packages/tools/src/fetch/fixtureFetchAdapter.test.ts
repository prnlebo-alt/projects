import { describe, expect, it } from "vitest";
import { FixtureFetchAdapter } from "./fixtureFetchAdapter.js";

describe("FixtureFetchAdapter", () => {
  it("returns content_hash deterministically for the same fixture content", async () => {
    const adapter = new FixtureFetchAdapter([
      { url: "https://example.com/a", rawContent: "hello world" }
    ]);
    const first = await adapter.fetch({ url: "https://example.com/a" });
    const second = await adapter.fetch({ url: "https://example.com/a" });
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.status).toBe("ok");
  });

  it("returns not_found for an unfixtured URL rather than throwing", async () => {
    const adapter = new FixtureFetchAdapter([]);
    const result = await adapter.fetch({ url: "https://example.com/missing" });
    expect(result.status).toBe("not_found");
    expect(result.contentHash).toBeNull();
  });
});
