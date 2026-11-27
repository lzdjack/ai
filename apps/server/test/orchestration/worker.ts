// Test worker for the orchestration scenarios (07 S2): claims run_node items, runs a scripted handler
// per node key and reports back through completeWork() + advance(). Runs in-process, or as a child
// process (`tsx worker.ts '<json config>'`) when a test needs to kill it.
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import {
  createDb,
  withLeaseTx,
  type ActorCtx,
  type Db,
  type Lease,
  type Tx,
} from '../../src/db/client.ts';
import { nodeRuns, workItems } from '../../src/db/schema/index.ts';
import { runEffect } from '../../src/orchestrator/effects.ts';
import { RUN_NODE, pgOrchestrator } from '../../src/orchestrator/flow.ts';
import { claimWork, completeWork } from '../../src/orchestrator/queue.ts';
import { targetApi } from './fake-target.ts';

export interface WorkerConfig {
  appUrl: string;
  targetUrl: string;
  /** shows up in the effect request, so a test can tell which code version did the work */
  codeVersion: string;
  leaseSeconds: number;
  /** build of this repo fails on this attempt */
  failBuild?: { repoId: string; attemptNo: number };
  /** this node never finishes (the test kills the process) */
  hang?: string;
}

async function handle(db: Db, lease: Lease, cfg: WorkerConfig): Promise<void> {
  const { run, flowId } = await withLeaseTx(db, lease, async (tx) => {
    const [item] = await tx.select().from(workItems).where(eq(workItems.id, lease.workItemId));
    const p = item!.payload as { flow_instance_id: string; node_run_id: string };
    const [r] = await tx.select().from(nodeRuns).where(eq(nodeRuns.id, p.node_run_id));
    return { run: r!, flowId: p.flow_instance_id };
  });
  console.log(`claimed ${run.nodeKey}#${run.attemptNo}`);
  const finish = (outcome: 'done' | 'failed') => async (tx: Tx, ctx: ActorCtx) => {
    await completeWork(tx, lease);
    await pgOrchestrator.signal(tx, ctx, flowId, {
      type: 'node_finished',
      nodeRunId: run.id,
      outcome,
    });
  };

  if (run.nodeKey === cfg.hang) await new Promise(() => {});

  if (run.nodeKey === 'deploy') {
    const api = targetApi(cfg.targetUrl);
    const key = `deploy:${flowId}`;
    await runEffect(
      db,
      lease,
      {
        key,
        kind: 'deploy',
        request: { version: 'pkg-1', worker: cfg.codeVersion },
        nodeRunId: run.id,
      },
      { execute: () => api.deploy(key, 'pkg-1'), readBack: () => api.readBack(key) },
      finish('done'),
    );
    return;
  }

  const fail =
    run.nodeKey === 'build' &&
    run.repoId === cfg.failBuild?.repoId &&
    run.attemptNo === cfg.failBuild.attemptNo;
  await withLeaseTx(db, lease, finish(fail ? 'failed' : 'done'));
}

/** Claims what is due and handles it concurrently. Returns how many items were handled. */
export async function workOnce(db: Db, cfg: WorkerConfig): Promise<number> {
  const leases = await claimWork(db, {
    kinds: [RUN_NODE],
    limit: 10,
    owner: `worker-${cfg.codeVersion}`,
    leaseSeconds: cfg.leaseSeconds,
  });
  await Promise.all(leases.map((l) => handle(db, l, cfg)));
  return leases.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = JSON.parse(process.argv[2]!) as WorkerConfig;
  const db = createDb(cfg.appUrl, { max: 4 });
  console.log(`worker ${cfg.codeVersion} up`);
  for (;;) {
    await workOnce(db, cfg).catch((e: unknown) => console.error(e));
    await new Promise((r) => setTimeout(r, 100));
  }
}
