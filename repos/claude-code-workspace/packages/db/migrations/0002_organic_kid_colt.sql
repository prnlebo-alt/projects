ALTER TABLE "claim_evidence" ADD COLUMN "extraction_agent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "claim_evidence" ADD COLUMN "evidence_class_agent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "wire_service" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "wire_item_id" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "canonical_publisher_item_id" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "syndicated_from_url" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_extraction_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("extraction_agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_evidence_class_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("evidence_class_agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
