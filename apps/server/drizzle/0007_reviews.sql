CREATE TABLE "evidences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"round_id" uuid,
	"node_run_id" uuid NOT NULL,
	"kind" text DEFAULT 'screenshot' NOT NULL,
	"name" text NOT NULL,
	"sha256" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_state" text DEFAULT 'active' NOT NULL,
	"visibility_scope" text DEFAULT 'project_only' NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "evidences_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "evidences_run_name_key" UNIQUE("node_run_id","name"),
	CONSTRAINT "evidences_storage_check" CHECK (storage_state in ('active', 'purged_by_ttl'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"delivery_digest" text NOT NULL,
	"review_rev" integer NOT NULL,
	"result" text NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"self_delivery" boolean DEFAULT false NOT NULL,
	"comment" text,
	"reject_category" text,
	"risk_level" text,
	"location" jsonb,
	"text_snapshot" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reviews_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "reviews_round_key" UNIQUE("round_id"),
	CONSTRAINT "reviews_result_check" CHECK (result in ('approved', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_round_fk" FOREIGN KEY ("workspace_id","round_id") REFERENCES "public"."rounds"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidences_round_idx" ON "evidences" USING btree ("round_id");