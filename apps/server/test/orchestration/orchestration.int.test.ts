// The three orchestration scenarios of 07 S2 / 06 §15 item 9, on the self-built engine:
// ① a flow waits for a person for days while the code is redeployed;
// ② three repos fan out, one fails, the flow goes back to a middle node (automatically and by hand);
// ③ the worker is killed in the middle of a release — with and without an external change in flight.
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withWorkspaceTx, type Db } from '../../src/db/client.ts';
import { effects, flowInstances, nodeRuns, workItems } from '../../src/db/schema/index.ts';
import { PLAN_SCHEMA_VERSION, type PlanNode, type Signal } from '../../src/orchestrator/advance.ts';
import { reapExpiredLeases } from '../../src/orchestrator/effects.ts';
import { pgOrchestrator } from '../../src/orchestrator/flow.ts';
import { createTestDb, type TestDb } from '../db.ts';
import { seedSpace, type Space } from '../fixtures.ts';
import { startFakeTarget, type FakeTarget } from './fake-target.ts';
import { workOnce, type WorkerConfig } from './worker.ts';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const WORKER = path.join(import.meta.dirname, 'worker.ts');

let t: TestDb;
let db: Db;
let target: FakeTarget;
let S: Space;
const children: ChildProcess[] = [];

const cfg = (o: Partial<WorkerConfig> = {}): WorkerConfig => ({
  appUrl: t.appUrl,
  targetUrl: target.url,
  codeVersion: 'v1',
  leaseSeconds: 30,
  ...o,
});

function spawnWorker(c: WorkerConfig): { proc: ChildProcess; output: () => string } {
  let out = '';
  const proc = spawn(process.execPath, ['--import', 'tsx', WORKER, JSON.stringify(c)], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout!.on('data', (d: Buffer) => (out += d.toString()));
  proc.stderr!.on('data', (d: Buffer) => (out += d.toString()));
  children.push(proc);
  return { proc, output: () => out };
}

async function kill(proc: ChildProcess) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  const exited = new Promise((r) => proc.once('exit', r));
  proc.kill('SIGKILL');
  await exited;
}

async function waitFor<T>(
  what: string,
  fn: () => Promise<T | null | undefined | false>,
  ms = 20_000,
) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const asUser = <T>(fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
  withWorkspaceTx(db, { userId: S.userId, workspaceId: S.workspaceId, clientSource: 'pc_ui' }, fn);

const startFlow = (nodes: PlanNode[], repoIds?: string[]) =>
  asUser((tx, ctx) =>
    pgOrchestrator.startFlow(tx, ctx, {
      projectId: S.projectId,
      kind: 'round',
      plan: {
        plan_schema_version: PLAN_SCHEMA_VERSION,
        nodes,
        ...(repoIds ? { repo_ids: repoIds } : {}),
      },
    }),
  );

const signal = (flowId: string, s: Signal) =>
  asUser((tx, ctx) => pgOrchestrator.signal(tx, ctx, flowId, s));

const runsOf = (flowId: string) =>
  asUser((tx) =>
    tx
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.flowInstanceId, flowId))
      .orderBy(asc(nodeRuns.createdAt), asc(nodeRuns.repoId)),
  );

const flowStatus = async (flowId: string) =>
  (await asUser((tx) => tx.select().from(flowInstances).where(eq(flowInstances.id, flowId))))[0]!
    .status;

const activeRun = async (flowId: string, nodeKey: string) =>
  (await runsOf(flowId)).find(
    (r) => r.nodeKey === nodeKey && (r.status === 'running' || r.status === 'waiting_human'),
  );

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 8 });
  target = await startFakeTarget();
  S = await seedSpace(db, 'orch');
}, 60_000);

// each scenario starts with no workers around
afterEach(async () => {
  await Promise.all(children.splice(0).map(kill));
});

afterAll(async () => {
  await target?.close();
  await db?.close();
  await t?.drop();
});

