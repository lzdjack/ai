CREATE TABLE "runner_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"runner_id" uuid NOT NULL,
	"key_role" text NOT NULL,
	"public_key" text NOT NULL,
	"key_fingerprint" text NOT NULL,
	"epoch" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "runner_keys_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "runner_keys_role_check" CHECK (key_role in ('bot_exec', 'release_exec')),
	CONSTRAINT "runner_keys_status_check" CHECK (status in ('active', 'draining', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "runners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid,
	"scope" text DEFAULT 'team' NOT NULL,
	"network_zone" text,
	"network_profile_id" uuid,
	"runner_roles" text[] DEFAULT '{bot}'::text[] NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"drain_mode" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"enroll_token_hash" text,
	"enroll_expires_at" timestamp with time zone,
	"auth_token_hash" text,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "runners_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "runners_scope_check" CHECK (scope in ('personal', 'team', 'cloud')),
	CONSTRAINT "runners_status_check" CHECK (status in ('pending', 'online', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "node_runs" ADD COLUMN "executor_id" uuid;--> statement-breakpoint
ALTER TABLE "node_runs" ADD COLUMN "structured_output" jsonb;--> statement-breakpoint
ALTER TABLE "runner_keys" ADD CONSTRAINT "runner_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runner_keys" ADD CONSTRAINT "runner_keys_runner_fk" FOREIGN KEY ("workspace_id","runner_id") REFERENCES "public"."runners"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runners" ADD CONSTRAINT "runners_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runner_keys_active_key" ON "runner_keys" USING btree ("runner_id","key_role") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "runners_enroll_token_key" ON "runners" USING btree (enroll_token_hash) WHERE enroll_token_hash is not null;