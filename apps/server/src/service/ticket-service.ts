// Tickets and their first delivery round (docs/06 §2.5, §3.1, §3.2, §5.7; 05 step 3).
//   create: M-<seq> number, the creator as assignee, round 1 compiled from the built-in template
//           "standard frontend bug fix" (prepare → AI fix → host replay → human review), dispatched
//   after the replay passed: a round_deliver work item; cc-sys checks the facts outside any
//           transaction (each fix/ branch head on the platform must be the commit the host made), then
//           records the delivery card, risk level and digest, moves the ticket to review and notifies
//   a failed node: the round needs help, with the reason
//   review (P5): an assignee approves the latest delivery, or sends it back — which records the
//           review and starts the next round on the same fix/ branch, the comment handed to the bot
import crypto from 'node:crypto';
import {
  DEFAULT_RISK_RULES,
  evidenceName,
  type CreateTicketRequest,
  type DeliveryCard,
  type DeliveryRepoFacts,
  type ReviewRequest,
  type RiskLevel,
  type RiskRules,
  type TicketDetail,
} from '@cloudcraft/core-protocol';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { withLeaseTx, type ActorCtx, type Db, type Lease, type Tx } from '../db/client.ts';
import {
  environments,
  evidences,
  flowInstances,
  nodeRuns,
  projects,
  repos,
  reviews,
  roundRepoSlices,
  rounds,
  ticketAssignees,
  tickets,
  users,
  verifyRuns,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan } from '../orchestrator/advance.ts';
import { pgOrchestrator } from '../orchestrator/flow.ts';
import { claimWork, completeWork, enqueueWork } from '../orchestrator/queue.ts';
import { nextTicketNo } from '../repo/ticket-repo.ts';
import { publish } from './changes.ts';
import { ApiFailure, pgCode } from './errors.ts';
import { tr } from './i18n.ts';
import { inWorkspace, notify, permissionsOf } from './iam-service.ts';
import { opened, projectRepoSpecs, type SourceSettings } from './source-service.ts';
import { grants } from '@cloudcraft/core-protocol';

export const ROUND_DELIVER = 'round_deliver';
export const STANDARD_FRONTEND_BUGFIX = 'standard_frontend_bugfix';

/** What the AI node reads: the report, and from round 2 on the review it answers (untrusted text). */
interface Material {
  title: string;
  body: string;
  review?: {
    round_no: number;
    comment: string;
    category: string | null;
    location: ReviewRequest['location'] | null;
  };
}

/** The built-in template (06 §5.1 presets), compiled into the round's frozen plan. */
function compilePlan(o: {
  repos: Plan['repos'];
  branch: string;
  material: Material;
  envUrl: string | null;
  /** first round: start a new branch (a free name if this one is taken), never continue one */
  fresh: boolean;
}): Plan {
  return {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: o.repos,
    nodes: [
      {
        key: 'prepare',
        kind: 'auto',
        node_kind: 'host_prepare',
        config: { branch: o.branch, ...(o.fresh ? { fresh: true } : {}) },
      },
      {
        key: 'fix',
        kind: 'auto',
        node_kind: 'ai_agent',
        config: { branch: o.branch, material: o.material },
      },
      {
        key: 'verify',
        kind: 'auto',
        node_kind: 'deterministic_verify',
        config: { action: 'replay', ...(o.envUrl ? { env_url: o.envUrl } : {}) },
      },
      { key: 'review', kind: 'human', node_kind: 'human_gate' },
    ],
  };
}

export const ticketNo = (seq: number | null) => (seq === null ? '' : `M-${seq}`);
export const ticketSummary = (t: typeof tickets.$inferSelect) => ({
  id: t.id,
  no: ticketNo(t.seqNo),
  title: t.title,
  status: t.status,
  priority: t.priority,
  current_round: t.currentRound,
});

/** The report as the AI node reads it: body, then the repro steps the person listed. */
function reportOf(t: typeof tickets.$inferSelect) {
  const steps = t.reproSteps.map((x, i) => `${i + 1}. ${x}`).join('\n');
  return steps ? `${t.body}\n\n${tr('ticket.repro_steps')}\n${steps}` : t.body;
}

