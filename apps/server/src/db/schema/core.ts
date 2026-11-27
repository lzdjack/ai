// Membership, counters, orchestration and side-effect tables (docs/06 §2.3, §2.5, §2.13).
// P1 keeps only the columns the platform skeleton uses; later steps add columns, not rewrites.
import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { enumCheck, projectTable, users, workspaceTable } from './tenant.ts';

const ts = () => timestamp({ withTimezone: true });
/** PostgreSQL xid8 (64-bit transaction id), read as a decimal string */
const xid8 = customType<{ data: string }>({ dataType: () => 'xid8' });

export const workspaceMembers = workspaceTable(
  'workspace_members',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    accountType: text().notNull().default('human'),
    status: text().notNull().default('active'),
    expiresAt: ts(),
    authzEpoch: integer().notNull().default(0),
  },
  (t) => [
    unique('workspace_members_user_key').on(t.workspaceId, t.userId),
    enumCheck('workspace_members_account_type_check', 'account_type', ['human', 'service']),
    enumCheck('workspace_members_status_check', 'status', ['active', 'disabled']),
  ],
  { definerAccess: true },
);

/** Per-workspace number dispenser (M-<seq>, R-<seq>): UPDATE … RETURNING, no gaps from races. */
export const workspaceCounters = workspaceTable(
  'workspace_counters',
  {
    counterType: text().notNull(),
    nextVal: bigint({ mode: 'number' }).notNull().default(1),
  },
  (t) => [unique('workspace_counters_type_key').on(t.workspaceId, t.counterType)],
  { audit: false },
);

export const FLOW_STATUSES = ['running', 'done', 'failed', 'cancelled'] as const;
export const NODE_STATUSES = [
  'pending',
  'running',
  'waiting_human',
  'done',
  'failed',
  'skipped',
  'skipped_inherited',
  'cancelled',
] as const;

export const flowInstances = projectTable(
  'flow_instances',
  {
    kind: text().notNull(),
    ticketId: uuid(),
    roundId: uuid(),
    parentRefType: text(),
    parentRefId: uuid(),
    workflowTemplateVersionId: uuid(),
    plan: jsonb().notNull(),
    planSchemaVersion: integer().notNull(),
    status: text().notNull().default('running'),
  },
  () => [
    enumCheck('flow_instances_kind_check', 'kind', [
      'round',
      'delivery',
      'bundle',
      'eval',
      'trial_build',
    ]),
    enumCheck('flow_instances_status_check', 'status', FLOW_STATUSES),
  ],
);

export const nodeRuns = projectTable(
  'node_runs',
  {
    flowInstanceId: uuid().notNull(),
    nodeKey: text().notNull(),
    nodeKind: text().notNull(),
    attemptNo: integer().notNull().default(1),
    /** per_repo fan-out (06 §5.1a); the repos table and its FK come with P3 */
    repoId: uuid(),
    runMode: text().notNull().default('full'),
    status: text().notNull().default('pending'),
    skipReason: text(),
    /** the runner that holds / held this run (06 §2.5 executor_id) */
    executorId: uuid(),
    structuredOutput: jsonb(),
    errorRaw: text(),
    startedAt: ts(),
    finishedAt: ts(),
  },
  (t) => [
    // composite FK keeps a node run inside its flow instance's workspace
    foreignKey({
      name: 'node_runs_flow_instance_fk',
      columns: [t.workspaceId, t.flowInstanceId],
      foreignColumns: [flowInstances.workspaceId, flowInstances.id],
    }),
    unique('node_runs_attempt_key')
      .on(t.flowInstanceId, t.nodeKey, t.attemptNo, t.repoId)
      .nullsNotDistinct(),
    enumCheck('node_runs_run_mode_check', 'run_mode', ['full', 'verify_only']),
    enumCheck('node_runs_status_check', 'status', NODE_STATUSES),
  ],
);

export const WORK_STATUSES = ['queued', 'leased', 'done', 'failed', 'cancelled'] as const;

/** The only task queue: timers and jobs for executors and background workers (06 §2.12). */
export const workItems = workspaceTable(
  'work_items',
  {
    kind: text().notNull(),
    singletonKey: text(),
    payload: jsonb().notNull().default({}),
    runAfter: ts().notNull().defaultNow(),
    attempts: integer().notNull().default(0),
    leaseToken: uuid(),
    leaseOwner: text(),
    leaseExpiresAt: ts(),
    fence: integer().notNull().default(0),
    status: text().notNull().default('queued'),
    lastError: text(),
  },
  (t) => [
    uniqueIndex('work_items_singleton_key')
      .on(t.workspaceId, t.singletonKey)
      .where(sql`status in ('queued', 'leased')`),
    index('work_items_due_idx')
      .on(t.runAfter)
      .where(sql`status = 'queued'`),
    enumCheck('work_items_status_check', 'status', WORK_STATUSES),
  ],
  { audit: false, definerAccess: true },
);

/** One external side effect, registered with an idempotency key before it runs (06 §3.6). */
export const effects = workspaceTable(
  'effects',
  {
    effectKey: text().notNull(),
    nodeRunId: uuid(),
    kind: text().notNull(),
    request: jsonb().notNull(),
    result: jsonb(),
    status: text().notNull().default('pending'),
    verifiedAt: ts(),
  },
  (t) => [
    unique('effects_key').on(t.workspaceId, t.effectKey),
    enumCheck('effects_status_check', 'status', ['pending', 'succeeded', 'failed', 'interrupted']),
  ],
  { audit: false },
);

/** Messages written in the same transaction and delivered after commit. */
export const outbox = workspaceTable(
  'outbox',
  {
    topic: text().notNull(),
    payload: jsonb().notNull(),
    attempts: integer().notNull().default(0),
    deliveredAt: ts(),
  },
  (t) => [
    index('outbox_pending_idx')
      .on(t.createdAt)
      .where(sql`delivered_at is null`),
  ],
  { audit: false },
);

/** Ordered changes pushed to clients; stream_seq is assigned after commit by the relay (06 §3.7). */
export const changeStream = workspaceTable(
  'change_stream',
  {
    streamSeq: bigint({ mode: 'number' }),
    entity: text().notNull(),
    entityId: uuid().notNull(),
    projectId: uuid(),
    op: text().notNull(),
    entityRev: integer().notNull(),
    row: jsonb(),
    authzEpoch: integer().notNull().default(0),
    /** set for rows only one user may see (their notifications); RLS filters on it */
    recipientUserId: uuid(),
  },
  (t) => [
    unique('change_stream_seq_key').on(t.workspaceId, t.streamSeq),
    index('change_stream_pending_idx')
      .on(t.createdAt)
      .where(sql`stream_seq is null`),
    enumCheck('change_stream_op_check', 'op', ['upsert', 'tombstone']),
  ],
  {
    audit: false,
    mixedProject: true,
    definerAccess: true,
    ownerColumn: 'recipient_user_id',
    ownerNullable: true,
  },
);

/** Written by a trigger on every audited table; each probe must have a matching event (06 §2.8). */
export const auditProbe = workspaceTable(
  'audit_probe',
  {
    tableName: text().notNull(),
    rowId: uuid().notNull(),
    actorUserId: uuid(),
    txid: xid8()
      .notNull()
      .default(sql`pg_current_xact_id()`),
  },
  (t) => [index('audit_probe_tx_idx').on(t.txid)],
  { audit: false, appendOnly: true, definerAccess: true },
);
