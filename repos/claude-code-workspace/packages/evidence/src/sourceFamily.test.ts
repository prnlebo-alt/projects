import { describe, expect, it } from "vitest";
import { clusterSourceFamilies, type SnapshotForClustering } from "./sourceFamily.js";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-08-01T12:00:00Z");

describe("clusterSourceFamilies", () => {
  it("rule 1: identical canonical URL fetched twice merges into one family", () => {
    const snapshots: SnapshotForClustering[] = [
      {
        snapshotId: "s1",
        sourceId: "src1",
        canonicalUrl: "https://acme.com/finance-agent",
        normalizedText: "Acme Finance Agent product page.",
        publishedAt: T0
      },
      {
        snapshotId: "s2",
        sourceId: "src1",
        canonicalUrl: "https://acme.com/finance-agent",
        normalizedText: "Acme Finance Agent product page. Updated pricing section.",
        publishedAt: new Date(T0.getTime() + DAY)
      }
    ];
    const { families, memberships } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(1);
    expect(memberships.find((m) => m.sourceSnapshotId === "s2")?.membershipRule).toBe(
      "rule_1_canonical_url"
    );
  });

  it("rule 2: same wire service AND same wire item ID merges regardless of exact wording", () => {
    const wireA =
      'Acme Robotics today announced general availability of its Finance Agent. ' +
      '"This changes everything for revenue teams" said CEO Jane Doe. Price: $1200/month.';
    const wireB =
      '(BUSINESS WIRE) -- Acme Robotics announced general availability of its Finance Agent today. ' +
      '"This changes everything for revenue teams" said CEO Jane Doe in a statement. Price: $1200/month.';
    const snapshots: SnapshotForClustering[] = [
      {
        snapshotId: "s1",
        sourceId: "src1",
        canonicalUrl: "https://prnewswire.com/acme-launch",
        normalizedText: wireA,
        publishedAt: T0,
        wireService: "PR Newswire",
        wireItemId: "pnw-2026-08-acme-launch"
      },
      {
        snapshotId: "s2",
        sourceId: "src2",
        canonicalUrl: "https://businesswire.com/acme-launch-copy",
        normalizedText: wireB,
        publishedAt: T0,
        wireService: "PR Newswire",
        wireItemId: "pnw-2026-08-acme-launch"
      }
    ];
    const { families, memberships } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(1);
    expect(memberships.find((m) => m.sourceSnapshotId === "s2")?.membershipRule).toBe(
      "rule_2_wire_ancestry"
    );
  });

  it("defect #4: same wire service but a DIFFERENT (unrelated) release does not merge on rule 2 name alone", () => {
    const releaseA =
      "Acme Robotics today announced general availability of its Finance Agent for Salesforce customers.";
    const releaseB =
      "Unrelated Corp today announced a new manufacturing partnership in the automotive sector.";
    const snapshots: SnapshotForClustering[] = [
      {
        snapshotId: "s1",
        sourceId: "src1",
        canonicalUrl: "https://prnewswire.com/acme-launch-2026",
        normalizedText: releaseA,
        publishedAt: T0,
        wireService: "PR Newswire",
        wireItemId: "pnw-2026-08-acme-launch"
      },
      {
        snapshotId: "s2",
        sourceId: "src2",
        canonicalUrl: "https://prnewswire.com/unrelated-corp-partnership",
        normalizedText: releaseB,
        publishedAt: new Date(T0.getTime() + DAY),
        wireService: "PR Newswire",
        wireItemId: "pnw-2026-08-unrelated-corp"
      }
    ];
    const { families } = clusterSourceFamilies(snapshots);
    // Same distributor, unrelated content, unrelated release IDs, and no
    // shared fingerprint to fall back on via rules 3/4 — must stay separate.
    expect(families).toHaveLength(2);
  });

  it("defect #4: same wire service with NO wire item ID recorded on either side does not merge via rule 2 alone", () => {
    const releaseA = "Acme Robotics today announced general availability of its Finance Agent.";
    const releaseB = "A totally different company announced a totally different product today.";
    const snapshots: SnapshotForClustering[] = [
      {
        snapshotId: "s1",
        sourceId: "src1",
        canonicalUrl: "https://prnewswire.com/story-a",
        normalizedText: releaseA,
        publishedAt: T0,
        wireService: "PR Newswire"
      },
      {
        snapshotId: "s2",
        sourceId: "src2",
        canonicalUrl: "https://prnewswire.com/story-b",
        normalizedText: releaseB,
        publishedAt: T0,
        wireService: "PR Newswire"
      }
    ];
    const { families } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(2);
  });

  it("rule 5: explicit syndicated_from metadata merges even with different URLs/text", () => {
    const snapshots: SnapshotForClustering[] = [
      {
        snapshotId: "origin",
        sourceId: "src1",
        canonicalUrl: "https://acme.com/press/launch",
        normalizedText: "Original press release text.",
        publishedAt: T0
      },
      {
        snapshotId: "copy",
        sourceId: "src2",
        canonicalUrl: "https://someblog.example/reposted-press-release",
        normalizedText: "Completely reformatted republished text, same underlying announcement.",
        publishedAt: new Date(T0.getTime() + DAY),
        syndicatedFromSnapshotId: "origin"
      }
    ];
    const { families, memberships } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(1);
    expect(memberships.find((m) => m.sourceSnapshotId === "copy")?.membershipRule).toBe(
      "rule_5_explicit_syndication"
    );
  });

  it("rule 3: >=0.90 similarity within 7 days + shared quote fingerprint merges", () => {
    const base =
      'Acme Robotics announced the general availability of its new Finance Agent for mid market ' +
      'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
      "in a statement. The product is available immediately through the Salesforce AppExchange at " +
      "one thousand two hundred dollars per month for the standard tier.";
    const nearIdentical =
      'Acme Robotics announced today the general availability of its new Finance Agent for mid market ' +
      'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
      "in a statement. The product is available immediately through the Salesforce AppExchange at " +
      "one thousand two hundred dollars per month for the standard tier.";
    const snapshots: SnapshotForClustering[] = [
      { snapshotId: "a", sourceId: "srcA", canonicalUrl: "https://outlet-a.example/story", normalizedText: base, publishedAt: T0 },
      { snapshotId: "b", sourceId: "srcB", canonicalUrl: "https://outlet-b.example/story", normalizedText: nearIdentical, publishedAt: new Date(T0.getTime() + 2 * DAY) }
    ];
    const { families, memberships } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(1);
    expect(memberships.find((m) => m.sourceSnapshotId === "b")?.membershipRule).toBe(
      "rule_3_similarity_plus_fingerprint"
    );
  });

  it("rule 4: 0.80-0.90 similarity within 7 days + shared fingerprint merges", () => {
    const base =
      'Acme Robotics announced the general availability of its new Finance Agent for mid market ' +
      'Salesforce customers this week. "This changes everything for revenue teams" said CEO Jane Doe ' +
      "in a statement. The product is available immediately through the Salesforce AppExchange at " +
      "one thousand two hundred dollars per month for the standard tier.";
    const moderateEdit =
      'Acme Robotics this week announced general availability for its new Finance Agent built for mid ' +
      'market Salesforce customers. "This changes everything for revenue teams" said CEO Jane Doe in a ' +
      "statement to press. The product is available now through the Salesforce AppExchange at one " +
      "thousand two hundred dollars per month for the standard tier.";
    const snapshots: SnapshotForClustering[] = [
      { snapshotId: "a", sourceId: "srcA", canonicalUrl: "https://outlet-a.example/story", normalizedText: base, publishedAt: T0 },
      { snapshotId: "b", sourceId: "srcB", canonicalUrl: "https://outlet-b.example/story", normalizedText: moderateEdit, publishedAt: new Date(T0.getTime() + 3 * DAY) }
    ];
    const { families, memberships } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(1);
    expect(memberships.find((m) => m.sourceSnapshotId === "b")?.membershipRule).toBe(
      "rule_4_press_release_fingerprint"
    );
  });

  it("ADR-003: >=0.90 similarity + time proximity alone (no fingerprint) does NOT merge", () => {
    const noFingerA =
      "Acme Robotics announced the general availability of its new Finance Agent for mid market " +
      "Salesforce customers this week. The company said the tool automates collections workflows and " +
      "expands its existing platform. The product is available immediately through the Salesforce " +
      "AppExchange for the standard tier.";
    const noFingerB =
      "Acme Robotics announced the general availability of its new Finance Agent for mid market " +
      "Salesforce customers this week. The company said the tool automates collections workflows and " +
      "expands its existing platform. The product is now available through the Salesforce AppExchange " +
      "for the standard tier.";
    const snapshots: SnapshotForClustering[] = [
      { snapshotId: "a", sourceId: "srcA", canonicalUrl: "https://outlet-a.example/story", normalizedText: noFingerA, publishedAt: T0 },
      { snapshotId: "b", sourceId: "srcB", canonicalUrl: "https://outlet-b.example/story", normalizedText: noFingerB, publishedAt: new Date(T0.getTime() + DAY) }
    ];
    const { families } = clusterSourceFamilies(snapshots);
    // Similarity here is ~0.94 (well above 0.90) but there is no shared
    // quoted/numeric fingerprint, so ADR-003 must block the merge.
    expect(families).toHaveLength(2);
  });

  it("two genuinely independent reports on the same topic stay in separate families", () => {
    const indA =
      "Industry analysts at Forrester noted this quarter that several Salesforce-native finance " +
      "vendors are racing to add agentic collections tooling, citing Acme Robotics as one of at " +
      "least four companies now shipping similar automation to mid-market revenue teams.";
    const indB =
      "TechCrunch reports that Acme Robotics quietly rolled out an AI collections feature, joining " +
      "rivals like Zilliant and Sidetrade in a crowded push toward automated finance workflows for " +
      "smaller Salesforce shops.";
    const snapshots: SnapshotForClustering[] = [
      { snapshotId: "a", sourceId: "srcA", canonicalUrl: "https://forrester.example/report", normalizedText: indA, publishedAt: T0 },
      { snapshotId: "b", sourceId: "srcB", canonicalUrl: "https://techcrunch.example/story", normalizedText: indB, publishedAt: new Date(T0.getTime() + DAY) }
    ];
    const { families } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(2);
  });

  it("does not merge similar text published more than 7 days apart", () => {
    const base = 'Acme announced GA of Finance Agent. "This changes everything" said the CEO. $1200/mo.';
    const snapshots: SnapshotForClustering[] = [
      { snapshotId: "a", sourceId: "srcA", canonicalUrl: "https://outlet-a.example/story", normalizedText: base, publishedAt: T0 },
      { snapshotId: "b", sourceId: "srcB", canonicalUrl: "https://outlet-b.example/story", normalizedText: base, publishedAt: new Date(T0.getTime() + 10 * DAY) }
    ];
    const { families } = clusterSourceFamilies(snapshots);
    expect(families).toHaveLength(2);
  });
});
