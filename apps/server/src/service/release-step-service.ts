// Delivery steps run by executors (docs/06 §1.2, §2.10, §3.3, §3.6, §7.1, §7.3):
//   build (build sandbox, Bot executor: no credentials, no network) → uploads the artifact here;
//   merge / publish / release / verify (release executor: credentials, never repository code).
// The server decides everything a step needs when it is handed out (what to merge, which version,
// which provider environment), whose account it runs with (sealed to the release_exec key only),
// takes the serial lock, and registers outside effects first so a retry reads back.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  type CheckAncestryRequest,
  type CredentialEnvelope,
  type FetchArtifactRequest,
  type HeldLease,
  type StepSecrets,
  type UploadArtifactRequest,
} from '@cloudcraft/core-protocol';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { LeaseLostError, withRunnerTx, type ActorCtx, type Db, type Tx } from '../db/client.ts';
import {
  connectors,
  effects,
  environments,
  mergeRequests,
  releaseConfigs,
  releaseSteps,
  releaseTasks,
  repos,
  runnerKeys,
  secretDeliveries,
  tickets,
  workItems,
  type nodeRuns,
  type flowInstances,
} from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import type { Plan, PlanNode } from '../orchestrator/advance.ts';
import { registerEffect } from '../orchestrator/queue.ts';
import { getNodeRunWithFlow, lockHeldLease } from '../repo/runner-repo.ts';
import { cfgOf, stageTask, stepFailed } from './delivery-service.ts';
import { ApiFailure } from './errors.ts';
import { openPersonal } from './personal-accounts.ts';
import { sealToRunner } from './secrets.ts';
import { openConnector, opened, type SourceSettings } from './source-service.ts';
import { ticketNo } from './ticket-service.ts';

type Run = typeof nodeRuns.$inferSelect;
type Flow = typeof flowInstances.$inferSelect;

/** Delivery steps an executor runs (the rest of a delivery flow is people or cc-sys). */
export const isExecutorDeliveryStep = (n: PlanNode | undefined) =>
  (n?.node_kind === 'release_deploy' &&
    ['build', 'publish', 'release', 'verify'].includes(String(cfgOf(n).slot))) ||
  (n?.node_kind === 'cr_merge' && cfgOf(n).step === 'merge');

const effectKind = (n: PlanNode) =>
  n.node_kind === 'cr_merge'
    ? 'merge'
    : ['publish', 'release'].includes(String(cfgOf(n).slot))
      ? cfgOf(n).slot!
      : null;

/**
 * The serial lock (06 §7.3): one running release per target and environment. Taken when a step of a
 * release runs; held until it is effective, failed or cancelled. False: someone else holds it.
 */
