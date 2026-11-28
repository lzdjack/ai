// The delivery segment (docs/06 §2.6, §3.3, §2.4 release_configs): what cr_merge, release_deploy and
// the retest gate of a delivery flow produce. node_runs stay the progress; these are the records.
import { MR_STATES, RELEASE_SLOTS, RELEASE_STATUSES } from '@cloudcraft/core-protocol';
import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { connectors, repoTargets, repos } from './sources.ts';
import { enumCheck, projectTable, users } from './tenant.ts';
import { environments, rounds, tickets } from './tickets.ts';

const ts = () => timestamp({ withTimezone: true });

/**
 * Who may do a delivery action (06 §2.4 unified policy): the ticket's assignee, anyone holding the
 * permission in scope, named people, or the reporter (retest default). Stored as JSON, checked by
 * the delivery service through ActionGate, never by role name.
 */
export interface ActorPolicy {
  type: 'assignee' | 'anyone' | 'users' | 'reporter';
  users?: string[];
}

/** Release settings of one target (06 §2.4): which provider, where the target lives there, who does what. */
export const releaseConfigs = projectTable(
  'release_configs',
  {
    repoTargetId: uuid().notNull(),
    providerConnectorId: uuid().notNull(),
    /** provider-side target (app id, config key, artifact location, env code map) */
    targetRef: jsonb().notNull().default({}),
    testBranchReviewers: jsonb().$type<ActorPolicy>().notNull().default({ type: 'assignee' }),
    mainBranchReviewers: jsonb().$type<ActorPolicy>().notNull().default({ type: 'assignee' }),
    /** by env tier: who releases to test (default the assignee) and to production (default anyone) */
    envDeployerRules: jsonb()
      .$type<Record<string, ActorPolicy>>()
      .notNull()
      .default({ test_gate: { type: 'assignee' }, production: { type: 'anyone' } }),
    retestPolicy: jsonb().$type<ActorPolicy>().notNull().default({ type: 'reporter' }),
  },
  (t) => [
    foreignKey({
      name: 'release_configs_target_fk',
      columns: [t.workspaceId, t.repoTargetId],
      foreignColumns: [repoTargets.workspaceId, repoTargets.id],
    }),
    foreignKey({
      name: 'release_configs_provider_fk',
      columns: [t.workspaceId, t.providerConnectorId],
      foreignColumns: [connectors.workspaceId, connectors.id],
    }),
    uniqueIndex('release_configs_target_key')
      .on(t.repoTargetId)
      .where(sql`deleted_at is null`),
  ],
);

/** One change request (06 §2.6): fix/ → test branch (to_env) or → main (to_main). */
export const mergeRequests = projectTable(
  'merge_requests',
  {
    ticketId: uuid().notNull(),
    roundId: uuid().notNull(),
    repoId: uuid().notNull(),
    flowInstanceId: uuid(),
    nodeRunId: uuid(),
    direction: text().notNull(),
    environmentId: uuid(),
    externalIid: text(),
    webUrl: text(),
    sourceBranch: text().notNull(),
    targetBranch: text().notNull(),
    /** source head when the MR was opened / last seen: the reviewer approves exactly this */
    headSha: text(),
    reviewerId: uuid().references(() => users.id),
    /** whose own account merges: the approving reviewer, or whoever clicked retry (06 §7.4 item 1) */
    mergedBy: uuid().references(() => users.id),
    state: text().notNull().default('open'),
    mergeSha: text(),
    comment: text(),
  },
  (t) => [
    foreignKey({
      name: 'merge_requests_ticket_fk',
      columns: [t.workspaceId, t.ticketId],
      foreignColumns: [tickets.workspaceId, tickets.id],
    }),
    foreignKey({
      name: 'merge_requests_round_fk',
      columns: [t.workspaceId, t.roundId],
      foreignColumns: [rounds.workspaceId, rounds.id],
    }),
    foreignKey({
      name: 'merge_requests_repo_fk',
      columns: [t.workspaceId, t.repoId],
      foreignColumns: [repos.workspaceId, repos.id],
    }),
    // one active MR per ticket, repo and direction (06 §6.3)
    uniqueIndex('merge_requests_active_key')
      .on(t.ticketId, t.repoId, t.direction)
      .where(sql`state = 'open' and deleted_at is null`),
    index('merge_requests_flow_idx').on(t.flowInstanceId),
    enumCheck('merge_requests_direction_check', 'direction', ['to_env', 'to_main']),
    enumCheck('merge_requests_state_check', 'state', MR_STATES),
  ],
);

