// The delivery segment of a ticket (docs/06 §3.3, §2.6, §6.3–§6.5, §7.1–§7.4; 05 steps 5–12).
//
// 「发布到测试环境」 starts one delivery flow for the approved round. Its frozen plan is the built-in
// template's delivery segment, one node per step so every step has its own node run, its own
// executor and its own retry (06 §3.3 table, compiled):
//
//   test:   MR open (cc-sys) → MR review (person) → merge (release executor, reviewer's account)
//           → build (build sandbox) → publish → release → verify (release executor, clicker's
//           account) → notify (cc-sys)
//   retest: the tester passes or sends back
//   main:   the assignee asks to merge back → MR open → review → merge
//   prod:   a production releaser clicks (three gates computed now) → build on main → publish →
//           release → verify → notify
//
// Steps with outside effects never retry by themselves: a failure holds the flow until a person
// clicks 「从这一步重试」 (advance() hold_on_fail), and the retry reads back first.
// Sending back (MR or retest) cancels the flow and starts the next round on the same fix/ branch.
import {
  grants,
  type DeliveryNodeView,
  type DeliveryView,
  type MergeReviewRequest,
  type RetestRequest,
  type RetryDeliveryRequest,
  type StartTestReleaseRequest,
} from '@cloudcraft/core-protocol';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  SNAPSHOT_READ,
  withLeaseTx,
  type ActorCtx,
  type Db,
  type Lease,
  type Tx,
} from '../db/client.ts';
import {
  environments,
  flowInstances,
  mergeRequests,
  nodeRuns,
  projects,
  releaseConfigs,
  releaseSteps,
  releaseTasks,
  repoTargets,
  repos,
  reviews,
  roundRepoSlices,
  rounds,
  testRecords,
  ticketAssignees,
  tickets,
  users,
  type ActorPolicy,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan, type PlanNode } from '../orchestrator/advance.ts';
import { RUN_NODE, pgOrchestrator } from '../orchestrator/flow.ts';
import { claimWork, completeWork } from '../orchestrator/queue.ts';
import { publish } from './changes.ts';
import { ApiFailure, pgCode } from './errors.ts';
import { tr } from './i18n.ts';
import { inWorkspace, notify, permissionsOf } from './iam-service.ts';
import { personalAccountOf } from './personal-accounts.ts';
import { opened, projectRepoSpecs, type SourceSettings } from './source-service.ts';
import { restartRound, ticketNo, ticketSummary } from './ticket-service.ts';

export type Stage = 'test' | 'retest' | 'main' | 'production';

/** What a delivery node's frozen config holds (one target repo in M1; bundles come later, 06 §7.4.3). */
export interface DeliveryNodeConfig {
  stage: Stage;
  step?: 'open' | 'review' | 'merge' | 'request';
  slot?: 'build' | 'publish' | 'release' | 'verify' | 'notify';
  /** cr_merge direction */
  direction?: 'to_env' | 'to_main';
  repo_id: string;
  /** the environment of this stage */
  env_id: string | null;
  release_config_id: string;
  tester_id?: string;
}

export const cfgOf = (n: PlanNode | undefined) =>
  (n?.config ?? {}) as unknown as DeliveryNodeConfig;

const RELEASE_SLOTS = ['build', 'publish', 'release', 'verify', 'notify'] as const;

function compileDelivery(o: {
  repos: Plan['repos'];
  base: Omit<DeliveryNodeConfig, 'stage' | 'env_id'>;
  testEnvId: string;
  prodEnvId: string | null;
  testerId: string;
}): Plan {
  const node = (
    key: string,
    kind: 'auto' | 'human',
    nodeKind: string,
    c: Partial<DeliveryNodeConfig> & { stage: Stage },
  ): PlanNode => ({
    key,
    kind,
    node_kind: nodeKind,
    config: {
      ...o.base,
      env_id: c.stage === 'production' || c.stage === 'main' ? o.prodEnvId : o.testEnvId,
      ...c,
    },
    // every automatic step waits for a person when it fails (06 §3.3)
    ...(kind === 'auto' ? { hold_on_fail: true } : {}),
  });
  const mr = (prefix: string, stage: Stage, direction: 'to_env' | 'to_main') => [
    node(`${prefix}_mr_open`, 'auto', 'cr_merge', { stage, step: 'open', direction }),
    node(`${prefix}_mr_review`, 'human', 'cr_merge', { stage, step: 'review', direction }),
    node(`${prefix}_mr_merge`, 'auto', 'cr_merge', { stage, step: 'merge', direction }),
  ];
  const release = (prefix: string, stage: Stage) =>
    RELEASE_SLOTS.map((slot) =>
      node(`${prefix}_${slot}`, 'auto', 'release_deploy', { stage, slot }),
    );
  return {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: o.repos,
    nodes: [
      ...mr('test', 'test', 'to_env'),
      ...release('test', 'test'),
      node('retest', 'human', 'human_gate', { stage: 'retest', tester_id: o.testerId }),
      node('main_request', 'human', 'cr_merge', { stage: 'main', step: 'request' }),
      ...mr('main', 'main', 'to_main'),
      node('prod_request', 'human', 'release_deploy', { stage: 'production', step: 'request' }),
      ...release('prod', 'production'),
    ],
  };
}

const releaseNo = (seq: number) => `R-${seq}`;

async function nextReleaseNo(tx: Tx, workspaceId: string): Promise<number> {
  const r = await tx.execute<{ n: number }>(sql`
    insert into workspace_counters (workspace_id, counter_type, next_val)
    values (${workspaceId}::uuid, 'release', 2)
    on conflict (workspace_id, counter_type) do update set next_val = workspace_counters.next_val + 1
    returning (next_val - 1)::int as n`);
  return r.rows[0]!.n;
}

/** The ticket's latest delivery flow (one per approved round; a send-back cancels it). */
async function latestFlow(tx: Tx, ticketId: string) {
  const [f] = await tx
    .select()
    .from(flowInstances)
    .where(and(eq(flowInstances.ticketId, ticketId), eq(flowInstances.kind, 'delivery')))
    .orderBy(desc(flowInstances.createdAt))
    .limit(1);
  return f ?? null;
}

async function lockedTicket(tx: Tx, id: string) {
  const [t] = await tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
    .for('update');
  if (!t) throw new ApiFailure(404, 'ticket.not_found');
  return t;
}

/** The waiting human node of the ticket's running delivery flow with this key prefix / key. */
async function waitingNode(tx: Tx, flowId: string, key: (k: string) => boolean) {
  const runs = await tx
    .select()
    .from(nodeRuns)
    .where(and(eq(nodeRuns.flowInstanceId, flowId), eq(nodeRuns.status, 'waiting_human')));
  return runs.find((r) => key(r.nodeKey)) ?? null;
}

