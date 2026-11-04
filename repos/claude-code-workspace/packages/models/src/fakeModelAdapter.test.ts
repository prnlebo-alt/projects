import { describe, expect, it } from "vitest";
import { FakeModelAdapter } from "./fakeModelAdapter.js";

describe("FakeModelAdapter", () => {
  const adapter = new FakeModelAdapter();

  it("is deterministic for identical input", async () => {
    const request = {
      task: "atomize_claims" as const,
      promptVersion: "v1",
      input: { text: "PRICING: $500/month\nMATURITY: GA" }
    };
    const a = await adapter.propose(request);
    const b = await adapter.propose(request);
    expect(a.output).toEqual(b.output);
    expect(a.promptContentHash).toBe(b.promptContentHash);
  });

  it("atomizes Key: value lines into claim candidates with verbatim excerpts", async () => {
    const text = "PRICING: $500/month\nMATURITY: GA\nnot a claim line";
    const response = await adapter.propose({
      task: "atomize_claims",
      promptVersion: "v1",
      input: { text }
    });
    const claims = response.output["claims"] as Array<{
      predicate: string;
      objectValue: string;
      excerptText: string;
    }>;
    expect(claims).toHaveLength(2);
    expect(claims[0]?.predicate).toBe("pricing");
    expect(claims[0]?.objectValue).toBe("$500/month");
    expect(text).toContain(claims[0]!.excerptText);
  });

  it("always returns isFinal: false — a proposal, never final authority", async () => {
    const response = await adapter.propose({
      task: "classify_evidence_class",
      promptVersion: "v1",
      input: { sourceType: "vendor_documentation" }
    });
    expect(response.isFinal).toBe(false);
    expect(response.output["evidenceClass"]).toBe("vendor_primary_documentation");
  });

  it("proposes similarity + shared fingerprints for source-family features", async () => {
    const response = await adapter.propose({
      task: "propose_source_family_features",
      promptVersion: "v1",
      input: {
        textA: 'Acme launches new agent. "This changes everything for finance teams" said the CEO.',
        textB: 'Acme today launched a new agent. "This changes everything for finance teams" said the CEO.'
      }
    });
    const fingerprints = response.output["sharedFingerprints"] as string[];
    expect(fingerprints).toContain("This changes everything for finance teams");
    expect(response.output["similarityScore"]).toBeGreaterThan(0.5);
  });
});