describe('编排场景（自己实现）', () => {
  it('① 等人工期间重新部署：等待只是一行记录，新版本代码接着推进', async () => {
    const flowId = await startFlow([
      { key: 'fix', kind: 'auto' },
      { key: 'review', kind: 'human' },
      { key: 'deploy', kind: 'auto' },
    ]);
    const v1 = spawnWorker(cfg({ codeVersion: 'v1' }));
    const review = await waitFor('review to open', () => activeRun(flowId, 'review'));
    expect(review.status).toBe('waiting_human');
    await kill(v1.proc); // "deploy": the old version goes away

    // while people take their time nothing runs and nothing is held: no queued or leased work
    const pending = await asUser((tx) =>
      tx.select().from(workItems).where(eq(workItems.status, 'queued')),
    );
    expect(
      pending.filter(
        (w) => (w.payload as { flow_instance_id?: string }).flow_instance_id === flowId,
      ),
    ).toEqual([]);

    spawnWorker(cfg({ codeVersion: 'v2' }));
    await signal(flowId, { type: 'node_finished', nodeRunId: review.id, outcome: 'done' });
    await waitFor('flow to finish', async () => (await flowStatus(flowId)) === 'done');
    const [effect] = await asUser((tx) =>
      tx
        .select()
        .from(effects)
        .where(eq(effects.effectKey, `deploy:${flowId}`)),
    );
    expect(effect!.request).toMatchObject({ worker: 'v2' });
    expect(target.calls.get(`deploy:${flowId}`)).toBe(1);
  }, 60_000);

  it('② 三仓扇出一仓失败：等齐后自动回到改码节点，人工再打回到构建节点', async () => {
    const [a, b, c] = Array.from({ length: 3 }, (): string => crypto.randomUUID()).sort();
    const flowId = await startFlow(
      [
        { key: 'prepare', kind: 'auto' },
        { key: 'fix', kind: 'auto' },
        {
          key: 'build',
          kind: 'auto',
          per_repo: true,
          on_fail: { rework_to: 'fix', max_attempts: 2 },
        },
        { key: 'review', kind: 'human' },
      ],
      [a!, b!, c!],
    );
    // three repos finish concurrently: the flow row lock serialises the join
    const w = cfg({ failBuild: { repoId: b!, attemptNo: 1 } });
    await waitFor('review to open', async () => {
      await workOnce(db, w);
      return activeRun(flowId, 'review');
    });
    const summary = async () =>
      (await runsOf(flowId)).map(
        (r) =>
          `${r.nodeKey}#${r.attemptNo}${r.repoId ? `@${[a, b, c].indexOf(r.repoId)}` : ''}:${r.status}`,
      );
    expect(await summary()).toEqual([
      'prepare#1:done',
      'fix#1:done',
      'build#1@0:done',
      'build#1@1:failed',
      'build#1@2:done',
      'fix#2:done',
      'build#2@0:done',
      'build#2@1:done',
      'build#2@2:done',
      'review#1:waiting_human',
    ]);

    // a person sends it back to the build node (any node, 06 §5.1a)
    await signal(flowId, { type: 'rework', toNodeKey: 'build' });
    await waitFor('review to reopen', async () => {
      await workOnce(db, w);
      return activeRun(flowId, 'review');
    });
    expect((await summary()).slice(9)).toEqual([
      'review#1:cancelled',
      'build#3@0:done',
      'build#3@1:done',
      'build#3@2:done',
      'review#2:waiting_human',
    ]);

    // a late report from the first attempt changes nothing
    const stale = (await runsOf(flowId)).find((r) => r.nodeKey === 'build' && r.attemptNo === 1)!;
    expect(
      await signal(flowId, { type: 'node_finished', nodeRunId: stale.id, outcome: 'failed' }),
    ).toEqual([]);
  }, 60_000);

  it('③ 发布中途杀进程：外部已生效的标「执行中断」，人点重试先回读、不重复发布', async () => {
    const flowId = await startFlow([
      { key: 'deploy', kind: 'auto' },
      { key: 'verify', kind: 'auto' },
    ]);
    const held = target.holdNext();
    const a = spawnWorker(cfg({ codeVersion: 'v1', leaseSeconds: 2 }));
    await held; // the release system applied the change; the worker never hears back
    await kill(a.proc);

    // the lease runs out; the reaper finds a change in flight and stops for a person
    await waitFor(
      'lease to be reaped',
      async () => (await reapExpiredLeases(db, { owner: 'reaper' })) > 0,
    );
    const [deploy1] = await runsOf(flowId);
    expect(deploy1).toMatchObject({ nodeKey: 'deploy', status: 'failed', errorRaw: 'interrupted' });
    expect(await flowStatus(flowId)).toBe('running');
    const effectOf = async () =>
      (
        await asUser((tx) =>
          tx
            .select()
            .from(effects)
            .where(eq(effects.effectKey, `deploy:${flowId}`)),
        )
      )[0]!;
    expect((await effectOf()).status).toBe('interrupted');

    // the person retries: the new attempt reads back, sees the change is there, and moves on
    await signal(flowId, { type: 'rework', toNodeKey: 'deploy' });
    spawnWorker(cfg({ codeVersion: 'v1' }));
    await waitFor('flow to finish', async () => (await flowStatus(flowId)) === 'done');
    expect(target.calls.get(`deploy:${flowId}`)).toBe(1);
    const effect = await effectOf();
    expect(effect.status).toBe('succeeded');
    expect(effect.verifiedAt).not.toBeNull();
    expect((await runsOf(flowId)).map((r) => `${r.nodeKey}#${r.attemptNo}:${r.status}`)).toEqual([
      'deploy#1:failed',
      'deploy#2:done',
      'verify#1:done',
    ]);
  }, 60_000);

  it('③ 杀在没有外部副作用的节点：租约过期后重新排队，从检查点续跑', async () => {
    const flowId = await startFlow([
      { key: 'prepare', kind: 'auto' },
      { key: 'verify', kind: 'auto' },
    ]);
    const a = spawnWorker(cfg({ leaseSeconds: 2, hang: 'verify' }));
    await waitFor('verify to be claimed', async () => a.output().includes('claimed verify#1'));
    await kill(a.proc);
    await waitFor(
      'lease to be reaped',
      async () => (await reapExpiredLeases(db, { owner: 'reaper' })) > 0,
    );
    const [item] = await asUser((tx) =>
      tx
        .select()
        .from(workItems)
        .where(and(eq(workItems.status, 'queued'), eq(workItems.kind, 'run_node'))),
    );
    expect(item).toBeDefined();
    spawnWorker(cfg());
    await waitFor('flow to finish', async () => (await flowStatus(flowId)) === 'done');
    // same node run resumed, no extra attempt
    expect((await runsOf(flowId)).map((r) => `${r.nodeKey}#${r.attemptNo}:${r.status}`)).toEqual([
      'prepare#1:done',
      'verify#1:done',
    ]);
  }, 60_000);
});
