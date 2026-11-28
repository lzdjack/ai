// Dock「发布」(docs/02「两个入口一份内容」, docs/06 §3.3): every ticket's releases as one list. A row is
// one approved round going to one environment; where it stands and whether it waits on the caller are
// computed on each read from the flow's node runs, MRs, release tasks and test records.
import {
  DELIVERY_STEPS,
  type ReleaseList,
  type ReleaseRow,
  type ReleaseRowState,
  type ReleaseStage,
} from '@cloudcraft/core-protocol';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { SNAPSHOT_READ, type Db, type Tx } from '../db/client.ts';
import {
  environments,
  flowInstances,
  mergeRequests,
  nodeRuns,
  releaseConfigs,
  releaseTasks,
  repos,
  reviews,
  rounds,
  testRecords,
  ticketAssignees,
  tickets,
  users,
  type ActorPolicy,
} from '../db/schema/index.ts';
import type { Plan } from '../orchestrator/advance.ts';
import { allowed, cfgOf } from './delivery-service.ts';
import { inWorkspace } from './iam-service.ts';
import { ticketNo } from './ticket-service.ts';

/** The newest delivery flows listed; older releases stay reachable from their ticket. */
const LIMIT = 200;

type Ticket = typeof tickets.$inferSelect;

interface Run {
  status: string;
  attemptNo: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** What one stage of one flow looks like, before knowing who is asking. */
interface Facts {
  state: ReleaseRowState;
  step: number | null;
  stepsDone: number;
}

/** Where a stage stands, from the latest run of each of its nodes. */
function standing(o: {
  stage: ReleaseStage;
  flowStatus: string;
  runs: Map<string, Run>;
  rejectedMr: boolean;
  taskStatus: string | null;
}): Facts {
  const groups = DELIVERY_STEPS[o.stage];
  const status = (k: string) => o.runs.get(k)?.status ?? 'pending';
  const done = groups.map((ks) => ks.every((k) => status(k) === 'done'));
  const at = (state: ReleaseRowState, step: number | null = null): Facts => ({
    state,
    step,
    stepsDone: done.filter(Boolean).length,
  });
  // a stage that got as far as its goal stays that way, whatever happens to the flow later
  if (o.stage === 'test' && status('retest') === 'done') return at('retest_passed');
  if (o.stage === 'production' && done.every(Boolean)) return at('effective');
  if (o.taskStatus === 'retest_rejected') return at('retest_rejected');
  if (o.flowStatus !== 'running') return at(o.rejectedMr ? 'review_rejected' : 'cancelled');
  const failed = groups.findIndex((ks) => ks.some((k) => status(k) === 'failed'));
  if (failed >= 0) return at('failed', failed);
  if (o.stage === 'test' && status('retest') === 'waiting_human') return at('pending_retest');
  if (o.stage === 'production' && status('main_request') === 'waiting_human')
    return at('main_request');
  if (status(o.stage === 'test' ? 'test_mr_review' : 'main_mr_review') === 'waiting_human')
    return at('merge_review', 0);
  if (o.stage === 'production' && status('prod_request') === 'waiting_human')
    return at('release_ready');
  const next = done.indexOf(false);
  // every step of the test stage passed and the retest gate is about to open
  return at('releasing', next < 0 ? groups.length - 1 : next);
}

const FINISHED: ReleaseRowState[] = [
  'retest_passed',
  'effective',
  'review_rejected',
  'retest_rejected',
  'cancelled',
];

export function releaseList(db: Db, userId: string, ws: string): Promise<ReleaseList> {
  return inWorkspace(
    db,
    userId,
    ws,
    async (tx) => {
      const found = await tx
        .select({ f: flowInstances, t: tickets, roundNo: rounds.roundNo })
        .from(flowInstances)
        .innerJoin(tickets, eq(tickets.id, flowInstances.ticketId))
        .innerJoin(rounds, eq(rounds.id, flowInstances.roundId))
        .where(and(eq(flowInstances.kind, 'delivery'), isNull(tickets.deletedAt)))
        .orderBy(desc(flowInstances.updatedAt))
        .limit(LIMIT + 1);
      const flows = found.slice(0, LIMIT);
      const notStarted = await approvedNotStarted(tx);
      const ticketIds = [...flows.map((x) => x.t.id), ...notStarted.map((x) => x.t.id)];
      const assignees = ticketIds.length
        ? await tx
            .select({ ticketId: ticketAssignees.ticketId, userId: ticketAssignees.userId })
            .from(ticketAssignees)
            .where(inArray(ticketAssignees.ticketId, ticketIds))
            .orderBy(asc(ticketAssignees.createdAt))
        : [];
      const assigneesOf = (id: string) =>
        assignees.filter((a) => a.ticketId === id).map((a) => a.userId);

      /**
       * Whether a step is the caller's to do: the policy names them. Under "anyone" it is listed
       * only for the assignee, who carries the release (never for everyone who happens to be able).
       */
      const theirs = async (p: ActorPolicy, t: Ticket, permission: string) => {
        const assigned = assigneesOf(t.id).includes(userId);
        if (p.type === 'anyone') return assigned && (await allowed(tx, userId, p, t, permission));
        return allowed(tx, userId, p, t, permission);
      };

      const flowIds = flows.map((x) => x.f.id);
      const runs = flowIds.length
        ? await tx.select().from(nodeRuns).where(inArray(nodeRuns.flowInstanceId, flowIds))
        : [];
      const tasks = flowIds.length
        ? await tx
            .select({ rt: releaseTasks, env: environments.name, repo: repos.path })
            .from(releaseTasks)
            .innerJoin(environments, eq(environments.id, releaseTasks.environmentId))
            .innerJoin(repos, eq(repos.id, releaseTasks.repoId))
            .where(inArray(releaseTasks.flowInstanceId, flowIds))
            .orderBy(asc(releaseTasks.createdAt))
        : [];
      const records = tasks.length
        ? await tx
            .select()
            .from(testRecords)
            .where(
              inArray(
                testRecords.releaseTaskId,
                tasks.map((x) => x.rt.id),
              ),
            )
        : [];
      const rejected = flowIds.length
        ? await tx
            .select({ flowId: mergeRequests.flowInstanceId, direction: mergeRequests.direction })
            .from(mergeRequests)
            .where(
              and(
                inArray(mergeRequests.flowInstanceId, flowIds),
                eq(mergeRequests.state, 'rejected'),
              ),
            )
        : [];
      const projectIds = [...new Set([...flows, ...notStarted].map((x) => x.t.projectId))];
      const configs = projectIds.length
        ? await tx
            .select()
            .from(releaseConfigs)
            .where(inArray(releaseConfigs.projectId, projectIds))
        : [];
      const envs = projectIds.length
        ? await tx
            .select()
            .from(environments)
            .where(and(inArray(environments.projectId, projectIds), isNull(environments.deletedAt)))
            .orderBy(asc(environments.sortOrder), asc(environments.createdAt))
        : [];

      const items: ReleaseRow[] = [];
      const base = (t: Ticket, roundNo: number, stage: ReleaseStage) => ({
        key: `${t.id}:${roundNo}:${stage}`,
        ticket_id: t.id,
        ticket_no: ticketNo(t.seqNo),
        ticket_title: t.title,
        round_no: roundNo,
        stage,
        assignee_id: assigneesOf(t.id)[0] ?? null,
      });

      for (const { f, t, roundNo } of flows) {
        const latest = new Map<string, Run>();
        for (const r of runs)
          if (r.flowInstanceId === f.id && r.attemptNo >= (latest.get(r.nodeKey)?.attemptNo ?? 0))
            latest.set(r.nodeKey, r);
        const plan = f.plan as Plan;
        const assigned = assigneesOf(t.id).includes(userId);
        const testerId = cfgOf(plan.nodes.find((n) => n.key === 'retest')).tester_id ?? null;
        const configOf = (key: string) => cfgOf(plan.nodes.find((n) => n.key === key));
        const taskIn = (envId: string | null) =>
          tasks.filter((x) => x.rt.flowInstanceId === f.id && x.rt.environmentId === envId).at(-1);
        const testTask = taskIn(configOf('test_build').env_id);
        const record = records.find((r) => r.releaseTaskId === testTask?.rt.id);
        for (const stage of ['test', 'production'] as const) {
          const node = configOf(stage === 'test' ? 'test_build' : 'prod_build');
          const task = stage === 'test' ? testTask : taskIn(node.env_id);
          // production starts to exist when the merge back can be asked for
          if (
            !task &&
            (stage === 'test' ||
              f.status !== 'running' ||
              latest.get('main_request')?.status !== 'waiting_human')
          )
            continue;
          const s = standing({
            stage,
            flowStatus: f.status,
            runs: latest,
            rejectedMr: rejected.some(
              (m) => m.flowId === f.id && m.direction === (stage === 'test' ? 'to_env' : 'to_main'),
            ),
            taskStatus: task?.rt.status ?? null,
          });
          const rc = configs.find((c) => c.id === node.release_config_id);
          const reviewers =
            s.state === 'merge_review' && rc
              ? stage === 'test'
                ? rc.testBranchReviewers
                : rc.mainBranchReviewers
              : null;
          let waiting = false;
          if (reviewers)
            // like the ticket list: a review open to "anyone" waits on nobody in particular
            waiting =
              reviewers.type !== 'anyone' &&
              (await allowed(tx, userId, reviewers, t, 'core:tickets:review'));
          else if (s.state === 'pending_retest') waiting = record?.testerId === userId;
          else if (s.state === 'main_request') waiting = assigned;
          else if (s.state === 'release_ready' && rc)
            waiting = await theirs(
              rc.envDeployerRules.production ?? { type: 'anyone' },
              t,
              'core:releases:run',
            );
          const mine =
            assigned || waiting || task?.rt.triggeredBy === userId || testerId === userId;
          const moved = DELIVERY_STEPS[stage]
            .flat()
            .concat(stage === 'test' ? ['retest'] : ['main_request', 'prod_request'])
            .flatMap((k) => {
              const r = latest.get(k);
              return [r?.startedAt, r?.finishedAt];
            })
            .filter((x): x is Date => !!x)
            .map((x) => x.getTime());
          const started = task?.rt.createdAt ?? f.createdAt;
          items.push({
            ...base(t, roundNo, stage),
            environment_name: task?.env ?? envs.find((e) => e.id === node.env_id)?.name ?? null,
            repo: task?.repo ?? null,
            version: task?.rt.version ?? null,
            group: FINISHED.includes(s.state) ? 'done' : waiting ? 'waiting' : 'running',
            state: s.state,
            step: s.step,
            steps_done: s.stepsDone,
            mine,
            // before the merge back is asked for, the row is about whoever passed the retest
            person_id: task?.rt.triggeredBy ?? record?.testerId ?? null,
            reviewers,
            tester_id: record?.testerId ?? testerId,
            at:
              FINISHED.includes(s.state) || !task
                ? new Date(Math.max(started.getTime(), ...moved)).toISOString()
                : started.toISOString(),
          });
        }
      }

      // approved and not released yet: the release record appears as soon as the review passes
      for (const { t, roundNo, approvedAt } of notStarted) {
        const rc = configs.find((c) => c.projectId === t.projectId && !c.deletedAt);
        // the same pick as the release tab's facts: one release setting per project in M1
        const assigned = assigneesOf(t.id).includes(userId);
        const waiting = rc
          ? await theirs(
              rc.envDeployerRules.test_gate ?? { type: 'assignee' },
              t,
              'core:releases:run',
            )
          : assigned;
        items.push({
          ...base(t, roundNo, 'test'),
          environment_name:
            envs.find((e) => e.projectId === t.projectId && e.envTier === 'test_gate')?.name ??
            null,
          repo: null,
          version: null,
          group: waiting ? 'waiting' : 'running',
          state: 'before',
          step: null,
          steps_done: 0,
          mine: assigned || waiting,
          person_id: assigneesOf(t.id)[0] ?? null,
          reviewers: null,
          tester_id: null,
          at: approvedAt.toISOString(),
        });
      }

      items.sort((a, b) => b.at.localeCompare(a.at));
      const ids = [
        ...new Set(
          items.flatMap((x) => [
            x.person_id,
            x.assignee_id,
            x.tester_id,
            ...(x.reviewers?.users ?? []),
          ]),
        ),
      ].filter((x): x is string => !!x);
      const people = ids.length
        ? await tx
            .select({ id: users.id, name: users.displayName })
            .from(users)
            .where(inArray(users.id, ids))
        : [];
      return {
        items,
        next_cursor: null,
        has_more: found.length > LIMIT,
        people: Object.fromEntries(people.map((p) => [p.id, p.name])),
      };
    },
    SNAPSHOT_READ,
  );
}

/** Approved tickets whose current round has no delivery flow yet. */
async function approvedNotStarted(tx: Tx) {
  return tx
    .select({
      t: tickets,
      roundNo: rounds.roundNo,
      approvedAt: reviews.createdAt,
    })
    .from(tickets)
    .innerJoin(
      rounds,
      and(eq(rounds.ticketId, tickets.id), eq(rounds.roundNo, tickets.currentRound)),
    )
    .innerJoin(reviews, and(eq(reviews.roundId, rounds.id), eq(reviews.result, 'approved')))
    .where(
      and(
        eq(tickets.status, 'approved'),
        isNull(tickets.deletedAt),
        sql`not exists (select 1 from flow_instances fi
              where fi.round_id = ${rounds.id} and fi.kind = 'delivery')`,
      ),
    )
    .orderBy(desc(tickets.updatedAt))
    .limit(LIMIT);
}
