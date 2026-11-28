// Tickets, rounds and what a round delivered (docs/06 §2.5, §2.4 environments, §3.1, §3.2, §5.7).
// P4 keeps the columns the first delivery round uses; later steps add columns, not rewrites.
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { enumCheck, projectTable, users } from './tenant.ts';
import { repos } from './sources.ts';
import { TICKET_STATUSES, ROUND_STATUSES } from '@cloudcraft/core-protocol';

export const environments = projectTable(
  'environments',
  {
    envCode: text().notNull(),
    envTier: text().notNull(),
    name: text().notNull(),
    entryUrl: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex('environments_code_key')
      .on(t.projectId, t.envCode)
      .where(sql`deleted_at is null`),
    enumCheck('environments_tier_check', 'env_tier', ['dev', 'test_gate', 'production']),
  ],
);

export const tickets = projectTable(
  'tickets',
  {
    sourceType: text().notNull().default('manual'),
    connectorId: uuid(),
    externalId: text(),
    deliveryKey: text().notNull().default(''),
    /** M-<seq_no>, from workspace_counters */
    seqNo: integer(),
    title: text().notNull(),
    body: text().notNull().default(''),
    priority: text().notNull().default('P2'),
    reproSteps: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    status: text().notNull().default('pending'),
    closeReason: text(),
    currentRound: integer().notNull().default(0),
    createdBy: uuid().references(() => users.id),
  },
  (t) => [
    uniqueIndex('tickets_seq_key')
      .on(t.workspaceId, t.seqNo)
      .where(sql`seq_no is not null`),
    uniqueIndex('tickets_external_key')
      .on(t.workspaceId, t.connectorId, t.externalId, t.deliveryKey)
      .where(sql`external_id is not null`),
    enumCheck('tickets_source_check', 'source_type', ['connector', 'manual', 'system']),
    enumCheck('tickets_status_check', 'status', TICKET_STATUSES),
  ],
);

export const ticketAssignees = projectTable(
  'ticket_assignees',
  {
    ticketId: uuid().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    source: text().notNull().default('manual'),
  },
  (t) => [
    foreignKey({
      name: 'ticket_assignees_ticket_fk',
      columns: [t.workspaceId, t.ticketId],
      foreignColumns: [tickets.workspaceId, tickets.id],
    }),
    unique('ticket_assignees_key').on(t.ticketId, t.userId),
    enumCheck('ticket_assignees_source_check', 'source', ['auto', 'manual', 'temp_override']),
  ],
);

export const rounds = projectTable(
  'rounds',
  {
    ticketId: uuid().notNull(),
    roundNo: integer().notNull(),
    cause: text().notNull().default('new'),
    status: text().notNull().default('queued'),
    executorType: text().notNull().default('bot'),
    fenceToken: integer().notNull().default(1),
    flowInstanceId: uuid(),
    queueReason: text(),
    /** why the round needs help (machine gate, fact mismatch, engine stop …) */
    helpReason: text(),
    deliveryMode: text(),
    deliveryPayload: jsonb(),
    deliveryDigest: text(),
    riskLevel: text(),
    reviewRev: integer().notNull().default(0),
  },
  (t) => [
    foreignKey({
      name: 'rounds_ticket_fk',
      columns: [t.workspaceId, t.ticketId],
      foreignColumns: [tickets.workspaceId, tickets.id],
    }),
    unique('rounds_no_key').on(t.ticketId, t.roundNo),
    uniqueIndex('rounds_active_key')
      .on(t.ticketId)
      .where(sql`status in ('queued', 'fixing', 'needs_help') and deleted_at is null`),
    index('rounds_flow_idx').on(t.flowInstanceId),
    enumCheck('rounds_status_check', 'status', ROUND_STATUSES),
    enumCheck('rounds_cause_check', 'cause', [
      'new',
      'code_rejected',
      'test_rejected',
      'mr_rejected',
      'main_conflict',
      'manual_restart',
      'contract_updated',
    ]),
    enumCheck('rounds_risk_check', 'risk_level', ['L0', 'L1', 'L2']),
  ],
);

export const roundRepoSlices = projectTable(
  'round_repo_slices',
  {
    roundId: uuid().notNull(),
    repoId: uuid().notNull(),
    branch: text().notNull(),
    startSha: text().notNull(),
    headSha: text().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'round_repo_slices_round_fk',
      columns: [t.workspaceId, t.roundId],
      foreignColumns: [rounds.workspaceId, rounds.id],
    }),
    foreignKey({
      name: 'round_repo_slices_repo_fk',
      columns: [t.workspaceId, t.repoId],
      foreignColumns: [repos.workspaceId, repos.id],
    }),
    unique('round_repo_slices_key').on(t.roundId, t.repoId),
  ],
);

/** One host replay verdict (06 §5.7); the fingerprints decide later whether the bot touched them. */
export const verifyRuns = projectTable(
  'verify_runs',
  {
    roundId: uuid().notNull(),
    nodeRunId: uuid(),
    verdict: jsonb().notNull(),
    digests: jsonb().notNull().default({}),
    passed: boolean().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'verify_runs_round_fk',
      columns: [t.workspaceId, t.roundId],
      foreignColumns: [rounds.workspaceId, rounds.id],
    }),
  ],
);

/**
 * The review of a round (06 §2.5): one per round — PC and phone, or two assignees, at the same time:
 * whoever writes first wins. The text shown to the reviewer is kept as it was (06 §13.6 item 1).
 */
export const reviews = projectTable(
  'reviews',
  {
    roundId: uuid().notNull(),
    deliveryDigest: text().notNull(),
    reviewRev: integer().notNull(),
    result: text().notNull(),
    reviewerId: uuid()
      .notNull()
      .references(() => users.id),
    selfDelivery: boolean().notNull().default(false),
    comment: text(),
    rejectCategory: text(),
    riskLevel: text(),
    location: jsonb(),
    textSnapshot: text(),
  },
  (t) => [
    foreignKey({
      name: 'reviews_round_fk',
      columns: [t.workspaceId, t.roundId],
      foreignColumns: [rounds.workspaceId, rounds.id],
    }),
    unique('reviews_round_key').on(t.roundId),
    enumCheck('reviews_result_check', 'result', ['approved', 'rejected']),
  ],
);

/**
 * Evidence files of a node run (06 §2.5, §6.2): screenshots of the host replay so far. M1 keeps the
 * file on the server's disk under the workspace; the row says where and whether it is still there.
 */
export const evidences = projectTable(
  'evidences',
  {
    roundId: uuid(),
    nodeRunId: uuid().notNull(),
    kind: text().notNull().default('screenshot'),
    name: text().notNull(),
    sha256: text().notNull(),
    contentType: text().notNull(),
    sizeBytes: integer().notNull(),
    storageState: text().notNull().default('active'),
    visibilityScope: text().notNull().default('project_only'),
  },
  (t) => [
    unique('evidences_run_name_key').on(t.nodeRunId, t.name),
    index('evidences_round_idx').on(t.roundId),
    enumCheck('evidences_storage_check', 'storage_state', ['active', 'purged_by_ttl']),
  ],
);