/**
 * The unified actor policy (06 §2.4) through ActionGate: assignee, anyone holding `permission`,
 * named people, or the reporter. Never by role name.
 */
async function allowed(
  tx: Tx,
  userId: string,
  policy: ActorPolicy,
  ticket: typeof tickets.$inferSelect,
  permission: string,
) {
  if (policy.type === 'users') return (policy.users ?? []).includes(userId);
  if (policy.type === 'reporter') return ticket.createdBy === userId;
  if (policy.type === 'anyone') return grants(await permissionsOf(tx, userId), permission);
  const [a] = await tx
    .select({ id: ticketAssignees.id })
    .from(ticketAssignees)
    .where(and(eq(ticketAssignees.ticketId, ticket.id), eq(ticketAssignees.userId, userId)));
  return !!a;
}

async function releaseConfig(tx: Tx, id: string) {
  const [rc] = await tx.select().from(releaseConfigs).where(eq(releaseConfigs.id, id));
  if (!rc) throw new ApiFailure(409, 'delivery.no_release_config');
  return rc;
}

/** 409 with the connectors the caller must add their own account to (01 PC-第一次发布-配账号). */
async function needAccount(tx: Tx, userId: string, connectorIds: (string | null)[]) {
  const missing: string[] = [];
  for (const id of connectorIds)
    if (id && !(await personalAccountOf(tx, id, userId))) missing.push(id);
  if (missing.length)
    throw new ApiFailure(409, 'delivery.account_missing', { connector_ids: missing });
}

async function touchTicket(tx: Tx, ctx: ActorCtx, t: typeof tickets.$inferSelect) {
  const fresh = await updateRow(tx, ctx, tickets, t.id, {} as never);
  await publish(tx, ctx, {
    entity: 'ticket',
    entityId: fresh.id,
    op: 'upsert',
    rev: fresh.rev,
    projectId: fresh.projectId,
    row: ticketSummary(fresh),
  });
}

async function notifyAll(
  tx: Tx,
  ctx: ActorCtx,
  userIds: string[],
  n: {
    event: string;
    key: string;
    ticket: typeof tickets.$inferSelect;
    title: string;
    body?: string;
  },
) {
  for (const u of new Set(userIds))
    await notify(tx, ctx, u, {
      eventType: n.event,
      dedupeKey: `${n.key}:${u}`,
      refType: 'ticket',
      refId: n.ticket.id,
      title: n.title,
      body: n.body ?? n.ticket.title,
    });
}

async function assigneesOf(tx: Tx, ticketId: string) {
  return (
    await tx
      .select({ u: ticketAssignees.userId })
      .from(ticketAssignees)
      .where(eq(ticketAssignees.ticketId, ticketId))
  ).map((x) => x.u);
}

/** The release task of a flow and stage (test / production). */
export async function stageTask(tx: Tx, flowId: string, envId: string | null) {
  if (!envId) return null;
  const [rt] = await tx
    .select()
    .from(releaseTasks)
    .where(and(eq(releaseTasks.flowInstanceId, flowId), eq(releaseTasks.environmentId, envId)))
    .orderBy(desc(releaseTasks.createdAt))
    .limit(1);
  return rt ?? null;
}

// ---------- 5 发起发测试 ----------

export function startTestRelease(
  db: Db,
  userId: string,
  ws: string,
  ticketId: string,
  req: StartTestReleaseRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const running = await latestFlow(tx, t.id);
    // the same click from another device lands on the same task
    if (running?.status === 'running') {
      const [r] = await tx.select().from(rounds).where(eq(rounds.id, running.roundId!));
      if (r?.roundNo === req.round_no) return { flow_id: running.id };
      throw new ApiFailure(409, 'delivery.already_running');
    }
    if (t.status !== 'approved' || t.currentRound !== req.round_no)
      throw new ApiFailure(409, 'delivery.not_approved');
    const [round] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.ticketId, t.id), eq(rounds.roundNo, req.round_no)));
    const [rv] = round ? await tx.select().from(reviews).where(eq(reviews.roundId, round.id)) : [];
    if (!round || rv?.result !== 'approved') throw new ApiFailure(409, 'delivery.not_approved');
    const slices = await tx
      .select({ s: roundRepoSlices, r: repos })
      .from(roundRepoSlices)
      .innerJoin(repos, eq(repos.id, roundRepoSlices.repoId))
      .where(eq(roundRepoSlices.roundId, round.id));
    // M1 delivers one target; a change across repos is a bundle (06 §7.4 item 3, not yet)
    if (slices.length !== 1) throw new ApiFailure(409, 'delivery.multi_repo_not_supported');
    const slice = slices[0]!;
    const [target] = await tx
      .select()
      .from(repoTargets)
      .where(
        and(
          eq(repoTargets.projectId, t.projectId),
          eq(repoTargets.repoId, slice.r.id),
          isNull(repoTargets.deletedAt),
        ),
      );
    const [rc] = target
      ? await tx
          .select()
          .from(releaseConfigs)
          .where(and(eq(releaseConfigs.repoTargetId, target.id), isNull(releaseConfigs.deletedAt)))
      : [];
    if (!target || !rc) throw new ApiFailure(409, 'delivery.no_release_config');
    if (!target.testBranch) throw new ApiFailure(409, 'delivery.no_test_branch');
    const envs = await tx
      .select()
      .from(environments)
      .where(and(eq(environments.projectId, t.projectId), isNull(environments.deletedAt)))
      .orderBy(asc(environments.sortOrder), asc(environments.createdAt));
    const testEnv = req.environment_id
      ? envs.find((e) => e.id === req.environment_id && e.envTier === 'test_gate')
      : envs.find((e) => e.envTier === 'test_gate');
    if (!testEnv) throw new ApiFailure(409, 'delivery.no_test_environment');
    const prodEnv = envs.find((e) => e.envTier === 'production') ?? null;
    if (
      !(await allowed(
        tx,
        userId,
        rc.envDeployerRules.test_gate ?? { type: 'assignee' },
        t,
        'core:releases:run',
      ))
    )
      throw new ApiFailure(403, 'delivery.not_allowed');
    // the release runs with the clicker's own account on the provider (06 §7.4 item 1)
    await needAccount(tx, userId, [rc.providerConnectorId]);
    const testerId = req.tester_id ?? t.createdBy ?? userId;

    const plan = compileDelivery({
      repos: await projectRepoSpecs(tx, t.projectId),
      base: { repo_id: slice.r.id, release_config_id: rc.id },
      testEnvId: testEnv.id,
      prodEnvId: prodEnv?.id ?? null,
      testerId,
    });
    const task = await insertRow(tx, ctx, releaseTasks, {
      projectId: t.projectId,
      seqNo: await nextReleaseNo(tx, ctx.workspaceId),
      ticketId: t.id,
      roundId: round.id,
      repoId: slice.r.id,
      repoTargetId: target.id,
      environmentId: testEnv.id,
      targetRef: rc.targetRef,
      sourceBranch: target.testBranch,
      testedFixHeadSha: slice.s.headSha,
      // waits for the MR review first; takes the serial lock only when it builds (06 §7.3)
      status: 'waiting_human',
      triggeredBy: userId,
    });
    const flowId = await pgOrchestrator.startFlow(tx, ctx, {
      projectId: t.projectId,
      kind: 'delivery',
      plan,
    });
    await updateRow(tx, ctx, flowInstances, flowId, { ticketId: t.id, roundId: round.id } as never);
    await updateRow(tx, ctx, releaseTasks, task.id, { flowInstanceId: flowId } as never);
    await touchTicket(tx, ctx, t);
    return { flow_id: flowId, release_task_id: task.id, release_no: releaseNo(task.seqNo) };
  });
}

