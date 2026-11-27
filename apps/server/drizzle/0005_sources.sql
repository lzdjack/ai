CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"plugin_id" text NOT NULL,
	"category" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credential_class" text DEFAULT 'shared_readonly' NOT NULL,
	"scope" text DEFAULT 'workspace' NOT NULL,
	"owner_user_id" uuid,
	"status" text DEFAULT 'enabled' NOT NULL,
	"health_state" text DEFAULT 'ok' NOT NULL,
	"secret_id" uuid,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "connectors_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "connectors_scope_check" CHECK (scope in ('workspace', 'user')),
	CONSTRAINT "connectors_status_check" CHECK (status in ('enabled', 'disabled')),
	CONSTRAINT "connectors_personal_only_user" CHECK (not (credential_class = 'personal_exec' and scope <> 'user'))
);
--> statement-breakpoint
CREATE TABLE "credential_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"secret_id" uuid NOT NULL,
	"runner_key_id" uuid NOT NULL,
	"secret_class_snap" text NOT NULL,
	"target_key_role" text NOT NULL,
	"envelope" jsonb NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "credential_envelopes_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "credential_envelopes_key" UNIQUE("workspace_id","secret_id","runner_key_id"),
	CONSTRAINT "credential_envelopes_no_personal_to_bot" CHECK (not (secret_class_snap = 'personal_exec' and target_key_role = 'bot_exec'))
);
--> statement-breakpoint
CREATE TABLE "repo_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"package_dir" text DEFAULT '.' NOT NULL,
	"auto_detected_meta" jsonb,
	"manual_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"probe_state" text DEFAULT 'pending' NOT NULL,
	"probed_at" timestamp with time zone,
	"probe_notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "repo_targets_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "repo_targets_probe_check" CHECK (probe_state in ('pending', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_type" text DEFAULT 'connector' NOT NULL,
	"connector_id" uuid,
	"remote_repo_id" text,
	"local_path" text,
	"path" text NOT NULL,
	"clone_url" text NOT NULL,
	"access_mode" text DEFAULT 'read_only' NOT NULL,
	"default_branch" text NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "repos_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "repos_source_check" CHECK (source_type in ('connector', 'local')),
	CONSTRAINT "repos_access_check" CHECK (access_mode in ('read_write', 'read_only'))
);
--> statement-breakpoint
CREATE TABLE "secret_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"secret_id" uuid NOT NULL,
	"runner_id" uuid NOT NULL,
	"key_epoch" integer NOT NULL,
	"last_delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "secret_deliveries_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "secret_deliveries_key" UNIQUE("workspace_id","secret_id","runner_id")
);
--> statement-breakpoint
CREATE TABLE "secret_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"credential_class" text NOT NULL,
	"owner_user_id" uuid,
	"ciphertext" text,
	"wrapped_dek" text,
	"key_epoch" integer DEFAULT 1 NOT NULL,
	"rotation_state" text DEFAULT 'clean' NOT NULL,
	"hint" text DEFAULT '' NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "secret_items_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "secret_items_class_check" CHECK (credential_class in ('shared_readonly', 'workspace_secret', 'personal_exec', 'llm_gateway')),
	CONSTRAINT "secret_items_rotation_check" CHECK (rotation_state in ('clean', 'pending_dek_rotation', 'exposed_needs_reissue', 'revoked_purged'))
);
--> statement-breakpoint
ALTER TABLE "flow_instances" DROP CONSTRAINT "flow_instances_kind_check";--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_secret_fk" FOREIGN KEY ("workspace_id","secret_id") REFERENCES "public"."secret_items"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_envelopes" ADD CONSTRAINT "credential_envelopes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_envelopes" ADD CONSTRAINT "credential_envelopes_secret_fk" FOREIGN KEY ("workspace_id","secret_id") REFERENCES "public"."secret_items"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_envelopes" ADD CONSTRAINT "credential_envelopes_key_fk" FOREIGN KEY ("workspace_id","runner_key_id") REFERENCES "public"."runner_keys"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_targets" ADD CONSTRAINT "repo_targets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_targets" ADD CONSTRAINT "repo_targets_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_targets" ADD CONSTRAINT "repo_targets_repo_fk" FOREIGN KEY ("workspace_id","repo_id") REFERENCES "public"."repos"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_connector_fk" FOREIGN KEY ("workspace_id","connector_id") REFERENCES "public"."connectors"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_deliveries" ADD CONSTRAINT "secret_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_deliveries" ADD CONSTRAINT "secret_deliveries_runner_fk" FOREIGN KEY ("workspace_id","runner_id") REFERENCES "public"."runners"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_items" ADD CONSTRAINT "secret_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secret_items" ADD CONSTRAINT "secret_items_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repo_targets_key" ON "repo_targets" USING btree ("project_id","repo_id","package_dir") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "repo_targets_repo_idx" ON "repo_targets" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_remote_key" ON "repos" USING btree ("workspace_id","connector_id","remote_repo_id") WHERE connector_id is not null and deleted_at is null;--> statement-breakpoint
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_kind_check" CHECK (kind in ('round', 'delivery', 'bundle', 'eval', 'trial_build'));