/**
 * Round <roundNo> of a ticket, dispatched at once: its plan compiled from the built-in template with
 * the project's repos and test environment of this moment (06 §3.1: a new round binds the newest
 * template), on the ticket's fix/ branch — round 2 on continues from what round 1 pushed.
 */
async function startRound(
  tx: Tx,
  ctx: ActorCtx,
  o: {
    ticket: typeof tickets.$inferSelect;
    project: typeof projects.$inferSelect;
    repoSpecs: Plan['repos'];
    roundNo: number;
    cause: 'new' | 'code_rejected' | 'mr_rejected' | 'test_rejected';
    review?: Material['review'];
    /** later rounds: the branch the earlier one pushed (it may carry a -2 suffix) */
    branch?: string;
  },
) {
  const [env] = await tx
    .select()
    .from(environments)
    .where(
      and(
        eq(environments.projectId, o.project.id),
        eq(environments.envTier, 'test_gate'),
        isNull(environments.deletedAt),
      ),
    )
    .orderBy(asc(environments.sortOrder));
  const round = await insertRow(tx, ctx, rounds, {
    projectId: o.project.id,
    ticketId: o.ticket.id,
    roundNo: o.roundNo,
    cause: o.cause,
    status: 'fixing',
  });
  const plan = compilePlan({
    repos: o.repoSpecs,
    branch: o.branch ?? `fix/${o.project.slug}/${ticketNo(o.ticket.seqNo)}`,
    fresh: o.cause === 'new',
    material: {
      title: o.ticket.title,
      body: reportOf(o.ticket),
      ...(o.review ? { review: o.review } : {}),
    },
    envUrl: env?.entryUrl ?? null,
  });
  const flowId = await pgOrchestrator.startFlow(tx, ctx, {
    projectId: o.project.id,
    kind: 'round',
    plan,
  });
  await updateRow(tx, ctx, flowInstances, flowId, {
    ticketId: o.ticket.id,
    roundId: round.id,
  } as never);
  await updateRow(tx, ctx, rounds, round.id, { flowInstanceId: flowId } as never);
  return flowId;
}

export function createTicket(
  db: Db,
  userId: string,
  ws: string,
  projectId: string,
  req: CreateTicketRequest,
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    if (!grants(await permissionsOf(tx, userId), 'core:tickets:create'))
      throw new ApiFailure(403, 'auth.forbidden', { permission: 'core:tickets:create' });
    const [project] = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
    if (!project) throw new ApiFailure(404, 'project.not_found');
    const repoSpecs = await projectRepoSpecs(tx, projectId);
    if (!repoSpecs.length) throw new ApiFailure(409, 'project.no_repos');
    const seq = await nextTicketNo(tx, ws);
    const ticket = await insertRow(tx, ctx, tickets, {
      projectId,
      seqNo: seq,
      title: req.title,
      body: req.body,
      priority: req.priority ?? 'P2',
      reproSteps: req.repro_steps ?? [],
      status: 'fixing',
      currentRound: 1,
      createdBy: userId,
    });
    await insertRow(tx, ctx, ticketAssignees, { projectId, ticketId: ticket.id, userId });
    const flowId = await startRound(tx, ctx, {
      ticket,
      project,
      repoSpecs,
      roundNo: 1,
      cause: 'new',
    });
    await publish(tx, ctx, {
      entity: 'ticket',
      entityId: ticket.id,
      op: 'upsert',
      rev: ticket.rev,
      projectId,
      row: ticketSummary(ticket),
    });
    return { ...ticketSummary(ticket), flow_id: flowId };
  });
}

