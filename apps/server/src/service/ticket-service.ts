// Tickets and their first delivery round (docs/06 §2.5, §3.1, §3.2, §5.7; 05 step 3).
//   create: M-<seq> number, the creator as assignee, round 1 compiled from the built-in template
//           "standard frontend bug fix" (prepare → AI fix → host replay → human review), dispatched
//   after the replay passed: a round_deliver work item; cc-sys checks the facts outside any
//           transaction (each fix/ branch head on the platform must be the commit the host made), then
//           records the delivery card, risk level and digest, moves the ticket to review and notifies
//   a failed node: the round needs help, with the reason
import crypto from 'node:crypto';
import type {
  CreateTicketRequest,
  DeliveryCard,
  DeliveryRepoFacts,
  RiskLevel,
  TicketDetail,
} from '@cloudcraft/core-protocol';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { withLeaseTx, type ActorCtx, type Db, type Lease, type Tx } from '../db/client.ts';
import {
  environments,
  flowInstances,
  nodeRuns,
  projects,
  repos,
  roundRepoSlices,
  rounds,
  ticketAssignees,
  tickets,
  verifyRuns,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan } from '../orchestrator/advance.ts';
import { pgOrchestrator } from '../orchestrator/flow.ts';
import { claimWork, completeWork, enqueueWork } from '../orchestrator/queue.ts';
import { nextTicketNo } from '../repo/ticket-repo.ts';
import { publish } from './changes.ts';
import { ApiFailure } from './errors.ts';
import { tr } from './i18n.ts';
import { inWorkspace, notify, permissionsOf } from './iam-service.ts';
import { opened, projectRepoSpecs, type SourceSettings } from './source-service.ts';
import { grants } from '@cloudcraft/core-protocol';

export const ROUND_DELIVER = 'round_deliver';
export const STANDARD_FRONTEND_BUGFIX = 'standard_frontend_bugfix';

/** The built-in template (06 §5.1 presets), compiled into the round's frozen plan. */
function compilePlan(o: {
  repos: Plan['repos'];
  branch: string;
  material: { title: string; body: string };
  envUrl: string | null;
}): Plan {
  return {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: o.repos,
    nodes: [
      { key: 'prepare', kind: 'auto', node_kind: 'host_prepare', config: { branch: o.branch } },
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

const ticketNo = (seq: number | null) => (seq === null ? '' : `M-${seq}`);
const summary = (t: typeof tickets.$inferSelect) => ({
  id: t.id,
  no: ticketNo(t.seqNo),
  title: t.title,
  status: t.status,
  priority: t.priority,
  current_round: t.currentRound,
});

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
    const [env] = await tx
      .select()
      .from(environments)
      .where(
        and(
          eq(environments.projectId, projectId),
          eq(environments.envTier, 'test_gate'),
          isNull(environments.deletedAt),
        ),
      )
      .orderBy(asc(environments.sortOrder));
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
    const round = await insertRow(tx, ctx, rounds, {
      projectId,
      ticketId: ticket.id,
      roundNo: 1,
      status: 'fixing',
    });
    const steps = (req.repro_steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    const plan = compilePlan({
      repos: repoSpecs,
      branch: `fix/${project.slug}/${ticketNo(seq)}`,
      material: {
        title: req.title,
        body: steps ? `${req.body}\n\n${tr('ticket.repro_steps')}\n${steps}` : req.body,
      },
      envUrl: env?.entryUrl ?? null,
    });
    const flowId = await pgOrchestrator.startFlow(tx, ctx, { projectId, kind: 'round', plan });
    await updateRow(tx, ctx, flowInstances, flowId, {
      ticketId: ticket.id,
      roundId: round.id,
    } as never);
    await updateRow(tx, ctx, rounds, round.id, { flowInstanceId: flowId } as never);
    await publish(tx, ctx, {
      entity: 'ticket',
      entityId: ticket.id,
      op: 'upsert',
      rev: ticket.rev,
      projectId,
      row: summary(ticket),
    });
    return { ...summary(ticket), flow_id: flowId };
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

export function listTickets(db: Db, userId: string, ws: string) {
  return inWorkspace(db, userId, ws, async (tx) => {
    const rows = await tx
      .select()
      .from(tickets)
      .where(isNull(tickets.deletedAt))
      .orderBy(desc(tickets.updatedAt))
      .limit(200);
    return { items: rows.map(summary), next_cursor: null, has_more: false };
  });
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
      rounds: rs.map((r) => ({
        round_no: r.roundNo,
        status: r.status as TicketDetail['rounds'][number]['status'],
        reason: r.helpReason,
        flow_id: r.flowInstanceId,
        delivery: (r.deliveryPayload as DeliveryCard | null) ?? null,
      })),
    };
  });
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
    row: summary(t),
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

const HIGH_RISK = /(^|\/)(auth|rbac|pay|salary|migrations?)(\/|\.|$)|(^|\/)Dockerfile$/i;
const DEPS = /(^|\/)(package\.json|pnpm-lock\.yaml|yarn\.lock|package-lock\.json)$/;

/** Default thresholds of 06 §13.6 (≤30 lines / ≤3 files, ≤300 / ≤15); project rules override later. */
export function riskOf(
  repos: DeliveryRepoFacts[],
  touchedTests: string[],
): { level: RiskLevel; reasons: string[] } {
  const files = repos.flatMap((r) => r.files.map((f) => f.slice(2)));
  const lines = repos.reduce((n, r) => n + r.added + r.deleted, 0);
  const reasons: string[] = [];
  if (repos.length > 1) reasons.push('multi_repo');
  if (touchedTests.length) reasons.push('touched_existing_tests');
  if (files.some((f) => HIGH_RISK.test(f))) reasons.push('high_risk_path');
  if (files.some((f) => DEPS.test(f))) reasons.push('dependency_change');
  if (lines > 300 || files.length > 15) reasons.push('large_change');
  if (reasons.length) return { level: 'L2', reasons };
  if (lines > 30 || files.length > 3) return { level: 'L1', reasons: ['medium_change'] };
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
    const browser = vo.browser as
      | {
          base?: { screenshots?: { name: string; sha256: string }[] };
          head?: { screenshots?: { name: string; sha256: string }[] };
        }
      | undefined;
    return {
      round,
      verifyNodeRunId: verify.id,
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
          ...(browser?.base?.screenshots ?? []).map((s) => ({
            name: `base-${s.name}`,
            sha256: s.sha256,
          })),
          ...(browser?.head?.screenshots ?? []).map((s) => ({
            name: `head-${s.name}`,
            sha256: s.sha256,
          })),
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
  const risk = riskOf(p.card.repos, p.card.touched_tests);
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
    row: summary(t),
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
