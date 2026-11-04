import { newId } from "@mi/schemas";
import type { Database } from "./client.js";
import { auditEvents } from "./schema.js";

export interface WriteAuditEventInput {
  actorType: "deterministic_service" | "model" | "human";
  actorId: string;
  eventType: string;
  objectType: string;
  objectId: string;
  payload: Record<string, unknown>;
}

/**
 * Every deterministic/model/human action that touches evidence, gates, or
 * scores writes one audit_events row. This is the append-only trail
 * referenced throughout EVIDENCE_DOCTRINE.md and required by the Phase 1
 * gate ("audit log proof").
 */
export async function writeAuditEvent(db: Database, input: WriteAuditEventInput): Promise<string> {
  const id = newId();
  await db.insert(auditEvents).values({
    id,
    actorType: input.actorType,
    actorId: input.actorId,
    eventType: input.eventType,
    objectType: input.objectType,
    objectId: input.objectId,
    payload: input.payload
  });
  return id;
}