export function createEnvironment(
  db: Db,
  userId: string,
  ws: string,
  projectId: string,
  req: { env_code: string; name: string; env_tier: string; entry_url: string },
) {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    if (!grants(await permissionsOf(tx, userId), 'core:projects:manage'))
      throw new ApiFailure(403, 'auth.forbidden', { permission: 'core:projects:manage' });
    const e = await insertRow(tx, ctx, environments, {
      projectId,
      envCode: req.env_code,
      name: req.name,
      envTier: req.env_tier,
      entryUrl: req.entry_url,
    });
    return {
      id: e.id,
      env_code: e.envCode,
      env_tier: e.envTier,
      name: e.name,
      entry_url: e.entryUrl,
    };
  });
}

export function listEnvironments(db: Db, userId: string, ws: string, projectId: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const rows = await tx
      .select()
      .from(environments)
      .where(and(eq(environments.projectId, projectId), isNull(environments.deletedAt)))
      .orderBy(asc(environments.sortOrder), asc(environments.createdAt));
    return {
      items: rows.map((e) => ({
        id: e.id,
        env_code: e.envCode,
        env_tier: e.envTier,
        name: e.name,
        entry_url: e.entryUrl,
      })),
      next_cursor: null,
      has_more: false,
    };
  });
}

export function listTickets(db: Db, userId: string, ws: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const rows = await tx
      .select({ t: tickets, reporter: users.displayName, reason: rounds.helpReason })
      .from(tickets)
      .leftJoin(users, eq(users.id, tickets.createdBy))
      .leftJoin(
        rounds,
        and(eq(rounds.ticketId, tickets.id), eq(rounds.roundNo, tickets.currentRound)),
      )
      .where(isNull(tickets.deletedAt))
      .orderBy(desc(tickets.updatedAt))
      .limit(200);
    const mine = new Set(
      (
        await tx
          .select({ id: ticketAssignees.ticketId })
          .from(ticketAssignees)
          .where(eq(ticketAssignees.userId, userId))
      ).map((x) => x.id),
    );
    const waiting = await waitingOnMe(tx, userId, mine);
    return {
      items: rows.map((r) => ({
        ...ticketSummary(r.t),
        reporter_name: r.reporter ?? null,
        help_reason: r.t.status === 'needs_help' ? (r.reason ?? null) : null,
        is_assignee: mine.has(r.t.id),
        waiting_on_me: waiting.get(r.t.id) ?? null,
        updated_at: r.t.updatedAt.toISOString(),
      })),
      next_cursor: null,
      has_more: false,
    };
  });
}

/**
 * Delivery steps waiting on the caller (05 steps 6, 9, 10): a version to retest, or an open MR whose
 * review is due and whose reviewer policy names them (06 §2.4; "anyone" is not listed for everyone).
 */
async function waitingOnMe(tx: Tx, userId: string, mine: Set<string>) {
  const out = new Map<string, 'retest' | 'merge_review'>();
  const mrs = await tx.execute<{
    ticket_id: string;
    created_by: string | null;
    policy: { type: string; users?: string[] };
  }>(sql`
    select m.ticket_id, t.created_by,
           case when m.direction = 'to_main' then rc.main_branch_reviewers
                else rc.test_branch_reviewers end as policy
      from merge_requests m
      join tickets t on t.id = m.ticket_id
      join node_runs nr on nr.flow_instance_id = m.flow_instance_id
       and nr.status = 'waiting_human' and nr.node_key like '%\_mr\_review'
      join repo_targets rt on rt.repo_id = m.repo_id and rt.project_id = m.project_id
       and rt.deleted_at is null
      join release_configs rc on rc.repo_target_id = rt.id and rc.deleted_at is null
     where m.state = 'open' and m.deleted_at is null`);
  for (const r of mrs.rows) {
    const p = r.policy;
    if (
      (p.type === 'users' && (p.users ?? []).includes(userId)) ||
      (p.type === 'assignee' && mine.has(r.ticket_id)) ||
      (p.type === 'reporter' && r.created_by === userId)
    )
      out.set(r.ticket_id, 'merge_review');
  }
  const tests = await tx.execute<{ ticket_id: string }>(sql`
    select rt.ticket_id
      from test_records tr
      join release_tasks rt on rt.id = tr.release_task_id
     where tr.tester_id = ${userId}::uuid and tr.result = 'pending'
       and rt.status = 'effective_pending_retest' and tr.deleted_at is null`);
  for (const r of tests.rows) out.set(r.ticket_id, 'retest');
  return out;
}

