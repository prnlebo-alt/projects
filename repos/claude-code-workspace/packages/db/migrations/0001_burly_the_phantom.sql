ALTER TABLE "claim_evidence" ADD COLUMN "same_source_refetch" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "claim_evidence_claim_snapshot_excerpt_key" ON "claim_evidence" USING btree ("claim_id","source_snapshot_id","excerpt_location");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "claims_semantic_identity_key" ON "claims" USING btree ("subject_type","subject_id","predicate","normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "source_family_members_source_snapshot_id_key" ON "source_family_members" USING btree ("source_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "source_snapshots_source_id_content_hash_key" ON "source_snapshots" USING btree ("source_id","content_hash");