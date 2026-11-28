// Executors: enrollment and the RunnerTransport calls implemented in E1 (docs/06 §2.12, §5.3a).
// A runner leases one node run at a time per free slot, renews while it works, and writes back
// with the lease token and fence it was handed; the write-back commits together with advance().
import crypto from 'node:crypto';
import {
  ENROLL_TOKEN_PREFIX,
  STEP_OUTPUT_LIMIT,
  type CompleteStepRequest,
  type CredentialEnvelope,
  type FetchCredentialRequest,
  type HeartbeatRequest,
  type HeartbeatResponse,
  type RegisterRunnerRequest,
  type RegisterRunnerResponse,
  type StepAssignment,
} from '@cloudcraft/core-protocol';
import { and, eq, sql } from 'drizzle-orm';
import {
  LeaseLostError,
  withEnrollTx,
  withRunnerTx,
  type ActorCtx,
  type Db,
  type Tx,
} from '../db/client.ts';
import {
  connectors,
  nodeRuns,
  runnerKeys,
  runners,
  secretDeliveries,
  secretItems,
} from '../db/schema/index.ts';
import { ApiFailure } from './errors.ts';
import { connectorOf } from './plugins.ts';
import { openSecret, sealToRunner } from './secrets.ts';
import type { SourceSettings } from './source-service.ts';
import { roundStepFinished } from './ticket-service.ts';
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
    if (!runner.drainMode) assigned.push(...(await claimSteps(tx, ctx, s, runner, req.free_slots)));
    return { lost, assigned, poll_ms: s.pollMs };
  });
}

/** Leases up to `limit` sandbox steps of the kinds the runner's roles take. */
async function claimSteps(
  tx: Tx,
  ctx: ActorCtx,
  s: RunnerSettings,
  runner: Awaited<ReturnType<typeof getRunner>>,
  limit: number,
  flowId?: string,
): Promise<StepAssignment[]> {
  const out: StepAssignment[] = [];
  for (const role of runner.runnerRoles) {
    const kind = KIND_FOR_ROLE[role];
    if (!kind) continue;
    const items = await claimForRunner(tx, {
      runnerId: runner.id,
      kind,
      limit: limit - out.length,
      seconds: s.leaseSeconds,
      flowId,
    });
    for (const item of items) out.push(await assignment(tx, ctx, runner.id, item));
  }
  return out;
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

/**
 * Write-back: refused unless this runner still holds the lease with the same fence. With take_next,
 * a sandbox step of the same flow that the write-back opened is leased to this runner in the same
 * transaction, so a segment of execution nodes stays where its workspace is (06 §2.12).
 */
export async function completeRoundStep(
  db: Db,
  s: RunnerSettings,
  auth: { runnerId: string; secret: string },
  req: CompleteStepRequest,
): Promise<StepAssignment | null> {
  if (JSON.stringify(req.output).length > STEP_OUTPUT_LIMIT)
    throw new OutputTooLargeError('step output too large');
  return withRunnerTx(db, auth, async (tx, ctx) => {
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
    // a round's ticket follows its flow (06 §3.1, §3.2)
    await roundStepFinished(tx, ctx, p.flow_instance_id, p.node_run_id, req.outcome);
    if (!req.take_next) return null;
    const runner = await getRunner(tx, auth.runnerId);
    if (runner.drainMode) return null;
    const [next] = await claimSteps(tx, ctx, s, runner, 1, p.flow_instance_id);
    return next ?? null;
  });
}

/**
 * The credential of a repo in the step this runner holds, sealed to its bot_exec key (06 §2.10). Only
 * secrets the step's plan references, never personal_exec, and every delivery is recorded so a stolen
 * executor's secrets can be re-issued.
 */
export async function fetchCredential(
  db: Db,
  sources: SourceSettings,
  auth: { runnerId: string; secret: string },
  req: FetchCredentialRequest,
): Promise<CredentialEnvelope> {
  return withRunnerTx(db, auth, async (tx) => {
    const item = await lockHeldLease(tx, auth.runnerId, req);
    if (!item) throw new LeaseLostError();
    const { flow } = await getNodeRunWithFlow(
      tx,
      (item.payload as { node_run_id: string }).node_run_id,
    );
    const refs = ((flow.plan as Plan).repos ?? []).map((r) => r.credential_ref);
    if (!refs.includes(req.secret_id)) throw new ApiFailure(403, 'runner.credential_not_in_step');
    const [row] = await tx
      .select({ secret: secretItems, connector: connectors })
      .from(secretItems)
      .innerJoin(connectors, eq(connectors.secretId, secretItems.id))
      .where(eq(secretItems.id, req.secret_id));
    if (!row?.secret.ciphertext || !row.secret.wrappedDek)
      throw new ApiFailure(404, 'runner.credential_gone');
    if (row.secret.credentialClass === 'personal_exec')
      throw new ApiFailure(403, 'runner.credential_not_for_bot');
    const [key] = await tx
      .select()
      .from(runnerKeys)
      .where(
        and(
          eq(runnerKeys.runnerId, auth.runnerId),
          eq(runnerKeys.keyRole, 'bot_exec'),
          eq(runnerKeys.status, 'active'),
        ),
      );
    if (!key) throw new ApiFailure(409, 'runner.no_key');
    const plugin = connectorOf(sources.connectors, row.connector.pluginId);
    const h = plugin.gitAuth(
      openSecret(sources.masterKey, {
        ciphertext: row.secret.ciphertext,
        wrappedDek: row.secret.wrappedDek,
      }),
    );
    const env = sealToRunner(key.publicKey, key.keyFingerprint, req.secret_id, {
      git_http_header: `${h.header}: ${h.value}`,
    });
    await tx
      .insert(secretDeliveries)
      .values({
        workspaceId: item.workspaceId,
        secretId: req.secret_id,
        runnerId: auth.runnerId,
        keyEpoch: row.secret.keyEpoch,
      })
      .onConflictDoUpdate({
        target: [
          secretDeliveries.workspaceId,
          secretDeliveries.secretId,
          secretDeliveries.runnerId,
        ],
        set: { lastDeliveredAt: sql`now()`, keyEpoch: row.secret.keyEpoch },
      });
    return env;
  });
}