export function ticketDetail(
  db: Db,
  userId: string,
  ws: string,
  id: string,
): Promise<TicketDetail> {
  return inWorkspace(db, userId, ws, async (tx) => {
    const [t] = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)));
    if (!t) throw new ApiFailure(404, 'ticket.not_found');
    const rs = await tx
      .select()
      .from(rounds)
      .where(eq(rounds.ticketId, id))
      .orderBy(asc(rounds.roundNo));
    const rvs = (
      await tx
        .select({ rv: reviews })
        .from(reviews)
        .innerJoin(rounds, eq(rounds.id, reviews.roundId))
        .where(eq(rounds.ticketId, id))
    ).map((x) => x.rv);
    const [mine] = await tx
      .select({ id: ticketAssignees.id })
      .from(ticketAssignees)
      .where(and(eq(ticketAssignees.ticketId, id), eq(ticketAssignees.userId, userId)));
    return {
      id: t.id,
      no: ticketNo(t.seqNo),
      title: t.title,
      body: t.body,
      priority: t.priority,
      status: t.status as TicketDetail['status'],
      project_id: t.projectId,
      current_round: t.currentRound,
      rev: t.rev,
      is_assignee: !!mine,
      rounds: rs.map((r) => {
        const rv = rvs.find((x) => x.roundId === r.id);
        return {
          round_no: r.roundNo,
          started_at: r.createdAt.toISOString(),
          cause: r.cause,
          status: r.status as TicketDetail['rounds'][number]['status'],
          reason: r.helpReason,
          flow_id: r.flowInstanceId,
          review_rev: r.reviewRev,
          delivery: (r.deliveryPayload as DeliveryCard | null) ?? null,
          review: rv
            ? {
                result: rv.result as 'approved' | 'rejected',
                reviewer_id: rv.reviewerId,
                comment: rv.comment,
                reject_category: rv.rejectCategory,
                location: (rv.location as ReviewRequest['location'] | null) ?? null,
                at: rv.createdAt.toISOString(),
              }
            : null,
        };
      }),
    };
  });
}

/**
 * 待我审核 → 审核通过 / 打回重修 (06 §3.1, 05 step 4). Only an assignee, only the latest round with
 * the digest and review_rev the reviewer saw; one review per round (whoever writes first). Sending
 * back starts the next round at once with the comment; the reviewed flow's review step closes either
 * way (the decision is the review row).
 */
