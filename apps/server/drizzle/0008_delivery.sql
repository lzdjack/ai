CREATE TABLE "merge_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"flow_instance_id" uuid,
	"node_run_id" uuid,
	"direction" text NOT NULL,
	"environment_id" uuid,
	"external_iid" text,
	"web_url" text,
	"source_branch" text NOT NULL,
	"target_branch" text NOT NULL,
	"head_sha" text,
	"reviewer_id" uuid,
	"merged_by" uuid,
	"state" text DEFAULT 'open' NOT NULL,
	"merge_sha" text,
	"comment" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "merge_requests_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "merge_requests_direction_check" CHECK (direction in ('to_env', 'to_main')),
	CONSTRAINT "merge_requests_state_check" CHECK (state in ('open', 'merged', 'rejected', 'superseded', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "release_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"repo_target_id" uuid NOT NULL,
	"provider_connector_id" uuid NOT NULL,
	"target_ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"test_branch_reviewers" jsonb DEFAULT '{"type":"assignee"}'::jsonb NOT NULL,
	"main_branch_reviewers" jsonb DEFAULT '{"type":"assignee"}'::jsonb NOT NULL,
	"env_deployer_rules" jsonb DEFAULT '{"test_gate":{"type":"assignee"},"production":{"type":"anyone"}}'::jsonb NOT NULL,
	"retest_policy" jsonb DEFAULT '{"type":"reporter"}'::jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "release_configs_ws_id_key" UNIQUE("workspace_id","id")
);
--> statement-breakpoint
CREATE TABLE "release_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_task_id" uuid NOT NULL,
	"node_run_id" uuid,
	"slot" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"command" text,
	"exit_code" integer,
	"error_summary" text,
	"log_tail" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "release_steps_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "release_steps_slot_check" CHECK (slot in ('build', 'publish', 'release', 'verify', 'notify')),
	CONSTRAINT "release_steps_status_check" CHECK (status in ('running', 'succeeded', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "release_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"seq_no" integer NOT NULL,
	"ticket_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"repo_target_id" uuid,
	"environment_id" uuid NOT NULL,
	"flow_instance_id" uuid,
	"node_run_id" uuid,
	"target_ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_branch" text NOT NULL,
	"tested_fix_head_sha" text,
	"status" text DEFAULT 'running' NOT NULL,
	"paused_reason" text,
	"version" text,
	"build_commit" text,
	"artifact_manifest" jsonb,
	"artifact_location" jsonb,
	"verified_revision" text,
	"triggered_by" uuid,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "release_tasks_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "release_tasks_status_check" CHECK (status in ('waiting_lock', 'waiting_human', 'running', 'paused', 'failed', 'effective_pending_retest', 'effective', 'retest_rejected', 'superseded', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "test_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_task_id" uuid NOT NULL,
	"version" text,
	"tester_id" uuid NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "test_records_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "test_records_result_check" CHECK (result in ('pending', 'passed', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "connectors" ADD COLUMN "parent_connector_id" uuid;--> statement-breakpoint
ALTER TABLE "repo_targets" ADD COLUMN "test_branch" text;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_merged_by_users_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_ticket_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "public"."tickets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_round_fk" FOREIGN KEY ("workspace_id","round_id") REFERENCES "public"."rounds"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_requests" ADD CONSTRAINT "merge_requests_repo_fk" FOREIGN KEY ("workspace_id","repo_id") REFERENCES "public"."repos"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_configs" ADD CONSTRAINT "release_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_configs" ADD CONSTRAINT "release_configs_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_configs" ADD CONSTRAINT "release_configs_target_fk" FOREIGN KEY ("workspace_id","repo_target_id") REFERENCES "public"."repo_targets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_configs" ADD CONSTRAINT "release_configs_provider_fk" FOREIGN KEY ("workspace_id","provider_connector_id") REFERENCES "public"."connectors"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_steps" ADD CONSTRAINT "release_steps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_steps" ADD CONSTRAINT "release_steps_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_steps" ADD CONSTRAINT "release_steps_task_fk" FOREIGN KEY ("workspace_id","release_task_id") REFERENCES "public"."release_tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_ticket_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "public"."tickets"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_env_fk" FOREIGN KEY ("workspace_id","environment_id") REFERENCES "public"."environments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tasks" ADD CONSTRAINT "release_tasks_repo_fk" FOREIGN KEY ("workspace_id","repo_id") REFERENCES "public"."repos"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_tester_id_users_id_fk" FOREIGN KEY ("tester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_task_fk" FOREIGN KEY ("workspace_id","release_task_id") REFERENCES "public"."release_tasks"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merge_requests_active_key" ON "merge_requests" USING btree ("ticket_id","repo_id","direction") WHERE state = 'open' and deleted_at is null;--> statement-breakpoint
CREATE INDEX "merge_requests_flow_idx" ON "merge_requests" USING btree ("flow_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_configs_target_key" ON "release_configs" USING btree ("repo_target_id") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "release_steps_task_idx" ON "release_steps" USING btree ("release_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "release_tasks_seq_key" ON "release_tasks" USING btree ("workspace_id","seq_no");--> statement-breakpoint
CREATE UNIQUE INDEX "release_tasks_running_key" ON "release_tasks" USING btree ("repo_id","environment_id") WHERE status = 'running' and deleted_at is null;--> statement-breakpoint
CREATE INDEX "release_tasks_ticket_idx" ON "release_tasks" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "test_records_task_key" ON "test_records" USING btree ("release_task_id") WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_parent_fk" FOREIGN KEY ("workspace_id","parent_connector_id") REFERENCES "public"."connectors"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_personal_key" ON "connectors" USING btree ("parent_connector_id","owner_user_id") WHERE parent_connector_id is not null and deleted_at is null;