// ---------- 6 / 10 MR 审核 ----------

export function reviewMerge(
  db: Db,
  userId: string,
  ws: string,
  ticketId: string,
  req: MergeReviewRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const flow = await latestFlow(tx, t.id);
    if (flow?.status !== 'running') throw new ApiFailure(409, 'delivery.not_running');
    const gate = await waitingNode(tx, flow.id, (k) => k.endsWith('_mr_review'));
    if (!gate) throw new ApiFailure(409, 'merge.not_waiting');
    const node = (flow.plan as Plan).nodes.find((n) => n.key === gate.nodeKey)!;
    const c = cfgOf(node);
    const [mr] = await tx
      .select()
      .from(mergeRequests)
      .where(
        and(
          eq(mergeRequests.flowInstanceId, flow.id),
          eq(mergeRequests.direction, c.direction!),
          eq(mergeRequests.state, 'open'),
        ),
      );
    if (!mr) throw new ApiFailure(409, 'merge.not_waiting');
    const rc = await releaseConfig(tx, c.release_config_id);
    const policy = c.direction === 'to_main' ? rc.mainBranchReviewers : rc.testBranchReviewers;
    if (!(await allowed(tx, userId, policy, t, 'core:tickets:review')))
      throw new ApiFailure(403, 'merge.not_reviewer');
    // the head the reviewer saw; a newer push means looking again (06 §6.3)
    if (mr.headSha !== req.expected_head_sha) throw new ApiFailure(409, 'merge.head_changed');
    const comment = req.comment?.trim() ?? '';
    if (req.decision === 'approve') {
      const [repo] = await tx.select().from(repos).where(eq(repos.id, mr.repoId));
      // merging uses the reviewer's own code-source account (06 §6.1, Plane B)
      await needAccount(tx, userId, [repo?.connectorId ?? null]);
      await updateRow(tx, ctx, mergeRequests, mr.id, {
        reviewerId: userId,
        mergedBy: userId,
        comment: comment || null,
      } as never);
      await pgOrchestrator.signal(tx, ctx, flow.id, {
        type: 'node_finished',
        nodeRunId: gate.id,
        outcome: 'done',
      });
      await touchTicket(tx, ctx, t);
      return { ok: true };
    }
    if (!comment) throw new ApiFailure(400, 'review.comment_required');
    await updateRow(tx, ctx, mergeRequests, mr.id, {
      reviewerId: userId,
      state: 'rejected',
      comment,
    } as never);
    await sendBack(tx, ctx, t, flow, 'mr_rejected', comment);
    return { ok: true };
  });
}

/**
 * MR or retest sent back (06 §3.1 审核通过 → 打回重修): the flow ends, unstarted release tasks are
 * cancelled, and the next round starts on the same fix/ branch with the comment.
 */
async function sendBack(
  tx: Tx,
  ctx: ActorCtx,
  t: typeof tickets.$inferSelect,
  flow: typeof flowInstances.$inferSelect,
  cause: 'mr_rejected' | 'test_rejected',
  comment: string,
) {
  await pgOrchestrator.signal(tx, ctx, flow.id, { type: 'cancel' });
  const tasks = await tx
    .select()
    .from(releaseTasks)
    .where(
      and(
        eq(releaseTasks.flowInstanceId, flow.id),
        inArray(releaseTasks.status, ['waiting_human', 'waiting_lock', 'failed', 'running']),
      ),
    );
  for (const rt of tasks)
    await updateRow(tx, ctx, releaseTasks, rt.id, { status: 'cancelled' } as never);
  await restartRound(tx, ctx, t, { cause, comment, roundId: flow.roundId! });
}

// ---------- 9 复测 ----------

export function retest(db: Db, userId: string, ws: string, ticketId: string, req: RetestRequest) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const flow = await latestFlow(tx, t.id);
    if (flow?.status !== 'running') throw new ApiFailure(409, 'delivery.not_running');
    const gate = await waitingNode(tx, flow.id, (k) => k === 'retest');
    if (!gate) throw new ApiFailure(409, 'retest.not_waiting');
    const [rec] = await tx
      .select()
      .from(testRecords)
      .where(
        and(eq(testRecords.releaseTaskId, req.release_task_id), eq(testRecords.result, 'pending')),
      );
    if (!rec) throw new ApiFailure(409, 'retest.not_waiting');
    // only this version's tester (05 step 9)
    if (rec.testerId !== userId) throw new ApiFailure(403, 'retest.not_tester');
    const [rt] = await tx.select().from(releaseTasks).where(eq(releaseTasks.id, rec.releaseTaskId));
    if (rt?.flowInstanceId !== flow.id) throw new ApiFailure(409, 'retest.not_waiting');
    // a version that was overwritten by another release cannot be passed (06 §3.3)
    if (rt.status === 'superseded') throw new ApiFailure(409, 'retest.superseded');
    const comment = req.comment?.trim() ?? '';
    if (req.decision === 'pass') {
      await updateRow(tx, ctx, testRecords, rec.id, {
        result: 'passed',
        comment: comment || null,
        decidedAt: sql`now()`,
      } as never);
      await updateRow(tx, ctx, releaseTasks, rt.id, { status: 'effective' } as never);
      await pgOrchestrator.signal(tx, ctx, flow.id, {
        type: 'node_finished',
        nodeRunId: gate.id,
        outcome: 'done',
      });
      await notifyAll(tx, ctx, await assigneesOf(tx, t.id), {
        event: 'retest_passed',
        key: `retest_passed:${rec.id}`,
        ticket: t,
        title: tr('notify.retest_passed.title', {
          no: ticketNo(t.seqNo),
          version: rt.version ?? '',
        }),
      });
      await touchTicket(tx, ctx, t);
      return { ok: true };
    }
    if (!comment) throw new ApiFailure(400, 'review.comment_required');
    await updateRow(tx, ctx, testRecords, rec.id, {
      result: 'rejected',
      comment,
      decidedAt: sql`now()`,
    } as never);
    await updateRow(tx, ctx, releaseTasks, rt.id, { status: 'retest_rejected' } as never);
    await sendBack(tx, ctx, t, flow, 'test_rejected', comment);
    return { ok: true };
  });
}

