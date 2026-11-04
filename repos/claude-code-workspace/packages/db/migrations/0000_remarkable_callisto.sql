CREATE TYPE "public"."access_policy_result" AS ENUM('allow', 'deny', 'manual_policy_required');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('deterministic_service', 'model', 'human');--> statement-breakpoint
CREATE TYPE "public"."agent_role" AS ENUM('market_intelligence_director', 'evidence_and_research', 'competitive_intelligence', 'gap_opportunity_hunter', 'strategy_and_gauntlet');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('pending_grounding', 'grounded', 'grounding_failed', 'pending_verification', 'verified', 'verification_failed', 'verification_unresolved');--> statement-breakpoint
CREATE TYPE "public"."evidence_class" AS ENUM('audited_regulatory_primary_dataset', 'direct_customer_primary_statement', 'independent_analyst_academic_research', 'implementation_partner_named_deployment', 'vendor_primary_documentation', 'vendor_case_study_outcome', 'demo_roadmap_announcement', 'marketing_only_assertion', 'unverified_inaccessible');--> statement-breakpoint
CREATE TYPE "public"."family_type" AS ENUM('canonical_url', 'wire_ancestry', 'similarity_plus_fingerprint', 'press_release_fingerprint', 'explicit_syndication');--> statement-breakpoint
CREATE TYPE "public"."fetch_method" AS ENUM('http_static', 'browser_rendered');--> statement-breakpoint
CREATE TYPE "public"."fetch_status" AS ENUM('pending', 'fetched', 'unchanged', 'denied_by_policy', 'manual_policy_required', 'fetch_failed');--> statement-breakpoint
CREATE TYPE "public"."grounding_status" AS ENUM('ungrounded', 'grounded_exact', 'grounded_fuzzy', 'grounding_failed');--> statement-breakpoint
CREATE TYPE "public"."materiality_field_type" AS ENUM('pricing', 'maturity', 'availability', 'buyer_fit', 'capability_presence', 'partnership_acquisition', 'positioning', 'hiring', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_rule" AS ENUM('rule_1_canonical_url', 'rule_2_wire_ancestry', 'rule_3_similarity_plus_fingerprint', 'rule_4_press_release_fingerprint', 'rule_5_explicit_syndication');--> statement-breakpoint
CREATE TYPE "public"."policy_decision" AS ENUM('allow', 'deny', 'manual_review');--> statement-breakpoint
CREATE TYPE "public"."robots_mode" AS ENUM('respect', 'override_authorized', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('company', 'product', 'agent_offering', 'market_lane');--> statement-breakpoint
CREATE TYPE "public"."support_type" AS ENUM('support', 'counter');--> statement-breakpoint
CREATE TYPE "public"."verifier_status" AS ENUM('not_selected', 'pending', 'verified', 'failed', 'unresolved', 'grounding_failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_policy_registry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"domain_pattern" text NOT NULL,
	"fetch_policy" "policy_decision" NOT NULL,
	"browser_policy" "policy_decision" NOT NULL,
	"auth_required" boolean NOT NULL,
	"robots_mode" "robots_mode" NOT NULL,
	"tos_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_run_id" uuid NOT NULL,
	"agent_role" "agent_role" NOT NULL,
	"model_provider" text NOT NULL,
	"model_name" text NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt_content_hash" text NOT NULL,
	"status" "run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"cost_estimate" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claim_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid NOT NULL,
	"source_snapshot_id" uuid NOT NULL,
	"evidence_class" "evidence_class" NOT NULL,
	"support_type" "support_type" NOT NULL,
	"excerpt_location" text NOT NULL,
	"excerpt_text" text NOT NULL,
	"grounding_status" "grounding_status" NOT NULL,
	"extractor_confidence" double precision NOT NULL,
	"verifier_status" "verifier_status" NOT NULL,
	"interest_flags_json" jsonb NOT NULL,
	"evidence_item_confidence" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" text NOT NULL,
	"predicate" text NOT NULL,
	"object_value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"claim_status" "claim_status" NOT NULL,
	"material" boolean,
	"first_observed_at" timestamp with time zone NOT NULL,
	"last_verified_at" timestamp with time zone,
	"confidence" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "materiality_sensitivity_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"predicate_pattern" text NOT NULL,
	"field_type" "materiality_field_type" NOT NULL,
	"affected_dimensions" jsonb NOT NULL,
	"affected_action_gate" boolean NOT NULL,
	"material" boolean NOT NULL,
	"rule_version" integer NOT NULL,
	"active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"objective" text NOT NULL,
	"run_type" text NOT NULL,
	"status" "run_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"token_budget" integer NOT NULL,
	"monetary_budget" double precision NOT NULL,
	"source_budget" integer NOT NULL,
	"partial_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_families" (
	"id" uuid PRIMARY KEY NOT NULL,
	"family_type" "family_type" NOT NULL,
	"canonical_origin_source_id" uuid,
	"fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_family_members" (
	"source_snapshot_id" uuid NOT NULL,
	"source_family_id" uuid NOT NULL,
	"membership_rule" "membership_rule" NOT NULL,
	"similarity_score" double precision
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"content_hash" text NOT NULL,
	"raw_content_location" text NOT NULL,
	"normalized_text_location" text NOT NULL,
	"screenshot_location" text,
	"fetch_method" "fetch_method" NOT NULL,
	"access_policy_result" "access_policy_result" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"domain" text NOT NULL,
	"source_type" text NOT NULL,
	"publisher" text,
	"title" text,
	"published_at" timestamp with time zone,
	"first_fetched_at" timestamp with time zone NOT NULL,
	"last_fetched_at" timestamp with time zone NOT NULL,
	"fetch_status" "fetch_status" NOT NULL,
	"content_hash" text,
	CONSTRAINT "sources_canonical_url_unique" UNIQUE("canonical_url")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"research_run_id" uuid NOT NULL,
	"claim_count" integer NOT NULL,
	"verified_count" integer NOT NULL,
	"failed_count" integer NOT NULL,
	"unresolved_count" integer NOT NULL,
	"audited_nonmaterial_count" integer NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "claim_evidence" ADD CONSTRAINT "claim_evidence_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_families" ADD CONSTRAINT "source_families_canonical_origin_source_id_sources_id_fk" FOREIGN KEY ("canonical_origin_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_family_members" ADD CONSTRAINT "source_family_members_source_snapshot_id_source_snapshots_id_fk" FOREIGN KEY ("source_snapshot_id") REFERENCES "public"."source_snapshots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_family_members" ADD CONSTRAINT "source_family_members_source_family_id_source_families_id_fk" FOREIGN KEY ("source_family_id") REFERENCES "public"."source_families"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_research_run_id_research_runs_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."research_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