async function takeLock(tx: Tx, ctx: ActorCtx, task: typeof releaseTasks.$inferSelect) {
  if (task.status === 'running') return true;
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('cc:release_lock'), hashtext(${`${task.repoId}:${task.environmentId}`}))`,
  );
  const others = await tx
    .select({ id: releaseTasks.id })
    .from(releaseTasks)
    .where(
      and(
        eq(releaseTasks.repoId, task.repoId),
        eq(releaseTasks.environmentId, task.environmentId),
        eq(releaseTasks.status, 'running'),
      ),
    );
  if (others.some((o) => o.id !== task.id)) {
    if (task.status !== 'waiting_lock')
      await updateRow(tx, ctx, releaseTasks, task.id, { status: 'waiting_lock' } as never);
    return false;
  }
  await updateRow(tx, ctx, releaseTasks, task.id, { status: 'running' } as never);
  return true;
}

/** Puts a just-claimed item back in the queue for a while (lock busy). */
async function defer(tx: Tx, workItemId: string, seconds: number) {
  await tx
    .update(workItems)
    .set({
      status: 'queued',
      leaseToken: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      runAfter: sql`now() + make_interval(secs => ${seconds})`,
      updatedAt: sql`now()`,
    })
    .where(eq(workItems.id, workItemId));
}

/**
 * Called when a delivery step is handed to an executor: adds what the step needs to its config,
 * records the release_steps row and registers the outside effect. null: deferred (lock busy).
 */
export async function prepareDeliveryStep(
  tx: Tx,
  ctx: ActorCtx,
  workItemId: string,
  run: Run,
  flow: Flow,
  node: PlanNode,
): Promise<Record<string, unknown> | null> {
  const c = cfgOf(node);
  const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
  const name = repo!.path.split('/').pop()!;
  let extra: Record<string, unknown>;
  let effectKey: string | null = null;

  if (node.node_kind === 'cr_merge') {
    const [mr] = await tx
      .select()
      .from(mergeRequests)
      .where(
        and(
          eq(mergeRequests.flowInstanceId, flow.id),
          eq(mergeRequests.direction, c.direction!),
          inArray(mergeRequests.state, ['open', 'merged']),
        ),
      );
    if (!mr) throw new ApiFailure(409, 'merge.not_found');
    const [t] = await tx.select().from(tickets).where(eq(tickets.id, flow.ticketId!));
    extra = {
      action: 'merge',
      remote_id: repo!.remoteRepoId,
      mr_iid: mr.externalIid,
      expected_sha: mr.headSha,
      message: `Merge branch '${mr.sourceBranch}' into '${mr.targetBranch}'\n\n${ticketNo(t!.seqNo)} ${t!.title}`,
    };
    effectKey = `merge:${mr.id}`;
  } else {
    const task = await stageTask(tx, flow.id, c.env_id);
    if (!task) throw new ApiFailure(409, 'release.task_missing');
    if (!(await takeLock(tx, ctx, task))) {
      await defer(tx, workItemId, 10);
      return null;
    }
    const rc = (
      await tx.select().from(releaseConfigs).where(eq(releaseConfigs.id, c.release_config_id))
    )[0]!;
    const [env] = await tx
      .select()
      .from(environments)
      .where(eq(environments.id, task.environmentId));
    const envMap = ((rc.targetRef as { env_map?: Record<string, string> }).env_map ?? {}) as Record<
      string,
      string
    >;
    // the provider's environment code comes from the task, never from the AI or a person (06 §7.4.2)
    const providerEnv = envMap[env!.envCode] ?? env!.envCode.toUpperCase();
    const base = {
      action: c.slot,
      release_task_id: task.id,
      target_repo: name,
      // where the target lives on the provider (release_configs.target_ref), not a secret
      target: task.targetRef,
    };
    if (c.slot === 'build') extra = { ...base, ref: task.sourceBranch };
    else if (c.slot === 'publish') {
      extra = {
        ...base,
        version: task.version,
        commit: task.buildCommit,
        files: task.artifactManifest,
      };
      effectKey = `publish:${task.id}:${task.version}`;
    } else if (c.slot === 'release') {
      const [t] = await tx.select().from(tickets).where(eq(tickets.id, flow.ticketId!));
      extra = {
        ...base,
        provider_env: providerEnv,
        version: task.version,
        commit: task.buildCommit,
        location: task.artifactLocation,
        title: `${task.version} · ${ticketNo(t!.seqNo)}`,
        repo_id: c.repo_id,
      };
      effectKey = `release:${task.id}:${task.version}`;
    } else
      extra = {
        ...base,
        provider_env: providerEnv,
        expect_commit: task.buildCommit,
        repo_id: c.repo_id,
      };

    const [existing] = await tx
      .select()
      .from(releaseSteps)
      .where(eq(releaseSteps.nodeRunId, run.id));
    const command =
      c.slot === 'build'
        ? `${task.sourceBranch} · ${(flow.plan as Plan).repos?.find((r) => r.id === c.repo_id)?.build_command ?? ''}`
        : `craft ${c.slot}${c.slot === 'publish' ? '' : ` --env ${providerEnv}`}`;
    if (existing)
      await updateRow(tx, ctx, releaseSteps, existing.id, { startedAt: sql`now()` } as never);
    else
      await insertRow(tx, ctx, releaseSteps, {
        projectId: flow.projectId,
        releaseTaskId: task.id,
        nodeRunId: run.id,
        slot: c.slot!,
        status: 'running',
        command,
        attempt: run.attemptNo,
      });
  }

  // outside effects are registered before they run; one registered earlier without an outcome means
  // the executor must read back first and skip what already happened (06 §3.3, §3.6 item 5)
  let readBack = false;
  if (effectKey) {
    const { effect, created } = await registerEffect(tx, ctx, {
      key: effectKey,
      kind: effectKind(node) ?? 'release',
      request: extra,
      nodeRunId: run.id,
    });
    if (!created) {
      readBack = effect.status !== 'succeeded';
      await tx
        .update(effects)
        .set({ status: 'pending', nodeRunId: run.id, updatedAt: sql`now()` })
        .where(eq(effects.id, effect.id));
    }
  }
  return { ...extra, read_back_first: readBack };
}

/** Write-back of an executor's delivery step, in the same transaction as advance(). */
export async function deliveryStepFinished(
  tx: Tx,
  ctx: ActorCtx,
  flowId: string,
  nodeRunId: string,
  outcome: 'done' | 'failed',
  output: Record<string, unknown>,
  error: string | undefined,
) {
  const { run, flow } = await getNodeRunWithFlow(tx, nodeRunId);
  if (flow.kind !== 'delivery') return;
  const node = (flow.plan as Plan).nodes.find((n) => n.key === run.nodeKey);
  if (!isExecutorDeliveryStep(node)) return;
  const c = cfgOf(node);
  await tx
    .update(effects)
    .set({
      status: outcome === 'done' ? 'succeeded' : 'failed',
      result: output,
      verifiedAt: output.read_back ? sql`now()` : null,
      updatedAt: sql`now()`,
    })
    .where(and(eq(effects.nodeRunId, nodeRunId), eq(effects.status, 'pending')));
  const [step] = await tx.select().from(releaseSteps).where(eq(releaseSteps.nodeRunId, nodeRunId));
  if (step)
    await updateRow(tx, ctx, releaseSteps, step.id, {
      status: outcome === 'done' ? 'succeeded' : 'failed',
      ...(typeof output.command === 'string' ? { command: output.command } : {}),
      exitCode: outcome === 'done' ? 0 : 1,
      errorSummary: error?.slice(0, 1000) ?? null,
      logTail: typeof output.log_tail === 'string' ? output.log_tail.slice(-4000) : null,
      finishedAt: sql`now()`,
    } as never);
  if (outcome === 'failed') return stepFailed(tx, ctx, flowId, nodeRunId, error ?? 'failed');

  if (node!.node_kind === 'cr_merge') {
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
    if (mr)
      await updateRow(tx, ctx, mergeRequests, mr.id, {
        state: 'merged',
        mergeSha: String(output.merge_sha ?? ''),
      } as never);
    return;
  }
  const task = await stageTask(tx, flow.id, c.env_id);
  if (!task) return;
  if (c.slot === 'publish')
    await updateRow(tx, ctx, releaseTasks, task.id, { artifactLocation: output.location } as never);
  if (c.slot === 'verify')
    await updateRow(tx, ctx, releaseTasks, task.id, {
      verifiedRevision: String(output.revision ?? ''),
    } as never);
}

/** The lease reaper found a delivery step that died mid-effect (06 §3.3 「失败 · 执行中断」). */
export async function deliveryStepInterrupted(
  tx: Tx,
  ctx: ActorCtx,
  flowId: string,
  nodeRunId: string,
) {
  const [step] = await tx.select().from(releaseSteps).where(eq(releaseSteps.nodeRunId, nodeRunId));
  if (step)
    await updateRow(tx, ctx, releaseSteps, step.id, {
      status: 'failed',
      errorSummary: 'interrupted',
      finishedAt: sql`now()`,
    } as never);
  await stepFailed(tx, ctx, flowId, nodeRunId, 'interrupted');
}

// ---------- runner calls ----------

async function heldDeliveryStep(tx: Tx, runnerId: string, l: HeldLease) {
  const item = await lockHeldLease(tx, runnerId, l);
  if (!item) throw new LeaseLostError();
  const { run, flow } = await getNodeRunWithFlow(
    tx,
    (item.payload as { node_run_id: string }).node_run_id,
  );
  const node = (flow.plan as Plan).nodes.find((n) => n.key === run.nodeKey);
  if (flow.kind !== 'delivery' || !isExecutorDeliveryStep(node))
    throw new ApiFailure(403, 'runner.not_a_delivery_step');
  return { item, run, flow, node: node!, c: cfgOf(node) };
}

/**
 * What a release step needs from connectors, sealed to this runner's release_exec key: the shared
 * connector and the acting person's own account — the merger for a merge, whoever clicked release or
 * retry for the craft slots. A bot_exec key never gets one (06 §2.10).
 */
export async function fetchStepSecrets(
  db: Db,
  s: SourceSettings,
  auth: { runnerId: string; secret: string },
  req: HeldLease,
): Promise<CredentialEnvelope> {
  return withRunnerTx(db, auth, async (tx) => {
    const { item, flow, node, c } = await heldDeliveryStep(tx, auth.runnerId, req);
    if (node.node_kind === 'release_deploy' && c.slot === 'build')
      throw new ApiFailure(403, 'runner.credential_not_in_step');
    let connectorId: string;
    let userId: string | null;
    if (node.node_kind === 'cr_merge') {
      const [mr] = await tx
        .select()
        .from(mergeRequests)
        .where(
          and(eq(mergeRequests.flowInstanceId, flow.id), eq(mergeRequests.direction, c.direction!)),
        );
      const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
      connectorId = repo!.connectorId!;
      userId = mr?.mergedBy ?? null;
    } else {
      const rc = (
        await tx.select().from(releaseConfigs).where(eq(releaseConfigs.id, c.release_config_id))
      )[0]!;
      connectorId = rc.providerConnectorId;
      userId = (await stageTask(tx, flow.id, c.env_id))?.triggeredBy ?? null;
    }
    const shared = await openConnector(tx, s, connectorId);
    const personal = userId ? await openPersonal(tx, s, connectorId, userId) : null;
    if (!personal)
      throw new ApiFailure(409, 'delivery.account_missing', { connector_ids: [connectorId] });
    const [key] = await tx
      .select()
      .from(runnerKeys)
      .where(
        and(
          eq(runnerKeys.runnerId, auth.runnerId),
          eq(runnerKeys.keyRole, 'release_exec'),
          eq(runnerKeys.status, 'active'),
        ),
      );
    if (!key) throw new ApiFailure(403, 'runner.credential_not_for_bot');
    const payload: StepSecrets = {
      plugin_id: shared.connector.pluginId,
      config: shared.config,
      credential: shared.credential,
      personal: personal.credential,
    };
    for (const [secretId, epoch] of [
      [shared.connector.secretId!, 1],
      [personal.secretId, personal.keyEpoch],
    ] as const)
      await tx
        .insert(secretDeliveries)
        .values({
          workspaceId: item.workspaceId,
          secretId,
          runnerId: auth.runnerId,
          keyEpoch: epoch,
        })
        .onConflictDoUpdate({
          target: [
            secretDeliveries.workspaceId,
            secretDeliveries.secretId,
            secretDeliveries.runnerId,
          ],
          set: { lastDeliveredAt: sql`now()`, keyEpoch: epoch },
        });
    return sealToRunner(key.publicKey, key.keyFingerprint, personal.secretId, payload as never);
  });
}

const sha256 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

/**
 * craft build output from the build sandbox. Accepted only if the built commit contains the merge
 * that was reviewed (06 §7.1: no artifact of an unreviewed commit is ever published).
 */
export async function uploadArtifact(
  db: Db,
  s: SourceSettings,
  artifactDir: string,
  auth: { runnerId: string; secret: string },
  req: UploadArtifactRequest,
) {
  const files = req.files.map((f) => ({ ...f, data: Buffer.from(f.data_base64, 'base64') }));
  for (const f of files)
    if (sha256(f.data) !== f.sha256)
      throw new ApiFailure(400, 'artifact.sha256_mismatch', { path: f.path });
  const pre = await withRunnerTx(db, auth, async (tx) => {
    const { item, flow, node, c } = await heldDeliveryStep(tx, auth.runnerId, req);
    if (node.node_kind !== 'release_deploy' || c.slot !== 'build')
      throw new ApiFailure(403, 'runner.not_a_delivery_step');
    const [mr] = await tx
      .select()
      .from(mergeRequests)
      .where(
        and(
          eq(mergeRequests.flowInstanceId, flow.id),
          eq(mergeRequests.direction, c.stage === 'production' ? 'to_main' : 'to_env'),
          eq(mergeRequests.state, 'merged'),
        ),
      );
    const [repo] = await tx.select().from(repos).where(eq(repos.id, c.repo_id));
    const o = await opened(tx, s, repo!.connectorId!);
    return { ws: item.workspaceId, mergeSha: mr?.mergeSha ?? null, o, remote: repo!.remoteRepoId! };
  });
  if (!pre.mergeSha) throw new ApiFailure(409, 'artifact.not_merged');
  // network between the two transactions
  const ok = await pre.o.plugin.isAncestor(
    pre.o.config,
    pre.o.credential,
    pre.remote,
    pre.mergeSha,
    req.commit,
  );
  if (!ok) throw new ApiFailure(409, 'artifact.unreviewed_commit');
  const dir = path.join(artifactDir, pre.ws);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) fs.writeFileSync(path.join(dir, f.sha256), f.data);
  return withRunnerTx(db, auth, async (tx, ctx) => {
    const { flow, c } = await heldDeliveryStep(tx, auth.runnerId, req);
    const task = await stageTask(tx, flow.id, c.env_id);
    await updateRow(tx, ctx, releaseTasks, task!.id, {
      version: req.version,
      buildCommit: req.commit,
      artifactManifest: files.map((f) => ({ path: f.path, sha256: f.sha256, size: f.data.length })),
    } as never);
    return { files: files.length };
  });
}

/** One artifact file of the release the runner publishes, by sha256 (only files of that build). */
export async function fetchArtifact(
  db: Db,
  artifactDir: string,
  auth: { runnerId: string; secret: string },
  req: FetchArtifactRequest,
) {
  return withRunnerTx(db, auth, async (tx) => {
    const { item, flow, c } = await heldDeliveryStep(tx, auth.runnerId, req);
    const task = await stageTask(tx, flow.id, c.env_id);
    const manifest = (task?.artifactManifest ?? []) as { sha256: string }[];
    if (!manifest.some((f) => f.sha256 === req.sha256))
      throw new ApiFailure(404, 'artifact.not_found');
    const file = path.join(artifactDir, item.workspaceId, req.sha256);
    if (!fs.existsSync(file)) throw new ApiFailure(404, 'artifact.gone');
    return { data_base64: fs.readFileSync(file).toString('base64') };
  });
}

/** git merge-base --is-ancestor through the workspace connector (06 §3.3 不倒退 / 被覆盖). */
export async function checkAncestry(
  db: Db,
  s: SourceSettings,
  auth: { runnerId: string; secret: string },
  req: CheckAncestryRequest,
) {
  const pre = await withRunnerTx(db, auth, async (tx) => {
    const { c } = await heldDeliveryStep(tx, auth.runnerId, req);
    if (c.repo_id !== req.repo_id) throw new ApiFailure(403, 'runner.repo_not_in_step');
    const [repo] = await tx.select().from(repos).where(eq(repos.id, req.repo_id));
    const [conn] = await tx.select().from(connectors).where(eq(connectors.id, repo!.connectorId!));
    return { o: await opened(tx, s, conn!.id), remote: repo!.remoteRepoId! };
  });
  return {
    is_ancestor: await pre.o.plugin.isAncestor(
      pre.o.config,
      pre.o.credential,
      pre.remote,
      req.ancestor,
      req.descendant,
    ),
  };
}