// ---------- 10 合回主分支（修复人点） ----------

export function requestMainMerge(db: Db, userId: string, ws: string, ticketId: string) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const flow = await latestFlow(tx, t.id);
    if (flow?.status !== 'running') throw new ApiFailure(409, 'delivery.not_running');
    const gate = await waitingNode(tx, flow.id, (k) => k === 'main_request');
    if (!gate) throw new ApiFailure(409, 'delivery.main_not_ready');
    // the assignee asks for it, never automatic (05 step 10)
    if (!(await allowed(tx, userId, { type: 'assignee' }, t, 'core:tickets:review')))
      throw new ApiFailure(403, 'delivery.not_allowed');
    const node = (flow.plan as Plan).nodes.find((n) => n.key === 'prod_request')!;
    const c = cfgOf(node);
    if (!c.env_id) throw new ApiFailure(409, 'delivery.no_production_environment');
    const testTask = await stageTask(
      tx,
      flow.id,
      cfgOf((flow.plan as Plan).nodes.find((n) => n.key === 'test_build')).env_id,
    );
    const rc = await releaseConfig(tx, c.release_config_id);
    const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
    // 正式发布任务从这一步开始 (05 step 10): rebuilt on main later, waits for the MR first
    await insertRow(tx, ctx, releaseTasks, {
      projectId: t.projectId,
      seqNo: await nextReleaseNo(tx, ctx.workspaceId),
      ticketId: t.id,
      roundId: flow.roundId!,
      repoId: c.repo_id,
      repoTargetId: testTask?.repoTargetId ?? null,
      environmentId: c.env_id,
      flowInstanceId: flow.id,
      targetRef: rc.targetRef,
      sourceBranch: repo!.defaultBranch,
      testedFixHeadSha: testTask?.testedFixHeadSha ?? null,
      status: 'waiting_human',
      triggeredBy: userId,
    });
    await pgOrchestrator.signal(tx, ctx, flow.id, {
      type: 'node_finished',
      nodeRunId: gate.id,
      outcome: 'done',
    });
    await touchTicket(tx, ctx, t);
    return { ok: true };
  });
}

// ---------- 11 发布到正式环境 ----------

/** 发正式的三项前置 (06 §2.6), computed from reviews, test_records and merge_requests every time. */
async function prodGates(tx: Tx, flow: typeof flowInstances.$inferSelect) {
  const [rv] = await tx.select().from(reviews).where(eq(reviews.roundId, flow.roundId!));
  const passed = await tx
    .select({ id: testRecords.id })
    .from(testRecords)
    .innerJoin(releaseTasks, eq(releaseTasks.id, testRecords.releaseTaskId))
    .where(and(eq(releaseTasks.flowInstanceId, flow.id), eq(testRecords.result, 'passed')));
  const merged = await tx
    .select({ id: mergeRequests.id })
    .from(mergeRequests)
    .where(
      and(
        eq(mergeRequests.flowInstanceId, flow.id),
        eq(mergeRequests.direction, 'to_main'),
        eq(mergeRequests.state, 'merged'),
      ),
    );
  return {
    code_review: rv?.result === 'approved',
    retest: passed.length > 0,
    main_merged: merged.length > 0,
  };
}

export function releaseProd(db: Db, userId: string, ws: string, ticketId: string) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const flow = await latestFlow(tx, t.id);
    if (flow?.status !== 'running') throw new ApiFailure(409, 'delivery.not_running');
    const gates = await prodGates(tx, flow);
    if (!gates.code_review || !gates.retest || !gates.main_merged)
      throw new ApiFailure(409, 'delivery.prod_gates_open', gates);
    const gate = await waitingNode(tx, flow.id, (k) => k === 'prod_request');
    if (!gate) throw new ApiFailure(409, 'delivery.prod_not_ready');
    const c = cfgOf((flow.plan as Plan).nodes.find((n) => n.key === 'prod_request'));
    const rc = await releaseConfig(tx, c.release_config_id);
    if (
      !(await allowed(
        tx,
        userId,
        rc.envDeployerRules.production ?? { type: 'anyone' },
        t,
        'core:releases:run',
      ))
    )
      throw new ApiFailure(403, 'delivery.not_allowed');
    await needAccount(tx, userId, [rc.providerConnectorId]);
    const task = await stageTask(tx, flow.id, c.env_id);
    if (!task) throw new ApiFailure(409, 'delivery.prod_not_ready');
    await updateRow(tx, ctx, releaseTasks, task.id, { triggeredBy: userId } as never);
    await pgOrchestrator.signal(tx, ctx, flow.id, {
      type: 'node_finished',
      nodeRunId: gate.id,
      outcome: 'done',
    });
    await touchTicket(tx, ctx, t);
    return { ok: true };
  });
}

// ---------- 从这一步重试 ----------

