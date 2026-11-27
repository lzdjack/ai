// Executors: enrollment and the RunnerTransport calls implemented in E1 (docs/06 §2.12, §5.3a).
// A runner leases one node run at a time per free slot, renews while it works, and writes back
// with the lease token and fence it was handed; the write-back commits together with advance().
import crypto from 'node:crypto';
import {
  ENROLL_TOKEN_PREFIX,
  STEP_OUTPUT_LIMIT,
  type CompleteStepRequest,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type RegisterRunnerRequest,
  type RegisterRunnerResponse,
  type StepAssignment,
} from '@cloudcraft/core-protocol';
import { sql } from 'drizzle-orm';
import {
  LeaseLostError,
  withEnrollTx,
  withRunnerTx,
  type ActorCtx,
  type Db,
  type Tx,
} from '../db/client.ts';
import { nodeRuns, runnerKeys, runners } from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import type { Plan } from '../orchestrator/advance.ts';
import { BOT_STEP, pgOrchestrator } from '../orchestrator/flow.ts';
import { completeWork } from '../orchestrator/queue.ts';
import {
  claimForRunner,
  getNodeRunWithFlow,
  getRunner,
  lockHeldLease,
  renewLeases,
  touchRunner,
} from '../repo/runner-repo.ts';

export interface RunnerSettings {
  leaseSeconds: number;
  pollMs: number;
}

export class OutputTooLargeError extends Error {
  readonly code = 'runner.output_too_large';
}

const sha256hex = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');

/** Valid for 15 minutes, shown once (06 §5.3a). Who may issue one is checked by the caller (P2). */
export const ENROLL_TOKEN_MINUTES = 15;

export async function issueEnrollToken(
  tx: Tx,
  ctx: ActorCtx,
  o: { name: string; roles?: string[] },
): Promise<{ runnerId: string; token: string }> {
  const token = ENROLL_TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  const r = await insertRow(tx, ctx, runners, {
    name: o.name,
    runnerRoles: o.roles ?? ['bot'],
    enrollTokenHash: sha256hex(token),
    enrollExpiresAt: sql`now() + make_interval(mins => ${ENROLL_TOKEN_MINUTES})`,
  });
  return { runnerId: r.id, token };
}

export async function registerRunner(
  db: Db,
  s: RunnerSettings,
  req: RegisterRunnerRequest,
): Promise<RegisterRunnerResponse> {
  return withEnrollTx(db, req.enroll_token, async (tx, ctx, runnerId) => {
    await updateRow(tx, ctx, runners, runnerId, {
      status: 'online',
      enrollTokenHash: null,
      enrollExpiresAt: null,
      authTokenHash: req.secret_sha256,
      lastHeartbeatAt: sql`now()`,
    });
    await insertRow(tx, ctx, runnerKeys, {
      runnerId,
      keyRole: 'bot_exec',
      publicKey: req.bot_exec_public_key,
      keyFingerprint: sha256hex(Buffer.from(req.bot_exec_public_key, 'base64')),
    });
    return {
      runner_id: runnerId,
      workspace_id: ctx.workspaceId,
      lease_seconds: s.leaseSeconds,
      poll_ms: s.pollMs,
    };
  });
}

/** Work kinds a runner role takes. Release executor work comes with P6. */
const KIND_FOR_ROLE: Record<string, string> = { bot: BOT_STEP };

export async function heartbeatAndPoll(
  db: Db,
  s: RunnerSettings,
  auth: { runnerId: string; secret: string },
  req: HeartbeatRequest,
): Promise<HeartbeatResponse> {
  return withRunnerTx(db, auth, async (tx, ctx) => {
    await touchRunner(tx, auth.runnerId);
    const renewed = await renewLeases(tx, auth.runnerId, req.leases, s.leaseSeconds);
    const lost = req.leases.map((l) => l.work_item_id).filter((id) => !renewed.has(id));

    const runner = await getRunner(tx, auth.runnerId);
    const assigned: StepAssignment[] = [];
    if (!runner.drainMode) {
      for (const role of runner.runnerRoles) {
        const kind = KIND_FOR_ROLE[role];
        if (!kind) continue;
        const items = await claimForRunner(tx, {
          runnerId: auth.runnerId,
          kind,
          limit: req.free_slots - assigned.length,
          seconds: s.leaseSeconds,
        });
        for (const item of items) assigned.push(await assignment(tx, ctx, auth.runnerId, item));
      }
    }
    return { lost, assigned, poll_ms: s.pollMs };
  });
}

async function assignment(
  tx: Tx,
  ctx: ActorCtx,
  runnerId: string,
  item: Awaited<ReturnType<typeof claimForRunner>>[number],
): Promise<StepAssignment> {
  const p = item.payload as { node_run_id: string };
  const { run, flow } = await getNodeRunWithFlow(tx, p.node_run_id);
  const plan = flow.plan as Plan;
  const node = plan.nodes.find((n) => n.key === run.nodeKey)!;
  await updateRow(tx, ctx, nodeRuns, run.id, { executorId: runnerId });
  return {
    work_item_id: item.id,
    lease_token: item.leaseToken!,
    fence: item.fence,
    lease_expires_at: item.leaseExpiresAt!.toISOString(),
    flow_instance_id: flow.id,
    node_run_id: run.id,
    node_key: run.nodeKey,
    node_kind: node.node_kind ?? run.nodeKind,
    attempt_no: run.attemptNo,
    repo_id: run.repoId,
    config: node.config ?? {},
    repos: plan.repos ?? [],
  };
}

/** Write-back: refused unless this runner still holds the lease with the same fence. */
export async function completeRoundStep(
  db: Db,
  auth: { runnerId: string; secret: string },
  req: CompleteStepRequest,
): Promise<void> {
  if (JSON.stringify(req.output).length > STEP_OUTPUT_LIMIT)
    throw new OutputTooLargeError('step output too large');
  await withRunnerTx(db, auth, async (tx, ctx) => {
    const item = await lockHeldLease(tx, auth.runnerId, req);
    if (!item) throw new LeaseLostError();
    const p = item.payload as { flow_instance_id: string; node_run_id: string };
    await updateRow(tx, ctx, nodeRuns, p.node_run_id, {
      structuredOutput: req.output,
      ...(req.error ? { errorRaw: req.error } : {}),
    });
    await completeWork(tx, {
      workspaceId: ctx.workspaceId,
      workItemId: item.id,
      leaseToken: req.lease_token,
      fence: req.fence,
    });
    await pgOrchestrator.signal(tx, ctx, p.flow_instance_id, {
      type: 'node_finished',
      nodeRunId: p.node_run_id,
      outcome: req.outcome,
    });
  });
}
