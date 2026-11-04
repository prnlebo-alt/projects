import { getDb, schema } from "@mi/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getCounts() {
  const db = getDb();
  const [sources, claims, claimEvidence, sourceFamilies, auditEvents] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.sources),
    db.select({ count: sql<number>`count(*)` }).from(schema.claims),
    db.select({ count: sql<number>`count(*)` }).from(schema.claimEvidence),
    db.select({ count: sql<number>`count(*)` }).from(schema.sourceFamilies),
    db.select({ count: sql<number>`count(*)` }).from(schema.auditEvents)
  ]);
  return {
    sources: Number(sources[0]?.count ?? 0),
    claims: Number(claims[0]?.count ?? 0),
    claimEvidence: Number(claimEvidence[0]?.count ?? 0),
    sourceFamilies: Number(sourceFamilies[0]?.count ?? 0),
    auditEvents: Number(auditEvents[0]?.count ?? 0)
  };
}

export default async function Page() {
  const counts = await getCounts();
  return (
    <main>
      <h1>Market Intelligence — Evidence Engine (Phase 1)</h1>
      <p>
        This is an admin-inspection placeholder only, per PHASE1_BUILD_DIRECTIVE.md: &quot;No
        polished dashboard.&quot; The real product surfaces (Market Brief, Change Feed,
        Opportunity Board, Competitor Profile, Evidence Drill-down) are Phase 7.
      </p>
      <h2>Current evidence store</h2>
      <ul>
        <li>Sources: {counts.sources}</li>
        <li>Claims: {counts.claims}</li>
        <li>Claim evidence records: {counts.claimEvidence}</li>
        <li>Source families: {counts.sourceFamilies}</li>
        <li>Audit events: {counts.auditEvents}</li>
      </ul>
      <p>
        See <code>/api/health</code> for a machine-readable check, and{" "}
        <code>docs/evidence/phase1-gate.md</code> for the Phase 1 evidence gate report.
      </p>
    </main>
  );
}