export function retryDelivery(
  db: Db,
  userId: string,
  ws: string,
  ticketId: string,
  req: RetryDeliveryRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const t = await lockedTicket(tx, ticketId);
    const flow = await latestFlow(tx, t.id);
    if (flow?.status !== 'running') throw new ApiFailure(409, 'delivery.not_running');
    const plan = flow.plan as Plan;
    const node = plan.nodes.find((n) => n.key === req.node_key);
    const runs = await tx
      .select()
      .from(nodeRuns)
      .where(and(eq(nodeRuns.flowInstanceId, flow.id), eq(nodeRuns.nodeKey, req.node_key)))
      .orderBy(desc(nodeRuns.attemptNo));
    if (!node || runs[0]?.status !== 'failed')
      throw new ApiFailure(409, 'delivery.nothing_to_retry');
    const c = cfgOf(node);
    const rc = await releaseConfig(tx, c.release_config_id);
    // the retry runs with the retrier's own account (06 §7.4 item 1)
    if (node.node_kind === 'cr_merge') {
      const policy = c.direction === 'to_main' ? rc.mainBranchReviewers : rc.testBranchReviewers;
      if (!(await allowed(tx, userId, policy, t, 'core:tickets:review')))
        throw new ApiFailure(403, 'merge.not_reviewer');
      const [mr] = await tx
        .select()
        .from(mergeRequests)
        .where(
          and(
            eq(mergeRequests.flowInstanceId, flow.id),
            eq(mergeRequests.direction, c.direction!),
            eq(mergeRequests.state, 'open'),
          ),
        );
      if (c.step === 'merge') {
        const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
        await needAccount(tx, userId, [repo?.connectorId ?? null]);
        if (mr) await updateRow(tx, ctx, mergeRequests, mr.id, { mergedBy: userId } as never);
      }
    } else {
      const tier = c.stage === 'production' ? 'production' : 'test_gate';
      const fallback: ActorPolicy =
        tier === 'production' ? { type: 'anyone' } : { type: 'assignee' };
      if (
        !(await allowed(tx, userId, rc.envDeployerRules[tier] ?? fallback, t, 'core:releases:run'))
      )
        throw new ApiFailure(403, 'delivery.not_allowed');
      if (c.slot !== 'build' && c.slot !== 'notify')
        await needAccount(tx, userId, [rc.providerConnectorId]);
      const task = await stageTask(tx, flow.id, c.env_id);
      if (task)
        await updateRow(tx, ctx, releaseTasks, task.id, {
          triggeredBy: userId,
          // the step takes the serial lock again when it runs (06 §7.3)
          status: 'waiting_lock',
        } as never);
    }
    await pgOrchestrator.signal(tx, ctx, flow.id, { type: 'rework', toNodeKey: node.key });
    await touchTicket(tx, ctx, t);
    return { ok: true };
  });
}

// ---------- cc-sys: opening MRs and notifying (run_node) ----------

interface RunNodePayload {
  flow_instance_id: string;
  node_run_id: string;
}

export async function runDeliveryNodes(db: Db, sources: SourceSettings, owner: string) {
  const leases = await claimWork(db, { kinds: [RUN_NODE], limit: 5, owner, leaseSeconds: 120 });
  for (const lease of leases) {
    try {
      await runOne(db, sources, lease);
    } catch (e) {
      // the step fails with the reason and waits for a person (hold_on_fail)
      await withLeaseTx(db, lease, async (tx, ctx) => {
        const p = await payloadOf(tx, lease);
        await finish(tx, ctx, lease, p, 'failed', (e as Error).message.slice(0, 1000));
      }).catch(() => {});
    }
  }
}

async function payloadOf(tx: Tx, lease: Lease) {
  const [item] = (
    await tx.execute<{ payload: RunNodePayload }>(
      sql`select payload from work_items where id = ${lease.workItemId}`,
    )
  ).rows;
  return item!.payload;
}

async function finish(
  tx: Tx,
  ctx: ActorCtx,
  lease: Lease,
  p: RunNodePayload,
  outcome: 'done' | 'failed',
  error?: string,
) {
  if (error) await updateRow(tx, ctx, nodeRuns, p.node_run_id, { errorRaw: error } as never);
  await completeWork(tx, lease, outcome === 'done' ? 'done' : 'failed', error);
  await pgOrchestrator.signal(tx, ctx, p.flow_instance_id, {
    type: 'node_finished',
    nodeRunId: p.node_run_id,
    outcome,
  });
  if (outcome === 'failed')
    await stepFailed(tx, ctx, p.flow_instance_id, p.node_run_id, error ?? '');
}

async function runOne(db: Db, sources: SourceSettings, lease: Lease) {
  const ctxRead = await withLeaseTx(db, lease, async (tx) => {
    const p = await payloadOf(tx, lease);
    const [flow] = await tx
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.id, p.flow_instance_id));
    const [run] = await tx.select().from(nodeRuns).where(eq(nodeRuns.id, p.node_run_id));
    const node = (flow!.plan as Plan).nodes.find((n) => n.key === run!.nodeKey)!;
    return { p, flow: flow!, run: run!, node };
  });
  const { p, flow, node } = ctxRead;
  if (node.node_kind === 'cr_merge' && cfgOf(node).step === 'open')
    return openMr(db, sources, lease, p, flow, node);
  if (node.node_kind === 'release_deploy' && cfgOf(node).slot === 'notify')
    return withLeaseTx(db, lease, (tx, ctx) => notifyStep(tx, ctx, lease, p, flow, node));
  await withLeaseTx(db, lease, (tx, ctx) =>
    finish(tx, ctx, lease, p, 'failed', `no worker for ${node.node_kind}`),
  );
}

/** 6 / 10: Bot opens (or reuses) the MR fix/ → test branch or main with the workspace connector. */
async function openMr(
  db: Db,
  sources: SourceSettings,
  lease: Lease,
  p: RunNodePayload,
  flow: typeof flowInstances.$inferSelect,
  node: PlanNode,
) {
  const c = cfgOf(node);
  const info = await withLeaseTx(db, lease, async (tx) => {
    const [t] = await tx.select().from(tickets).where(eq(tickets.id, flow.ticketId!));
    const [slice] = await tx
      .select()
      .from(roundRepoSlices)
      .where(
        and(eq(roundRepoSlices.roundId, flow.roundId!), eq(roundRepoSlices.repoId, c.repo_id)),
      );
    const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
    const [target] = await tx
      .select()
      .from(repoTargets)
      .where(and(eq(repoTargets.repoId, c.repo_id), eq(repoTargets.projectId, flow.projectId)));
    const prod = c.direction === 'to_main' ? await stageTask(tx, flow.id, c.env_id) : null;
    return { t: t!, slice: slice!, repo: repo!, target: target!, prod };
  });
  const targetBranch =
    c.direction === 'to_main' ? info.repo.defaultBranch : (info.target.testBranch ?? '');
  const o = await withLeaseTx(db, lease, (tx) => opened(tx, sources, info.repo.connectorId!));
  const remote = info.repo.remoteRepoId!;
  // 合回主分支前防绕测 (06 §6.4): the fix/ head is still what was reviewed and retested
  const head = await o.plugin.branchHead(o.config, o.credential, remote, info.slice.branch);
  if (head !== info.slice.headSha || (info.prod && info.prod.testedFixHeadSha !== head))
    throw new Error(`fix branch moved after review: ${head ?? 'gone'}`);
  const no = ticketNo(info.t.seqNo);
  const mr = await o.plugin.openMergeRequest(o.config, o.credential, remote, {
    source: info.slice.branch,
    target: targetBranch,
    title: `${no} ${info.t.title}`,
    description: tr('delivery.mr_description', { no, title: info.t.title }),
  });
  await withLeaseTx(db, lease, async (tx, ctx) => {
    const [existing] = await tx
      .select()
      .from(mergeRequests)
      .where(
        and(
          eq(mergeRequests.ticketId, info.t.id),
          eq(mergeRequests.repoId, c.repo_id),
          eq(mergeRequests.direction, c.direction!),
          eq(mergeRequests.state, 'open'),
        ),
      );
    const values = {
      flowInstanceId: flow.id,
      nodeRunId: p.node_run_id,
      roundId: flow.roundId!,
      externalIid: mr.iid,
      webUrl: mr.web_url,
      headSha: mr.head_sha,
    };
    if (existing) await updateRow(tx, ctx, mergeRequests, existing.id, values as never);
    else
      await insertRow(tx, ctx, mergeRequests, {
        projectId: flow.projectId,
        ticketId: info.t.id,
        repoId: c.repo_id,
        direction: c.direction!,
        environmentId: c.direction === 'to_env' ? c.env_id : null,
        sourceBranch: info.slice.branch,
        targetBranch,
        ...values,
      });
    await finish(tx, ctx, lease, p, 'done');
    const rc = await releaseConfig(tx, c.release_config_id);
    const policy = c.direction === 'to_main' ? rc.mainBranchReviewers : rc.testBranchReviewers;
    const who = policy.type === 'users' ? (policy.users ?? []) : await assigneesOf(tx, info.t.id);
    await notifyAll(tx, ctx, who, {
      event: 'merge_review',
      key: `merge_review:${p.node_run_id}`,
      ticket: info.t,
      title: tr('notify.merge_review.title', { no, branch: targetBranch }),
    });
  });
}

