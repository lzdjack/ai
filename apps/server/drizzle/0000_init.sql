CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"default_locale" varchar(16) DEFAULT 'zh-CN' NOT NULL,
	"risk_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "projects_status_check" CHECK (status in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"locale" varchar(16) DEFAULT 'zh-CN' NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"is_instance_admin" boolean DEFAULT false NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_check" CHECK (status in ('active', 'disabled'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"organization_id" uuid,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_kind_check" CHECK (kind in ('personal', 'organization'))
);
--> statement-breakpoint
CREATE TABLE "audit_probe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"txid" "xid8" DEFAULT pg_current_xact_id() NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "audit_probe_ws_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "change_stream" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"stream_seq" bigint,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"project_id" uuid,
	"op" text NOT NULL,
	"entity_rev" integer NOT NULL,
	"row" jsonb,
	"authz_epoch" integer DEFAULT 0 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "change_stream_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "change_stream_seq_key" UNIQUE("workspace_id","stream_seq"),
	CONSTRAINT "change_stream_op_check" CHECK (op in ('upsert', 'tombstone'))
);
--> statement-breakpoint
CREATE TABLE "effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"effect_key" text NOT NULL,
	"node_run_id" uuid,
	"kind" text NOT NULL,
	"request" jsonb NOT NULL,
	"result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "effects_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "effects_key" UNIQUE("workspace_id","effect_key"),
	CONSTRAINT "effects_status_check" CHECK (status in ('pending', 'succeeded', 'failed', 'interrupted'))
);
--> statement-breakpoint
CREATE TABLE "flow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ticket_id" uuid,
	"round_id" uuid,
	"parent_ref_type" text,
	"parent_ref_id" uuid,
	"workflow_template_version_id" uuid,
	"plan" jsonb NOT NULL,
	"plan_schema_version" integer NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "flow_instances_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "flow_instances_kind_check" CHECK (kind in ('round', 'delivery', 'bundle', 'eval')),
	CONSTRAINT "flow_instances_status_check" CHECK (status in ('running', 'done', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "node_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"flow_instance_id" uuid NOT NULL,
	"node_key" text NOT NULL,
	"node_kind" text NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"run_mode" text DEFAULT 'full' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"skip_reason" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "node_runs_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "node_runs_run_mode_check" CHECK (run_mode in ('full', 'verify_only')),
	CONSTRAINT "node_runs_status_check" CHECK (status in ('pending', 'running', 'waiting_human', 'done', 'failed', 'skipped', 'skipped_inherited', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "outbox_ws_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"singleton_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"fence" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"last_error" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "work_items_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "work_items_status_check" CHECK (status in ('queued', 'leased', 'done', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "workspace_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"counter_type" text NOT NULL,
	"next_val" bigint DEFAULT 1 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspace_counters_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "workspace_counters_type_key" UNIQUE("workspace_id","counter_type")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" text DEFAULT 'human' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"authz_epoch" integer DEFAULT 0 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workspace_members_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "workspace_members_user_key" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "workspace_members_account_type_check" CHECK (account_type in ('human', 'service')),
	CONSTRAINT "workspace_members_status_check" CHECK (status in ('active', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_probe" ADD CONSTRAINT "audit_probe_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_stream" ADD CONSTRAINT "change_stream_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effects" ADD CONSTRAINT "effects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_runs" ADD CONSTRAINT "node_runs_flow_instance_fk" FOREIGN KEY ("workspace_id","flow_instance_id") REFERENCES "public"."flow_instances"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_counters" ADD CONSTRAINT "workspace_counters_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" USING btree ("workspace_id","slug") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "audit_probe_tx_idx" ON "audit_probe" USING btree ("txid");--> statement-breakpoint
CREATE UNIQUE INDEX "node_runs_attempt_key" ON "node_runs" USING btree ("flow_instance_id","node_key","attempt_no");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("created_at") WHERE delivered_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_singleton_key" ON "work_items" USING btree ("workspace_id","singleton_key") WHERE status in ('queued', 'leased');--> statement-breakpoint
CREATE INDEX "work_items_due_idx" ON "work_items" USING btree ("run_after") WHERE status = 'queued';