export function reviewTicket(
  db: Db,
  userId: string,
  ws: string,
  id: string,
  req: ReviewRequest,
): Promise<TicketDetail> {
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const [t] = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .for('update');
    if (!t) throw new ApiFailure(404, 'ticket.not_found');
    const [mine] = await tx
      .select({ id: ticketAssignees.id })
      .from(ticketAssignees)
      .where(and(eq(ticketAssignees.ticketId, id), eq(ticketAssignees.userId, userId)));
    if (!mine) throw new ApiFailure(403, 'review.not_assignee');
    if (t.status !== 'in_review') throw new ApiFailure(409, 'review.not_in_review');
    const [round] = await tx
      .select()
      .from(rounds)
      .where(and(eq(rounds.ticketId, id), eq(rounds.roundNo, t.currentRound)));
    if (
      !round ||
      round.status !== 'delivered' ||
      round.roundNo !== req.round_no ||
      round.deliveryDigest !== req.delivery_digest ||
      round.reviewRev !== req.review_rev
    )
      throw new ApiFailure(409, 'review.stale');
    const comment = req.comment?.trim() ?? '';
    if (req.decision === 'reject' && !comment) throw new ApiFailure(400, 'review.comment_required');
    const approve = req.decision === 'approve';
    try {
      await insertRow(tx, ctx, reviews, {
        projectId: t.projectId,
        roundId: round.id,
        deliveryDigest: round.deliveryDigest!,
        reviewRev: round.reviewRev,
        result: approve ? 'approved' : 'rejected',
        reviewerId: userId,
        comment: comment || null,
        rejectCategory: approve ? null : (req.reject_category ?? null),
        riskLevel: round.riskLevel,
        location: approve ? null : (req.location ?? null),
        textSnapshot: comment || null,
      });
    } catch (e) {
      if (pgCode(e) === '23505') throw new ApiFailure(409, 'review.already_reviewed');
      throw e;
    }
    // the reviewed flow's human step is over
    if (round.flowInstanceId) {
      const [gate] = await tx
        .select()
        .from(nodeRuns)
        .where(
          and(
            eq(nodeRuns.flowInstanceId, round.flowInstanceId),
            eq(nodeRuns.status, 'waiting_human'),
          ),
        );
      if (gate)
        await pgOrchestrator.signal(tx, ctx, round.flowInstanceId, {
          type: 'node_finished',
          nodeRunId: gate.id,
          outcome: 'done',
        });
    }
    if (!approve) {
      await restartRound(tx, ctx, t, {
        cause: 'code_rejected',
        comment,
        roundId: round.id,
        category: req.reject_category ?? null,
        location: req.location ?? null,
      });
      return null;
    }
    const fresh = await updateRow(tx, ctx, tickets, t.id, { status: 'approved' } as never);
    await publish(tx, ctx, {
      entity: 'ticket',
      entityId: fresh.id,
      op: 'upsert',
      rev: fresh.rev,
      projectId: fresh.projectId,
      row: ticketSummary(fresh),
    });
    return null;
  }).then(() => ticketDetail(db, userId, ws, id));
}

/**
 * 打回重修 (06 §3.1): the next round starts at once on the branch the sent-back round delivered, with
 * the comment handed to the bot — after a code review, an MR review or a retest. Publishes the ticket.
 */
export async function restartRound(
  tx: Tx,
  ctx: ActorCtx,
  t: typeof tickets.$inferSelect,
  o: {
    cause: 'code_rejected' | 'mr_rejected' | 'test_rejected';
    comment: string;
    roundId: string;
    category?: string | null;
    location?: ReviewRequest['location'] | null;
  },
) {
  const [round] = await tx.select().from(rounds).where(eq(rounds.id, o.roundId));
  const [project] = await tx.select().from(projects).where(eq(projects.id, t.projectId));
  const repoSpecs = await projectRepoSpecs(tx, t.projectId);
  if (!repoSpecs.length) throw new ApiFailure(409, 'project.no_repos');
  const fresh = await updateRow(tx, ctx, tickets, t.id, {
    status: 'fixing',
    currentRound: t.currentRound + 1,
  } as never);
  await startRound(tx, ctx, {
    ticket: fresh,
    project: project!,
    repoSpecs,
    roundNo: t.currentRound + 1,
    cause: o.cause,
    branch: (round?.deliveryPayload as DeliveryCard | null)?.repos[0]?.branch || undefined,
    review: {
      round_no: round?.roundNo ?? t.currentRound,
      comment: o.comment,
      category: o.category ?? (o.cause === 'code_rejected' ? null : o.cause),
      location: o.location ?? null,
    },
  });
  await publish(tx, ctx, {
    entity: 'ticket',
    entityId: fresh.id,
    op: 'upsert',
    rev: fresh.rev,
    projectId: fresh.projectId,
    row: ticketSummary(fresh),
  });
  return fresh;
}

// ---------- after the executor wrote back ----------

/**
 * Called in the runner's write-back transaction, after the orchestrator advanced. No network here:
 * a passed replay only queues the delivery check.
 */