/** 8 / 12: 通知 — the test version is ready to retest, or production runs the fix. */
async function notifyStep(
  tx: Tx,
  ctx: ActorCtx,
  lease: Lease,
  p: RunNodePayload,
  flow: typeof flowInstances.$inferSelect,
  node: PlanNode,
) {
  const c = cfgOf(node);
  const [t] = await tx.select().from(tickets).where(eq(tickets.id, flow.ticketId!));
  const task = await stageTask(tx, flow.id, c.env_id);
  if (!task) return finish(tx, ctx, lease, p, 'failed', 'release task missing');
  const [run] = await tx.select().from(nodeRuns).where(eq(nodeRuns.id, p.node_run_id));
  await insertRow(tx, ctx, releaseSteps, {
    projectId: flow.projectId,
    releaseTaskId: task.id,
    nodeRunId: p.node_run_id,
    slot: 'notify',
    status: 'succeeded',
    attempt: run!.attemptNo,
    finishedAt: sql`now()`,
  });
  const [env] = await tx.select().from(environments).where(eq(environments.id, task.environmentId));
  const no = ticketNo(t!.seqNo);
  const testerId =
    cfgOf((flow.plan as Plan).nodes.find((n) => n.key === 'retest')).tester_id ?? t!.createdBy!;
  if (c.stage === 'test') {
    await insertRow(tx, ctx, testRecords, {
      projectId: flow.projectId,
      releaseTaskId: task.id,
      version: task.version,
      testerId,
    });
    await updateRow(tx, ctx, releaseTasks, task.id, {
      status: 'effective_pending_retest',
    } as never);
    await notifyAll(tx, ctx, [testerId], {
      event: 'retest_ready',
      key: `retest_ready:${task.id}`,
      ticket: t!,
      title: tr('notify.retest_ready.title', { no, version: task.version ?? '' }),
      body: tr('notify.retest_ready.body', { title: t!.title, url: env?.entryUrl ?? '' }),
    });
  } else {
    await updateRow(tx, ctx, releaseTasks, task.id, { status: 'effective' } as never);
    await notifyAll(tx, ctx, [...(await assigneesOf(tx, t!.id)), testerId], {
      event: 'released_to_production',
      key: `released_to_production:${task.id}`,
      ticket: t!,
      title: tr('notify.released.title', { no, version: task.version ?? '' }),
    });
  }
  await finish(tx, ctx, lease, p, 'done');
  await touchTicket(tx, ctx, t!);
}

/**
 * A delivery step failed (any executor): the stage's release task fails with it — or is marked
 * superseded when verify found another release without this fix (06 §3.3) — and the people who can
 * retry are told. The flow holds (hold_on_fail).
 */
export async function stepFailed(
  tx: Tx,
  ctx: ActorCtx,
  flowId: string,
  nodeRunId: string,
  error: string,
) {
  const [flow] = await tx.select().from(flowInstances).where(eq(flowInstances.id, flowId));
  if (flow?.kind !== 'delivery') return;
  const [run] = await tx.select().from(nodeRuns).where(eq(nodeRuns.id, nodeRunId));
  const node = (flow.plan as Plan).nodes.find((n) => n.key === run?.nodeKey);
  const c = cfgOf(node);
  const task = await stageTask(tx, flow.id, c.stage === 'retest' ? null : c.env_id);
  if (task && !['effective', 'cancelled', 'retest_rejected'].includes(task.status))
    await updateRow(tx, ctx, releaseTasks, task.id, {
      status: error.startsWith('superseded') ? 'superseded' : 'failed',
    } as never);
  const [t] = await tx.select().from(tickets).where(eq(tickets.id, flow.ticketId!));
  if (!t) return;
  await notifyAll(
    tx,
    ctx,
    [...(await assigneesOf(tx, t.id)), ...(task?.triggeredBy ? [task.triggeredBy] : [])],
    {
      event: 'delivery_failed',
      key: `delivery_failed:${nodeRunId}`,
      ticket: t,
      title: tr('notify.delivery_failed.title', { no: ticketNo(t.seqNo) }),
      body: error.slice(0, 300),
    },
  );
  await touchTicket(tx, ctx, t);
}

// ---------- read model ----------

const STEP_OF = (n: PlanNode) => {
  const c = cfgOf(n);
  return c.slot ?? c.step ?? (n.node_kind === 'human_gate' ? 'retest' : '');
};

