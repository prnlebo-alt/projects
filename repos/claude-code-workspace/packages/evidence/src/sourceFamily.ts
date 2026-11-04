import type { FamilyType, MembershipRule } from "@mi/schemas";
import { canonicalizeUrl } from "./canonicalizeUrl.js";
import { daysBetween, sharedFingerprints, wordSetJaccardSimilarity } from "./similarity.js";

export interface SnapshotForClustering {
  snapshotId: string;
  sourceId: string;
  canonicalUrl: string;
  canonicalPublisherItemId?: string | null;
  normalizedText: string;
  publishedAt: Date | null;
  /** Explicit metadata: name of the wire service that distributed this item, if known. */
  wireService?: string | null;
  /**
   * Explicit metadata: the wire service's own item/release identifier for
   * this specific distribution (e.g. a PR Newswire story ID). Required,
   * alongside a matching `wireService`, for rule 2 — the wire-service
   * *name* alone is not shared-origin evidence (defect #4): two unrelated
   * releases distributed by the same wire service are not the same family.
   */
  wireItemId?: string | null;
  /** Explicit metadata: this snapshot is a known syndicated copy of another snapshot. */
  syndicatedFromSnapshotId?: string | null;
}

export interface FamilyMembership {
  sourceSnapshotId: string;
  familyIndex: number;
  membershipRule: MembershipRule;
  similarityScore: number | null;
}

export interface ClusteredFamily {
  familyIndex: number;
  familyType: FamilyType;
  canonicalOriginSourceId: string | null;
  fingerprint: string | null;
  memberSnapshotIds: string[];
}

export interface ClusterResult {
  families: ClusteredFamily[];
  memberships: FamilyMembership[];
}

const RULE_TO_FAMILY_TYPE: Record<MembershipRule, FamilyType> = {
  rule_1_canonical_url: "canonical_url",
  rule_2_wire_ancestry: "wire_ancestry",
  rule_3_similarity_plus_fingerprint: "similarity_plus_fingerprint",
  rule_4_press_release_fingerprint: "press_release_fingerprint",
  rule_5_explicit_syndication: "explicit_syndication"
};

interface Edge {
  a: number;
  b: number;
  rule: MembershipRule;
  similarityScore: number | null;
}

class UnionFind {
  private readonly parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]!);
    }
    return this.parent[x]!;
  }
  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      // Deterministic tie-break: lower root index wins, independent of call order.
      if (rootA < rootB) this.parent[rootB] = rootA;
      else this.parent[rootA] = rootB;
    }
  }
}

/**
 * ARCHITECTURE.md §8.3 — the five deterministic source-family rules.
 * Models may propose candidate features (packages/models
 * propose_source_family_features); only this function finalizes membership.
 *
 * Rule 2 requires a *shared wire item/release identity* (`wireService` AND
 * `wireItemId` both matching), not merely the same distributor name —
 * two unrelated releases distributed by the same wire service are
 * independent reporting, not corroboration (defect #4). Two snapshots that
 * share only a wire-service *name* fall through to rules 3/4, which require
 * their own independent similarity + fingerprint evidence before merging.
 *
 * Rule 3 and rule 4 both require similarity **and** a co-firing secondary
 * shared-origin fingerprint — text similarity plus time proximity alone can
 * never merge two snapshots (ADR-003).
 */