export async function roundStepFinished(
  tx: Tx,
  ctx: ActorCtx,
  flowId: string,
  nodeRunId: string,
  outcome: 'done' | 'failed',
) {
  const [round] = await tx.select().from(rounds).where(eq(rounds.flowInstanceId, flowId));
  if (!round || round.status !== 'fixing') return;
  const [run] = await tx.select().from(nodeRuns).where(eq(nodeRuns.id, nodeRunId));
  if (outcome === 'failed')
    return needsHelp(tx, ctx, round, (run?.errorRaw ?? 'step failed').slice(0, 300));
  const [flow] = await tx.select().from(flowInstances).where(eq(flowInstances.id, flowId));
  const node = (flow!.plan as Plan).nodes.find((n) => n.key === run!.nodeKey);
  if (node?.node_kind === 'deterministic_verify' && node.config?.action === 'replay')
    await enqueueWork(tx, ctx, {
      kind: ROUND_DELIVER,
      singletonKey: `round_deliver:${round.id}`,
      payload: { round_id: round.id, verify_node_run_id: nodeRunId },
    });
}

async function needsHelp(tx: Tx, ctx: ActorCtx, round: typeof rounds.$inferSelect, reason: string) {
  await updateRow(tx, ctx, rounds, round.id, { status: 'needs_help', helpReason: reason } as never);
  const t = await updateRow(tx, ctx, tickets, round.ticketId, { status: 'needs_help' } as never);
  await publish(tx, ctx, {
    entity: 'ticket',
    entityId: t.id,
    op: 'upsert',
    rev: t.rev,
    projectId: t.projectId,
    row: ticketSummary(t),
  });
  for (const a of await tx.select().from(ticketAssignees).where(eq(ticketAssignees.ticketId, t.id)))
    await notify(tx, ctx, a.userId, {
      eventType: 'round_needs_help',
      dedupeKey: `round_needs_help:${round.id}`,
      refType: 'ticket',
      refId: t.id,
      title: tr('notify.round_needs_help.title', { no: ticketNo(t.seqNo), title: t.title }),
      body: reason,
    });
}