export function deliveryView(
  db: Db,
  userId: string,
  ws: string,
  ticketId: string,
): Promise<DeliveryView> {
  return inWorkspace(
    db,
    userId,
    ws,
    async (tx) => {
      const [t] = await tx
        .select()
        .from(tickets)
        .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)));
      if (!t) throw new ApiFailure(404, 'ticket.not_found');
      const flow = await latestFlow(tx, t.id);
      const facts = await viewFacts(tx, t);
      const empty: DeliveryView = {
        ticket_id: t.id,
        flow: null,
        nodes: [],
        merge_requests: [],
        release_tasks: [],
        test_records: [],
        prod_gates: { code_review: false, retest: false, main_merged: false },
        can: {
          start_test: false,
          review_mr: false,
          retest: false,
          request_main: false,
          release_prod: false,
          retry: null,
        },
        missing_accounts: [],
        environments: facts.environments,
        config: facts.config,
        tester_id: t.createdBy,
        people: {},
      };
      // what 「发布到测试环境」 would need (computed, 06 §3.3 「发布前」 is not stored)
      const missing: string[] = [];
      const startable = t.status === 'approved' && (!flow || flow.status !== 'running');
      if (startable && facts.rc) {
        if (!(await personalAccountOf(tx, facts.rc.providerConnectorId, userId)))
          missing.push(facts.rc.providerConnectorId);
        empty.can.start_test = await allowed(
          tx,
          userId,
          facts.rc.envDeployerRules.test_gate ?? { type: 'assignee' },
          t,
          'core:releases:run',
        );
      }
      if (!flow)
        return {
          ...empty,
          missing_accounts: missing,
          people: await peopleOf(tx, [...facts.userIds, t.createdBy]),
        };
      const plan = flow.plan as Plan;
      const [round] = await tx.select().from(rounds).where(eq(rounds.id, flow.roundId!));
      const runs = await tx
        .select()
        .from(nodeRuns)
        .where(eq(nodeRuns.flowInstanceId, flow.id))
        .orderBy(asc(nodeRuns.createdAt));
      const latest = (key: string) =>
        runs.filter((r) => r.nodeKey === key).sort((a, b) => b.attemptNo - a.attemptNo)[0];
      const nodes: DeliveryNodeView[] = plan.nodes.map((n) => {
        const r = latest(n.key);
        return {
          key: n.key,
          node_kind: n.node_kind ?? '',
          step: STEP_OF(n),
          stage: cfgOf(n).stage,
          status: (r?.status ?? 'pending') as DeliveryNodeView['status'],
          attempt_no: r?.attemptNo ?? 0,
          started_at: r?.startedAt?.toISOString() ?? null,
          finished_at: r?.finishedAt?.toISOString() ?? null,
          error: r?.status === 'failed' ? (r.errorRaw ?? null) : null,
        };
      });
      const mrs = await tx
        .select({ m: mergeRequests, path: repos.path })
        .from(mergeRequests)
        .innerJoin(repos, eq(repos.id, mergeRequests.repoId))
        .where(eq(mergeRequests.flowInstanceId, flow.id))
        .orderBy(asc(mergeRequests.createdAt));
      const tasks = await tx
        .select({ rt: releaseTasks, env: environments, path: repos.path })
        .from(releaseTasks)
        .innerJoin(environments, eq(environments.id, releaseTasks.environmentId))
        .innerJoin(repos, eq(repos.id, releaseTasks.repoId))
        .where(eq(releaseTasks.ticketId, t.id))
        .orderBy(asc(releaseTasks.createdAt));
      const taskIds = tasks.map((x) => x.rt.id);
      const steps = taskIds.length
        ? await tx
            .select()
            .from(releaseSteps)
            .where(inArray(releaseSteps.releaseTaskId, taskIds))
            .orderBy(asc(releaseSteps.startedAt))
        : [];
      const recs = taskIds.length
        ? await tx
            .select()
            .from(testRecords)
            .where(inArray(testRecords.releaseTaskId, taskIds))
            .orderBy(desc(testRecords.createdAt))
        : [];
      const running = flow.status === 'running';
      const waiting = (k: (key: string) => boolean) =>
        running && runs.some((r) => k(r.nodeKey) && r.status === 'waiting_human');
      const c0 = cfgOf(plan.nodes[0]);
      const rc = c0.release_config_id ? await releaseConfig(tx, c0.release_config_id) : null;
      const gates = await prodGates(tx, flow);
      const failed = running ? nodes.find((n) => n.status === 'failed') : undefined;
      const reviewing = nodes.find(
        (n) => n.status === 'waiting_human' && n.key.endsWith('_mr_review'),
      );
      const pendingRec = recs.find((x) => x.result === 'pending');
      const testerId = cfgOf(plan.nodes.find((n) => n.key === 'retest')).tester_id ?? t.createdBy;
      const can = {
        start_test: false,
        review_mr:
          !!reviewing &&
          !!rc &&
          (await allowed(
            tx,
            userId,
            reviewing.key.startsWith('main') ? rc.mainBranchReviewers : rc.testBranchReviewers,
            t,
            'core:tickets:review',
          )),
        retest: waiting((k) => k === 'retest') && pendingRec?.testerId === userId,
        request_main:
          waiting((k) => k === 'main_request') &&
          (await allowed(tx, userId, { type: 'assignee' }, t, 'core:tickets:review')),
        release_prod:
          waiting((k) => k === 'prod_request') &&
          gates.code_review &&
          gates.retest &&
          gates.main_merged &&
          !!rc &&
          (await allowed(
            tx,
            userId,
            rc.envDeployerRules.production ?? { type: 'anyone' },
            t,
            'core:releases:run',
          )),
        retry: failed?.key ?? null,
      };
      if (
        rc &&
        (can.release_prod || failed) &&
        !(await personalAccountOf(tx, rc.providerConnectorId, userId))
      )
        missing.push(rc.providerConnectorId);
      if (can.review_mr) {
        const [repo] = await tx.select().from(repos).where(eq(repos.id, c0.repo_id));
        if (repo?.connectorId && !(await personalAccountOf(tx, repo.connectorId, userId)))
          missing.push(repo.connectorId);
      }
      return {
        ticket_id: t.id,
        flow: { id: flow.id, round_no: round?.roundNo ?? 0, status: flow.status },
        nodes,
        merge_requests: mrs.map(({ m, path }) => ({
          id: m.id,
          direction: m.direction as 'to_env' | 'to_main',
          repo: path,
          external_iid: m.externalIid,
          web_url: m.webUrl,
          source_branch: m.sourceBranch,
          target_branch: m.targetBranch,
          head_sha: m.headSha,
          merge_sha: m.mergeSha,
          state: m.state as DeliveryView['merge_requests'][number]['state'],
          reviewer_id: m.reviewerId,
          merged_by: m.mergedBy,
          comment: m.comment,
          created_at: m.createdAt.toISOString(),
        })),
        release_tasks: tasks.map(({ rt, env, path }) => ({
          id: rt.id,
          no: releaseNo(rt.seqNo),
          flow_id: rt.flowInstanceId,
          environment: { id: env.id, env_code: env.envCode, name: env.name, tier: env.envTier },
          repo: path,
          status: rt.status as DeliveryView['release_tasks'][number]['status'],
          source_branch: rt.sourceBranch,
          build_commit: rt.buildCommit,
          version: rt.version,
          verified_revision: rt.verifiedRevision,
          triggered_by: rt.triggeredBy,
          created_at: rt.createdAt.toISOString(),
          steps: steps
            .filter((s) => s.releaseTaskId === rt.id)
            .map((s) => ({
              slot: s.slot as DeliveryView['release_tasks'][number]['steps'][number]['slot'],
              status: s.status as DeliveryView['release_tasks'][number]['steps'][number]['status'],
              command: s.command,
              exit_code: s.exitCode,
              error: s.errorSummary,
              attempt: s.attempt,
              log_tail: s.logTail,
              started_at: s.startedAt.toISOString(),
              finished_at: s.finishedAt?.toISOString() ?? null,
            })),
        })),
        test_records: recs.map((r) => ({
          id: r.id,
          release_task_id: r.releaseTaskId,
          version: r.version,
          tester_id: r.testerId,
          result: r.result as 'pending' | 'passed' | 'rejected',
          comment: r.comment,
          at: (r.decidedAt ?? r.createdAt).toISOString(),
        })),
        prod_gates: gates,
        can: { ...can, start_test: empty.can.start_test },
        missing_accounts: [...new Set(missing)],
        environments: facts.environments,
        config: facts.config,
        tester_id: testerId,
        people: await peopleOf(tx, [
          ...facts.userIds,
          testerId,
          t.createdBy,
          ...mrs.flatMap(({ m }) => [m.reviewerId, m.mergedBy]),
          ...tasks.map(({ rt }) => rt.triggeredBy),
          ...recs.map((r) => r.testerId),
        ]),
      };
    },
    SNAPSHOT_READ,
  );
}