/** One release of one target to one environment (06 §2.6, §3.3). */
export const releaseTasks = projectTable(
  'release_tasks',
  {
    /** R-<seq_no>, from workspace_counters */
    seqNo: integer().notNull(),
    ticketId: uuid().notNull(),
    roundId: uuid().notNull(),
    repoId: uuid().notNull(),
    repoTargetId: uuid(),
    environmentId: uuid().notNull(),
    flowInstanceId: uuid(),
    nodeRunId: uuid(),
    targetRef: jsonb().notNull().default({}),
    sourceBranch: text().notNull(),
    /** the fix/ head that was reviewed (and, for production, retested) */
    testedFixHeadSha: text(),
    status: text().notNull().default('running'),
    pausedReason: text(),
    version: text(),
    buildCommit: text(),
    /** craft build output: [{path, sha256, size}] */
    artifactManifest: jsonb(),
    /** where craft publish put it (provider's own shape) */
    artifactLocation: jsonb(),
    verifiedRevision: text(),
    /** whoever clicked release or the last retry: their account is used (06 §7.4 item 1) */
    triggeredBy: uuid().references(() => users.id),
  },
  (t) => [
    foreignKey({
      name: 'release_tasks_ticket_fk',
      columns: [t.workspaceId, t.ticketId],
      foreignColumns: [tickets.workspaceId, tickets.id],
    }),
    foreignKey({
      name: 'release_tasks_env_fk',
      columns: [t.workspaceId, t.environmentId],
      foreignColumns: [environments.workspaceId, environments.id],
    }),
    foreignKey({
      name: 'release_tasks_repo_fk',
      columns: [t.workspaceId, t.repoId],
      foreignColumns: [repos.workspaceId, repos.id],
    }),
    uniqueIndex('release_tasks_seq_key').on(t.workspaceId, t.seqNo),
    // serial lock (06 §7.3): one running release per target and environment
    uniqueIndex('release_tasks_running_key')
      .on(t.repoId, t.environmentId)
      .where(sql`status = 'running' and deleted_at is null`),
    index('release_tasks_ticket_idx').on(t.ticketId),
    enumCheck('release_tasks_status_check', 'status', RELEASE_STATUSES),
  ],
);

/** One craft command of a release (06 §2.6). */
export const releaseSteps = projectTable(
  'release_steps',
  {
    releaseTaskId: uuid().notNull(),
    nodeRunId: uuid(),
    slot: text().notNull(),
    status: text().notNull().default('running'),
    /** the command as shown, credentials replaced by *** */
    command: text(),
    exitCode: integer(),
    errorSummary: text(),
    logTail: text(),
    attempt: integer().notNull().default(1),
    startedAt: ts().notNull().defaultNow(),
    finishedAt: ts(),
  },
  (t) => [
    foreignKey({
      name: 'release_steps_task_fk',
      columns: [t.workspaceId, t.releaseTaskId],
      foreignColumns: [releaseTasks.workspaceId, releaseTasks.id],
    }),
    index('release_steps_task_idx').on(t.releaseTaskId),
    enumCheck('release_steps_slot_check', 'slot', RELEASE_SLOTS),
    enumCheck('release_steps_status_check', 'status', [
      'running',
      'succeeded',
      'failed',
      'skipped',
    ]),
  ],
);

/** One retest of a version on the test environment (06 §2.6, §3.4): bound to the version, not the ticket. */
export const testRecords = projectTable(
  'test_records',
  {
    releaseTaskId: uuid().notNull(),
    version: text(),
    testerId: uuid()
      .notNull()
      .references(() => users.id),
    result: text().notNull().default('pending'),
    comment: text(),
    decidedAt: ts(),
  },
  (t) => [
    foreignKey({
      name: 'test_records_task_fk',
      columns: [t.workspaceId, t.releaseTaskId],
      foreignColumns: [releaseTasks.workspaceId, releaseTasks.id],
    }),
    uniqueIndex('test_records_task_key')
      .on(t.releaseTaskId)
      .where(sql`deleted_at is null`),
    enumCheck('test_records_result_check', 'result', ['pending', 'passed', 'rejected']),
  ],
);