const DEPS = /(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/;

/** L0–L2 by the project's rules (06 §5.7 item 2), defaults of 06 §13.6 for what they leave out. */
export function riskOf(
  repos: DeliveryRepoFacts[],
  touchedTests: string[],
  rules: RiskRules = {},
): { level: RiskLevel; reasons: string[] } {
  const r = { ...DEFAULT_RISK_RULES, ...rules };
  const words = r.high_risk_paths.map((w) => w.toLowerCase());
  const highRisk = (f: string) =>
    f
      .toLowerCase()
      .split('/')
      .some((seg) => words.some((w) => seg === w || seg.startsWith(`${w}.`)));
  const files = repos.flatMap((x) => x.files.map((f) => f.slice(2)));
  const lines = repos.reduce((n, x) => n + x.added + x.deleted, 0);
  const reasons: string[] = [];
  if (repos.length > 1) reasons.push('multi_repo');
  if (touchedTests.length) reasons.push('touched_existing_tests');
  if (files.some(highRisk)) reasons.push('high_risk_path');
  if (files.some((f) => DEPS.test(f))) reasons.push('dependency_change');
  if (lines > r.l1_max_lines || files.length > r.l1_max_files) reasons.push('large_change');
  if (reasons.length) return { level: 'L2', reasons };
  if (lines > r.l0_max_lines || files.length > r.l0_max_files)
    return { level: 'L1', reasons: ['medium_change'] };
  return { level: 'L0', reasons: [] };
}

/** cc-sys: finishes queued deliveries. Network only between the two lease transactions. */
export async function deliverRounds(db: Db, sources: SourceSettings, owner: string) {
  const leases = await claimWork(db, {
    kinds: [ROUND_DELIVER],
    limit: 5,
    owner,
    leaseSeconds: 120,
  });
  for (const lease of leases) await deliverOne(db, sources, lease);
}

interface Pending {
  round: typeof rounds.$inferSelect;
  card: Omit<DeliveryCard, 'delivered_at' | 'risk_level' | 'risk_reasons' | 'delivery_digest'>;
  checks: {
    repo: string;
    repoId: string;
    connectorId: string | null;
    remoteId: string | null;
    branch: string;
    head: string;
  }[];
  verdict: Record<string, unknown>;
  digests: Record<string, unknown>;
  verifyNodeRunId: string;
  rules: RiskRules;
}

async function deliverOne(db: Db, sources: SourceSettings, lease: Lease) {
  // 1. read what the executor reported, in the lease's workspace
  const pending = await withLeaseTx(db, lease, async (tx): Promise<Pending | null> => {
    const [item] = (
      await tx.execute<{ payload: { round_id: string; verify_node_run_id: string } }>(
        sql`select payload from work_items where id = ${lease.workItemId}`,
      )
    ).rows;
    const [round] = await tx.select().from(rounds).where(eq(rounds.id, item!.payload.round_id));
    if (!round || round.status !== 'fixing') return null;
    const [flow] = await tx
      .select()
      .from(flowInstances)
      .where(eq(flowInstances.id, round.flowInstanceId!));
    const runs = await tx
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.flowInstanceId, flow!.id))
      .orderBy(desc(nodeRuns.attemptNo));
    const fix = runs.find((r) => r.nodeKey === 'fix' && r.status === 'done')!;
    const verify = runs.find((r) => r.id === item!.payload.verify_node_run_id)!;
    const fo = (fix.structuredOutput ?? {}) as Record<string, unknown>;
    const vo = (verify.structuredOutput ?? {}) as Record<string, unknown>;
    const d = (fo.delivery ?? {}) as Record<string, unknown>;
    const changes = (fo.changes ?? []) as {
      repo: string;
      base_sha: string;
      head_sha: string;
      files: string[];
      added?: number;
      deleted?: number;
    }[];
    const pushed = (vo.pushed ?? []) as { repo: string; branch: string; head_sha: string }[];
    const plan = flow!.plan as Plan;
    const repoFacts: DeliveryRepoFacts[] = changes.map((c) => ({
      repo: c.repo,
      branch: pushed.find((p) => p.repo === c.repo)?.branch ?? '',
      base_sha: c.base_sha,
      head_sha: c.head_sha,
      files: c.files,
      added: c.added ?? 0,
      deleted: c.deleted ?? 0,
    }));
    const checks = [];
    for (const f of repoFacts) {
      const spec = (plan.repos ?? []).find((r) => r.name === f.repo)!;
      const [repo] = await tx.select().from(repos).where(eq(repos.id, spec.id));
      checks.push({
        repo: f.repo,
        repoId: spec.id,
        connectorId: repo?.connectorId ?? null,
        remoteId: repo?.remoteRepoId ?? null,
        branch: f.branch,
        head: f.head_sha,
      });
    }
    const verdict = (vo.verdict ?? {}) as Record<string, boolean>;
    const [project] = await tx
      .select({ rules: projects.riskRules })
      .from(projects)
      .where(eq(projects.id, round.projectId));
    // screenshots the executor uploaded during the replay
    const files = await tx
      .select({ id: evidences.id, name: evidences.name })
      .from(evidences)
      .where(eq(evidences.nodeRunId, verify.id));
    const shot = (side: 'base' | 'head') => (x: { name: string; sha256: string }) => {
      const name = evidenceName(side, x.name);
      return {
        name,
        sha256: x.sha256,
        evidence_id: files.find((f) => f.name === name)?.id ?? null,
      };
    };
    const browser = vo.browser as
      | {
          base?: { screenshots?: { name: string; sha256: string }[] };
          head?: { screenshots?: { name: string; sha256: string }[] };
        }
      | undefined;
    return {
      round,
      verifyNodeRunId: verify.id,
      rules: (project?.rules ?? {}) as RiskRules,
      verdict,
      digests: (vo.digests ?? {}) as Record<string, unknown>,
      checks,
      card: {
        round_no: round.roundNo,
        root_cause: String(d.root_cause ?? ''),
        summary: String(d.summary ?? ''),
        verification: String(d.verification ?? ''),
        repos: repoFacts,
        checks: Object.entries(verdict).map(([key, ok]) => ({ key, ok: !!ok })),
        repro: { tests: (d.repro_tests as string[]) ?? [], browser: !!d.browser_repro },
        screenshots: [
          ...(browser?.base?.screenshots ?? []).map(shot('base')),
          ...(browser?.head?.screenshots ?? []).map(shot('head')),
        ],
        touched_tests: (fo.touched_tests as string[]) ?? [],
        model: typeof fo.model === 'string' ? fo.model : null,
      },
    };
  });

  // 2. the facts, from the platform (outside any transaction)
  let mismatch: string | null = null;
  if (pending) {
    if (!pending.card.repos.length) mismatch = 'facts.no_changes';
    for (const c of pending.checks) {
      if (mismatch) break;
      if (!c.connectorId || !c.remoteId) continue;
      const head = await withLeaseTx(db, lease, (tx) => opened(tx, sources, c.connectorId!)).then(
        (o) => o.plugin.branchHead(o.config, o.credential, c.remoteId!, c.branch),
      );
      if (head !== c.head) mismatch = `facts.head_mismatch:${c.repo}`;
    }
  }

  // 3. record the outcome with the lease
  await withLeaseTx(db, lease, async (tx, ctx) => {
    if (pending) {
      const fresh = (await tx.select().from(rounds).where(eq(rounds.id, pending.round.id)))[0]!;
      if (fresh.status === 'fixing') {
        if (mismatch) await needsHelp(tx, ctx, fresh, mismatch);
        else if (pending.card.touched_tests.length)
          await needsHelp(tx, ctx, fresh, 'gate.touched_existing_tests');
        else await recordDelivery(tx, ctx, fresh, pending);
      }
    }
    await completeWork(tx, {
      workspaceId: lease.workspaceId,
      workItemId: lease.workItemId,
      leaseToken: lease.leaseToken,
      fence: lease.fence,
    });
  });
}

