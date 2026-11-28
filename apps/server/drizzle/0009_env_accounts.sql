CREATE TABLE "env_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"role_name" text NOT NULL,
	"account_name" text,
	"credential_type" text NOT NULL,
	"secret_id" uuid NOT NULL,
	"data_permission" text DEFAULT 'read_only' NOT NULL,
	"login_state" text DEFAULT 'unchecked' NOT NULL,
	"login_at" timestamp with time zone,
	"login_error" text,
	"identity" text,
	"expires_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"rev" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "env_accounts_ws_id_key" UNIQUE("workspace_id","id"),
	CONSTRAINT "env_accounts_type_check" CHECK (credential_type in ('password', 'cookie')),
	CONSTRAINT "env_accounts_permission_check" CHECK (data_permission in ('read_only', 'read_write')),
	CONSTRAINT "env_accounts_login_check" CHECK (login_state in ('unchecked', 'ok', 'failed', 'expired', 'no_login'))
);
--> statement-breakpoint
ALTER TABLE "flow_instances" DROP CONSTRAINT "flow_instances_kind_check";--> statement-breakpoint
ALTER TABLE "env_accounts" ADD CONSTRAINT "env_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_accounts" ADD CONSTRAINT "env_accounts_project_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."projects"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_accounts" ADD CONSTRAINT "env_accounts_env_fk" FOREIGN KEY ("workspace_id","environment_id") REFERENCES "public"."environments"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "env_accounts" ADD CONSTRAINT "env_accounts_secret_fk" FOREIGN KEY ("workspace_id","secret_id") REFERENCES "public"."secret_items"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "env_accounts_env_idx" ON "env_accounts" USING btree ("environment_id");--> statement-breakpoint
ALTER TABLE "flow_instances" ADD CONSTRAINT "flow_instances_kind_check" CHECK (kind in ('round', 'delivery', 'bundle', 'eval', 'trial_build', 'health_check'));