-- events：按月分区的不可变操作底账（06 §2.8）。drizzle-kit 不支持分区表，手写；Drizzle 定义见 src/db/events.ts
CREATE TABLE events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seq bigint GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  event_category text NOT NULL DEFAULT 'workflow' CHECK (event_category IN ('workflow', 'security_audit')),
  action_kind text NOT NULL CHECK (action_kind IN ('create', 'update', 'soft_delete', 'restore', 'version_switch', 'revert_patch', 'reorder', 'bind_change')),
  entity_type varchar(64) NOT NULL,
  entity_id uuid NOT NULL,
  entity_display text,
  scope_type text NOT NULL CHECK (scope_type IN ('workspace', 'project', 'org_unit', 'user')),
  scope_id uuid,
  project_id uuid,
  owner_user_id uuid,
  actor_user_id uuid,
  client_source text NOT NULL CHECK (client_source IN ('pc_ui', 'mobile_ui', 'global_ai', 'ticket_ai', 'api', 'system_sync')),
  sensitivity text NOT NULL DEFAULT 'normal',
  schema_version integer NOT NULL DEFAULT 1,
  before_snapshot jsonb,
  after_snapshot jsonb,
  changed_fields text[],
  revert_mode text NOT NULL DEFAULT 'non_revertible' CHECK (revert_mode IN ('soft_undelete', 'version_pointer', 'restore_before', 'non_revertible')),
  revert_block_reason text,
  revert_of_event_id uuid,
  batch_op_id uuid,
  request_id text,
  txid xid8 NOT NULL DEFAULT pg_current_xact_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
--> statement-breakpoint
CREATE TABLE events_default PARTITION OF events DEFAULT;
--> statement-breakpoint
CREATE INDEX events_entity_idx ON events (workspace_id, entity_type, entity_id, created_at);
--> statement-breakpoint
CREATE INDEX events_txid_idx ON events (txid);
--> statement-breakpoint
CREATE INDEX events_workspace_seq_idx ON events (workspace_id, seq);
