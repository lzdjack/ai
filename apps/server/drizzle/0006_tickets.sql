CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"env_code" text NOT NULL,
	"env_tier" text NOT NULL,
	"name" text NOT NULL,
	"entry_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "environments_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "environments_tier_check" CHECK (env_tier in ('dev', 'test_gate', 'production'))
);
--> statement-breakpoint
CREATE TABLE "round_repo_slices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"start_sha" text NOT NULL,
	"head_sha" text NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "round_repo_slices_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "round_repo_slices_key" UNIQUE("round_id","repo_id")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"round_no" integer NOT NULL,
	"cause" text DEFAULT 'new' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"executor_type" text DEFAULT 'bot' NOT NULL,
	"fence_token" integer DEFAULT 1 NOT NULL,
	"flow_instance_id" uuid,
	"queue_reason" text,
	"help_reason" text,
	"delivery_mode" text,
	"delivery_payload" jsonb,
	"delivery_digest" text,
	"risk_level" text,
	"review_rev" integer DEFAULT 0 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "rounds_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "rounds_no_key" UNIQUE("ticket_id","round_no"),
	CONSTRAINT "rounds_status_check" CHECK (status in ('queued', 'fixing', 'needs_help', 'delivered', 'stopped')),
	CONSTRAINT "rounds_cause_check" CHECK (cause in ('new', 'code_rejected', 'test_rejected', 'mr_rejected', 'main_conflict', 'manual_restart', 'contract_updated')),
	CONSTRAINT "rounds_risk_check" CHECK (risk_level in ('L0', 'L1', 'L2'))
);
--> statement-breakpoint
CREATE TABLE "ticket_assignees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ticket_assignees_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "ticket_assignees_key" UNIQUE("ticket_id","user_id"),
	CONSTRAINT "ticket_assignees_source_check" CHECK (source in ('auto', 'manual', 'temp_override'))
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"connector_id" uuid,
	"external_id" text,
	"delivery_key" text DEFAULT '' NOT NULL,
	"seq_no" integer,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'P2' NOT NULL,
	"repro_steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"close_reason" text,
	"current_round" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tickets_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "tickets_source_check" CHECK (source_type in ('connector', 'manual', 'system')),
	CONSTRAINT "tickets_status_check" CHECK (status in ('pending', 'fixing', 'needs_help', 'in_review', 'rework', 'approved', 'done'))
);
--> statement-breakpoint
CREATE TABLE "verify_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"node_run_id" uuid,
	"verdict" jsonb NOT NULL,
	"digests" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"passed" boolean NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "verify_runs_ws_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_repo_slices" ADD CONSTRAINT "round_repo_slices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_repo_slices" ADD CONSTRAINT "round_repo_slices_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_repo_slices" ADD CONSTRAINT "round_repo_slices_round_fk" FOREIGN KEY ("workspace_id","round_id") REFERENCES "public"."rounds"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_repo_slices" ADD CONSTRAINT "round_repo_slices_repo_fk" FOREIGN KEY ("workspace_id","repo_id") REFERENCES "public"."repos"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_ticket_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "public"."tickets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignees" ADD CONSTRAINT "ticket_assignees_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignees" ADD CONSTRAINT "ticket_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignees" ADD CONSTRAINT "ticket_assignees_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_assignees" ADD CONSTRAINT "ticket_assignees_ticket_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "public"."tickets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verify_runs" ADD CONSTRAINT "verify_runs_round_fk" FOREIGN KEY ("workspace_id","round_id") REFERENCES "public"."rounds"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "environments_code_key" ON "environments" USING btree ("project_id","env_code") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_active_key" ON "rounds" USING btree ("ticket_id") WHERE status in ('queued', 'fixing', 'needs_help') and deleted_at is null;--> statement-breakpoint
CREATE INDEX "rounds_flow_idx" ON "rounds" USING btree ("flow_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_seq_key" ON "tickets" USING btree ("workspace_id","seq_no") WHERE seq_no is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_external_key" ON "tickets" USING btree ("workspace_id","connector_id","external_id","delivery_key") WHERE external_id is not null;