/**
 * What the release tab shows before and during a delivery: the project's environments with the
 * version last made live there (from release_tasks, never stored twice) and the target's release
 * settings with the people they name.
 */
async function viewFacts(tx: Tx, t: typeof tickets.$inferSelect) {
  const envs = await tx
    .select()
    .from(environments)
    .where(and(eq(environments.projectId, t.projectId), isNull(environments.deletedAt)))
    .orderBy(asc(environments.sortOrder), asc(environments.createdAt));
  const live = envs.length
    ? await tx
        .select({ env: releaseTasks.environmentId, version: releaseTasks.version })
        .from(releaseTasks)
        .where(
          and(
            inArray(
              releaseTasks.environmentId,
              envs.map((e) => e.id),
            ),
            inArray(releaseTasks.status, ['effective', 'effective_pending_retest']),
          ),
        )
        .orderBy(desc(releaseTasks.updatedAt))
    : [];
  const [rc] = await tx
    .select({ rc: releaseConfigs, target: repoTargets, repo: repos })
    .from(releaseConfigs)
    .innerJoin(repoTargets, eq(repoTargets.id, releaseConfigs.repoTargetId))
    .innerJoin(repos, eq(repos.id, repoTargets.repoId))
    .where(and(eq(releaseConfigs.projectId, t.projectId), isNull(releaseConfigs.deletedAt)))
    .limit(1);
  const policies = rc
    ? {
        test_reviewers: rc.rc.testBranchReviewers,
        main_reviewers: rc.rc.mainBranchReviewers,
        test_deployers: rc.rc.envDeployerRules.test_gate ?? { type: 'assignee' as const },
        prod_deployers: rc.rc.envDeployerRules.production ?? { type: 'anyone' as const },
      }
    : null;
  return {
    rc: rc?.rc ?? null,
    environments: envs
      .filter((e) => e.envTier === 'test_gate' || e.envTier === 'production')
      .map((e) => ({
        id: e.id,
        env_code: e.envCode,
        name: e.name,
        tier: e.envTier,
        entry_url: e.entryUrl,
        live_version: live.find((x) => x.env === e.id)?.version ?? null,
        previous_version: live.filter((x) => x.env === e.id)[1]?.version ?? null,
      })),
    config:
      rc && policies
        ? {
            provider_connector_id: rc.rc.providerConnectorId,
            code_connector_id: rc.repo.connectorId,
            test_branch: rc.target.testBranch,
            main_branch: rc.repo.defaultBranch,
            ...policies,
          }
        : null,
    userIds: [
      ...(await assigneesOf(tx, t.id)),
      ...Object.values(policies ?? {}).flatMap((p) => p.users ?? []),
    ],
  };
}

async function peopleOf(tx: Tx, ids: (string | null | undefined)[]) {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return {};
  const rows = await tx
    .select({ id: users.id, name: users.displayName })
    .from(users)
    .where(inArray(users.id, want));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/** Release settings of a project's targets (set up by people with core:projects:manage). */
export function saveReleaseConfig(
  db: Db,
  userId: string,
  ws: string,
  projectId: string,
  req: {
    repo_id: string;
    provider_connector_id: string;
    target_ref: Record<string, unknown>;
    test_branch: string | null;
  },
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    if (!grants(await permissionsOf(tx, userId), 'core:projects:manage'))
      throw new ApiFailure(403, 'auth.forbidden', { permission: 'core:projects:manage' });
    const [project] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new ApiFailure(404, 'project.not_found');
    const [target] = await tx
      .select()
      .from(repoTargets)
      .where(
        and(
          eq(repoTargets.projectId, projectId),
          eq(repoTargets.repoId, req.repo_id),
          isNull(repoTargets.deletedAt),
        ),
      );
    if (!target) throw new ApiFailure(404, 'repo.not_found');
    await updateRow(tx, ctx, repoTargets, target.id, { testBranch: req.test_branch } as never);
    const [old] = await tx
      .select()
      .from(releaseConfigs)
      .where(and(eq(releaseConfigs.repoTargetId, target.id), isNull(releaseConfigs.deletedAt)));
    try {
      const rc = old
        ? await updateRow(tx, ctx, releaseConfigs, old.id, {
            providerConnectorId: req.provider_connector_id,
            targetRef: req.target_ref,
          } as never)
        : await insertRow(tx, ctx, releaseConfigs, {
            projectId,
            repoTargetId: target.id,
            providerConnectorId: req.provider_connector_id,
            targetRef: req.target_ref,
          });
      return { id: rc.id, repo_target_id: target.id };
    } catch (e) {
      if (pgCode(e) === '23503') throw new ApiFailure(404, 'connector.not_found');
      throw e;
    }
  });
}