async function recordDelivery(
  tx: Tx,
  ctx: ActorCtx,
  round: typeof rounds.$inferSelect,
  p: Pending,
) {
  const risk = riskOf(p.card.repos, p.card.touched_tests, p.rules);
  const digest = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        repos: p.card.repos.map((r) => [r.repo, r.head_sha]),
        root_cause: p.card.root_cause,
        checks: p.card.checks,
      }),
    )
    .digest('hex');
  const card: DeliveryCard = {
    ...p.card,
    delivered_at: new Date().toISOString(),
    risk_level: risk.level,
    risk_reasons: risk.reasons,
    delivery_digest: digest,
  };
  for (const c of p.checks) {
    const f = p.card.repos.find((r) => r.repo === c.repo)!;
    await insertRow(tx, ctx, roundRepoSlices, {
      projectId: round.projectId,
      roundId: round.id,
      repoId: c.repoId,
      branch: f.branch,
      startSha: f.base_sha,
      headSha: f.head_sha,
    });
  }
  await insertRow(tx, ctx, verifyRuns, {
    projectId: round.projectId,
    roundId: round.id,
    nodeRunId: p.verifyNodeRunId,
    verdict: p.verdict,
    digests: p.digests,
    passed: true,
  });
  await updateRow(tx, ctx, rounds, round.id, {
    status: 'delivered',
    deliveryMode: 'code_fix',
    deliveryPayload: card,
    deliveryDigest: digest,
    riskLevel: risk.level,
  } as never);
  const t = await updateRow(tx, ctx, tickets, round.ticketId, { status: 'in_review' } as never);
  await publish(tx, ctx, {
    entity: 'ticket',
    entityId: t.id,
    op: 'upsert',
    rev: t.rev,
    projectId: t.projectId,
    row: ticketSummary(t),
  });
  for (const a of await tx.select().from(ticketAssignees).where(eq(ticketAssignees.ticketId, t.id)))
    await notify(tx, ctx, a.userId, {
      eventType: 'round_delivered',
      dedupeKey: `round_delivered:${round.id}`,
      refType: 'ticket',
      refId: t.id,
      title: tr('notify.round_delivered.title', { no: ticketNo(t.seqNo), round: round.roundNo }),
      body: t.title,
    });
}
