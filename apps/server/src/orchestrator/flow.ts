// Applies advance() to the database (docs/06 §3.6). Runs inside the caller's transaction — the same
// one as the write that produced the signal — after locking the flow instance row.
import { asc, eq, sql } from 'drizzle-orm';
import type { ActorCtx, Tx } from '../db/client.ts';
import { flowInstances, nodeRuns } from '../db/schema/index.ts';
import { NotFoundError, insertRow, updateRow } from '../db/write.ts';
import {
  PLAN_SCHEMA_VERSION,
  advance,
  type Command,
  type FlowStatus,
  type Plan,
  type PlanNode,
  type Signal,
} from './advance.ts';
import { enqueueWork } from './queue.ts';

export const RUN_NODE = 'run_node';
/** work for the Bot executor, handed out over RunnerTransport (06 §2.12, §5.3a) */
export const BOT_STEP = 'bot_step';

/** work for the release executor: merges and craft publish / release / verify (06 §1.2, §7.1) */
export const RELEASE_STEP = 'release_step';

/** Node kinds that run in the code sandbox of a Bot executor (06 §5.1). */
const BOT_NODE_KINDS = new Set(['host_prepare', 'ai_agent', 'deterministic_verify']);
/** craft slots the release executor runs; build runs in a build sandbox, notify in cc-sys */
const RELEASE_SLOTS = new Set(['publish', 'release', 'verify']);

/**
 * Who runs an auto node: the Bot executor for sandbox nodes and craft build (no credentials, no
 * network), the release executor for merges and the publish / release / verify slots (credentials,
 * never repository code), cc-sys workers for the rest (opening MRs, notifications).
 */
export function workKindFor(node: PlanNode | undefined) {
  const kind = node?.node_kind;
  const c = node?.config ?? {};
  if (kind && BOT_NODE_KINDS.has(kind)) return BOT_STEP;
  if (kind === 'release_deploy' && c.slot === 'build') return BOT_STEP;
  if (kind === 'release_deploy' && RELEASE_SLOTS.has(String(c.slot))) return RELEASE_STEP;
  if (kind === 'cr_merge' && c.step === 'merge') return RELEASE_STEP;
  return RUN_NODE;
}

/** The swappable seam in front of the orchestration engine (06 §3.6 item 8). */
export interface OrchestratorPort {
  startFlow(
    tx: Tx,
    ctx: ActorCtx,
    f: {
      projectId: string;
      kind: 'round' | 'delivery' | 'bundle' | 'eval' | 'trial_build' | 'health_check';
      plan: Plan;
    },
  ): Promise<string>;
  signal(tx: Tx, ctx: ActorCtx, flowInstanceId: string, signal: Signal): Promise<Command[]>;
}

async function signal(
  tx: Tx,
  ctx: ActorCtx,
  flowInstanceId: string,
  s: Signal,
): Promise<Command[]> {
  const locked = await tx
    .select()
    .from(flowInstances)
    .where(eq(flowInstances.id, flowInstanceId))
    .for('update');
  const flow = locked[0];
  if (!flow) throw new NotFoundError(`flow instance ${flowInstanceId} not found`);
  const runs = await tx
    .select()
    .from(nodeRuns)
    .where(eq(nodeRuns.flowInstanceId, flowInstanceId))
    .orderBy(asc(nodeRuns.createdAt));
  const commands = advance(
    {
      status: flow.status as FlowStatus,
      plan: flow.plan as Plan,
      nodeRuns: runs.map((r) => ({ ...r, error: r.errorRaw })),
    },
    s,
  );

  const opened = new Map<string, string>();
  const runKey = (c: { nodeKey: string; attemptNo: number; repoId: string | null }) =>
    `${c.nodeKey}#${c.attemptNo}#${c.repoId ?? ''}`;
  for (const c of commands) {
    switch (c.type) {
      case 'open_node': {
        const run = await insertRow(tx, ctx, nodeRuns, {
          projectId: flow.projectId,
          flowInstanceId,
          nodeKey: c.nodeKey,
          nodeKind: c.nodeKind,
          attemptNo: c.attemptNo,
          repoId: c.repoId,
          status: c.status,
          startedAt: sql`now()`,
        });
        opened.set(runKey(c), run.id);
        break;
      }
      case 'enqueue_work': {
        const nodeRunId = opened.get(runKey(c))!;
        await enqueueWork(tx, ctx, {
          kind: workKindFor((flow.plan as Plan).nodes.find((n) => n.key === c.nodeKey)),
          singletonKey: `node_run:${nodeRunId}`,
          payload: { flow_instance_id: flowInstanceId, node_run_id: nodeRunId },
        });
        break;
      }
      case 'close_node':
        await updateRow(tx, ctx, nodeRuns, c.nodeRunId, {
          status: c.status,
          // keep what the executor wrote back unless the orchestrator has its own reason
          ...(c.error !== undefined ? { errorRaw: c.error } : {}),
          finishedAt: sql`now()`,
        });
        break;
      case 'finish_flow':
        await updateRow(tx, ctx, flowInstances, flowInstanceId, { status: c.status });
        break;
    }
  }
  return commands;
}

export const pgOrchestrator: OrchestratorPort = {
  async startFlow(tx, ctx, f) {
    const flow = await insertRow(tx, ctx, flowInstances, {
      projectId: f.projectId,
      kind: f.kind,
      plan: f.plan,
      planSchemaVersion: PLAN_SCHEMA_VERSION,
    });
    await signal(tx, ctx, flow.id, { type: 'start' });
    return flow.id;
  },
  signal,
};