export function clusterSourceFamilies(snapshots: SnapshotForClustering[]): ClusterResult {
  const n = snapshots.length;
  const uf = new UnionFind(n);
  const edges: Edge[] = [];
  const byId = new Map(snapshots.map((s, i) => [s.snapshotId, i]));

  // Rule 5: explicit syndication metadata.
  snapshots.forEach((s, i) => {
    if (s.syndicatedFromSnapshotId) {
      const j = byId.get(s.syndicatedFromSnapshotId);
      if (j !== undefined && j !== i) {
        uf.union(i, j);
        edges.push({ a: i, b: j, rule: "rule_5_explicit_syndication", similarityScore: null });
      }
    }
  });

  // Rule 1: same canonical URL or canonical publisher item ID.
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const si = snapshots[i]!;
      const sj = snapshots[j]!;
      const sameUrl = canonicalizeUrl(si.canonicalUrl) === canonicalizeUrl(sj.canonicalUrl);
      const samePublisherItem =
        Boolean(si.canonicalPublisherItemId) &&
        si.canonicalPublisherItemId === sj.canonicalPublisherItemId;
      if (sameUrl || samePublisherItem) {
        uf.union(i, j);
        edges.push({ a: i, b: j, rule: "rule_1_canonical_url", similarityScore: null });
      }
    }
  }

  // Rule 2: known wire/source ancestry — the same wire *item*, not merely
  // the same distributor name (defect #4: "shared wire-service name alone
  // is insufficient ancestry").
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const si = snapshots[i]!;
      const sj = snapshots[j]!;
      const sameWireItem =
        Boolean(si.wireService) &&
        si.wireService === sj.wireService &&
        Boolean(si.wireItemId) &&
        si.wireItemId === sj.wireItemId;
      if (sameWireItem) {
        uf.union(i, j);
        edges.push({ a: i, b: j, rule: "rule_2_wire_ancestry", similarityScore: null });
      }
    }
  }

  // Rules 3 & 4: similarity + time proximity + co-firing secondary fingerprint.
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const si = snapshots[i]!;
      const sj = snapshots[j]!;
      if (uf.find(i) === uf.find(j)) continue; // already merged by a stronger rule
      if (!si.publishedAt || !sj.publishedAt) continue;
      if (daysBetween(si.publishedAt, sj.publishedAt) > 7) continue;

      const similarity = wordSetJaccardSimilarity(si.normalizedText, sj.normalizedText);
      const fingerprints = sharedFingerprints(si.normalizedText, sj.normalizedText);
      if (fingerprints.length === 0) continue; // similarity + time alone is never sufficient

      if (similarity >= 0.9) {
        uf.union(i, j);
        edges.push({ a: i, b: j, rule: "rule_3_similarity_plus_fingerprint", similarityScore: similarity });
      } else if (similarity >= 0.8) {
        uf.union(i, j);
        edges.push({ a: i, b: j, rule: "rule_4_press_release_fingerprint", similarityScore: similarity });
      }
    }
  }

  // Group by root.
  const rootToMembers = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const root = uf.find(i);
    const group = rootToMembers.get(root) ?? [];
    group.push(i);
    rootToMembers.set(root, group);
  }

  const roots = [...rootToMembers.keys()].sort((a, b) => a - b);
  const families: ClusteredFamily[] = [];
  const memberships: FamilyMembership[] = [];

  roots.forEach((root, familyIndex) => {
    const members = rootToMembers.get(root)!;
    // Strongest connecting edge per member (prefer the rule with the lower
    // enum ordinal, i.e. the more specific/stronger rule already listed first).
    const ruleOrder: MembershipRule[] = [
      "rule_5_explicit_syndication",
      "rule_1_canonical_url",
      "rule_2_wire_ancestry",
      "rule_3_similarity_plus_fingerprint",
      "rule_4_press_release_fingerprint"
    ];
    const memberEdges = new Map<number, Edge>();
    for (const edge of edges) {
      if (!members.includes(edge.a) || !members.includes(edge.b)) continue;
      for (const m of [edge.a, edge.b]) {
        const existing = memberEdges.get(m);
        if (!existing || ruleOrder.indexOf(edge.rule) < ruleOrder.indexOf(existing.rule)) {
          memberEdges.set(m, edge);
        }
      }
    }

    let familyType: FamilyType = "canonical_url";
    let fingerprint: string | null = null;
    if (memberEdges.size > 0) {
      const strongest = [...memberEdges.values()].sort(
        (a, b) => ruleOrder.indexOf(a.rule) - ruleOrder.indexOf(b.rule)
      )[0]!;
      familyType = RULE_TO_FAMILY_TYPE[strongest.rule];
    }
    if (familyType === "similarity_plus_fingerprint" || familyType === "press_release_fingerprint") {
      const [i, j] = members;
      if (i !== undefined && j !== undefined) {
        const shared = sharedFingerprints(snapshots[i]!.normalizedText, snapshots[j]!.normalizedText);
        fingerprint = shared[0] ?? null;
      }
    }

    const originIndex = members[0]!;
    families.push({
      familyIndex,
      familyType,
      canonicalOriginSourceId: snapshots[originIndex]!.sourceId,
      fingerprint,
      memberSnapshotIds: members.map((m) => snapshots[m]!.snapshotId)
    });

    for (const m of members) {
      const edge = memberEdges.get(m);
      memberships.push({
        sourceSnapshotId: snapshots[m]!.snapshotId,
        familyIndex,
        membershipRule: edge?.rule ?? "rule_1_canonical_url",
        similarityScore: edge?.similarityScore ?? null
      });
    }
  });

  return { families, memberships };
}
