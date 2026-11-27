// Platform skeleton scenarios (docs/06 §2.8, §2.12, §3.5, §3.6; 07 P1 acceptance).
import { and, eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import {
  LeaseLostError,
  createDb,
  withLeaseTx,
  withWorkspaceTx,
  type Db,
} from '../src/db/client.ts';
import { events } from '../src/db/events.ts';
import { flowInstances, nodeRuns, outbox, projects, workItems } from '../src/db/schema/index.ts';
import {
  RevConflictError,
  findUnmatchedProbes,
  insertRow,
  restore,
  softDelete,
  updateRow,
} from '../src/db/write.ts';
import { pgOrchestrator, RUN_NODE } from '../src/orchestrator/flow.ts';
import {
  claimWork,
  completeWork,
  enqueueOutbox,
  registerEffect,
  renewLease,
} from '../src/orchestrator/queue.ts';
import { createTestDb, type TestDb } from './db.ts';
import { seedSpace, type Space } from './fixtures.ts';

let t: TestDb;
let db: Db;
let su: pg.Client;
let A: Space;
let B: Space;

const asUser = <T>(s: Space, fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
  withWorkspaceTx(db, { userId: s.userId, workspaceId: s.workspaceId, clientSource: 'pc_ui' }, fn);

/** Probes without an event anywhere in the database (superuser view, across workspaces). */
async function unmatched(): Promise<string[]> {
  const r = await su.query<{ table_name: string }>(
    `select p.table_name from audit_probe p
     where not exists (select 1 from events e where e.entity_id = p.row_id and e.txid = p.txid)`,
  );
  return r.rows.map((x) => x.table_name);
}

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 6 });
  su = new pg.Client({ connectionString: t.superUrl });
  await su.connect();
  A = await seedSpace(db, 'plat-a');
  B = await seedSpace(db, 'plat-b');
}, 60_000);

afterAll(async () => {
  await su?.end();
  await db?.close();
  await t?.drop();
});

describe('平台骨架', () => {
  it('每个写操作都在同一事务留下操作记录：新建、修改、软删、恢复，敏感字段脱敏，没有漏写', async () => {
    const id = await asUser(A, async (tx, ctx) => {
      const p = await insertRow(tx, ctx, projects, {
        name: '审批中心',
        slug: 'approval',
        riskRules: { webhook_secret: 's3cr3t', threshold: 3 },
      });
      await updateRow(tx, ctx, projects, p.id, { name: '审批中心 2' }, { expectedRev: 0 });
      await softDelete(tx, ctx, projects, p.id);
      await restore(tx, ctx, projects, p.id);
      return p.id;
    });
    const evs = await asUser(A, (tx) =>
      tx.select().from(events).where(eq(events.entityId, id)).orderBy(events.seq),
    );
    expect(evs.map((e) => e.actionKind)).toEqual(['create', 'update', 'soft_delete', 'restore']);
    expect(evs[1]!.changedFields).toEqual(['name']);
    expect(evs.every((e) => e.actorUserId === A.userId && e.clientSource === 'pc_ui')).toBe(true);
    expect(JSON.stringify(evs[0]!.afterSnapshot)).not.toContain('s3cr3t');
    expect((evs[0]!.afterSnapshot as { risk_rules: unknown }).risk_rules).toEqual({
      webhook_secret: '[redacted]',
      threshold: 3,
    });
    // seeding (workspace, member, project, flow, node run) and the writes above all have events
    expect(await unmatched()).toEqual([]);
    expect(await asUser(A, (tx) => findUnmatchedProbes(tx))).toEqual([]);

    // a write that bypasses write.ts is caught by the probe check
    await asUser(A, (tx) => tx.update(projects).set({ name: 'sneaky' }).where(eq(projects.id, id)));
    expect(await unmatched()).toEqual(['projects']);
    // clean up the deliberate gap; the append-only trigger stops even the superuser unless disabled
    await su.query('set session_replication_role = replica');
    await su.query('delete from audit_probe where table_name = $1 and row_id = $2', [
      'projects',
      id,
    ]);
    await su.query('set session_replication_role = origin');
  });

  it('并发覆盖被版本号挡住；操作记录只追加，运行账号改不了也删不了', async () => {
    await expect(
      asUser(A, (tx, ctx) =>
        updateRow(tx, ctx, projects, A.projectId, { name: 'x' }, { expectedRev: 99 }),
      ),
    ).rejects.toBeInstanceOf(RevConflictError);
    const tamper = (q: string) =>
      asUser(A, (tx) => tx.execute(sql.raw(q))).then(
        () => 'ok',
        (e: Error & { cause?: Error }) => e.cause?.message ?? e.message,
      );
    expect(await tamper(`update events set entity_display = 'x'`)).toContain('permission denied');
    expect(await tamper(`delete from events`)).toContain('permission denied');
    expect(await tamper(`select count(*) from events_default`)).toContain('permission denied');
  });

  it('Outbox 与业务写同生共死；外部副作用按幂等键只登记一次', async () => {
    await expect(
      asUser(A, async (tx, ctx) => {
        await enqueueOutbox(tx, ctx, 'ticket.created', { n: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await asUser(A, (tx, ctx) => enqueueOutbox(tx, ctx, 'ticket.created', { n: 2 }));
    const msgs = await asUser(A, (tx) => tx.select().from(outbox));
    expect(msgs.map((m) => m.payload)).toEqual([{ n: 2 }]);

    const req = { mr: 7 };
    const first = await asUser(A, (tx, ctx) =>
      registerEffect(tx, ctx, { key: 'merge:7', kind: 'merge_mr', request: req }),
    );
    const again = await asUser(A, (tx, ctx) =>
      registerEffect(tx, ctx, { key: 'merge:7', kind: 'merge_mr', request: req }),
    );
    expect([first.created, again.created, again.effect.id]).toEqual([true, false, first.effect.id]);
  });

  it('编排：自动节点经租约执行，人工节点等信号，提交与推进同一事务；租约失效就停手', async () => {
    const nodeOf = async (s: Space, key: string) =>
      (
        await asUser(s, (tx) =>
          tx
            .select()
            .from(nodeRuns)
            .where(and(eq(nodeRuns.flowInstanceId, s.flowId), eq(nodeRuns.nodeKey, key))),
        )
      )[0]!;

    // the seeded flows wait on their first auto node; claiming spans both workspaces
    const leases = await claimWork(db, {
      kinds: [RUN_NODE],
      limit: 10,
      owner: 'test',
      leaseSeconds: 60,
    });
    expect(new Set(leases.map((l) => l.workspaceId))).toEqual(
      new Set([A.workspaceId, B.workspaceId]),
    );
    const leaseA = leases.find((l) => l.workspaceId === A.workspaceId)!;
    expect(
      await claimWork(db, { kinds: [RUN_NODE], limit: 10, owner: 'test', leaseSeconds: 60 }),
    ).toEqual([]);
    expect(await renewLease(db, leaseA, 60)).toBe(true);

    // inside a lease transaction the system task sees only its own workspace
    const seen = await withLeaseTx(db, leaseA, (tx) =>
      tx.select({ ws: flowInstances.workspaceId }).from(flowInstances),
    );
    expect(new Set(seen.map((r) => r.ws))).toEqual(new Set([A.workspaceId]));

    // crash after advancing but before commit: nothing happened
    const fix = await nodeOf(A, 'fix');
    await expect(
      withLeaseTx(db, leaseA, async (tx, ctx) => {
        await pgOrchestrator.signal(tx, ctx, A.flowId, {
          type: 'node_finished',
          nodeRunId: fix.id,
          outcome: 'done',
        });
        await completeWork(tx, leaseA);
        throw new Error('crash');
      }),
    ).rejects.toThrow('crash');
    expect((await nodeOf(A, 'fix')).status).toBe('running');

    // the real run: finish the node and the work item in one transaction
    await withLeaseTx(db, leaseA, async (tx, ctx) => {
      await pgOrchestrator.signal(tx, ctx, A.flowId, {
        type: 'node_finished',
        nodeRunId: fix.id,
        outcome: 'done',
      });
      await completeWork(tx, leaseA);
    });
    const review = await nodeOf(A, 'review');
    expect(review.status).toBe('waiting_human');
    expect(await withLeaseTx(db, leaseA, async () => null).catch((e) => e)).toBeInstanceOf(
      LeaseLostError,
    );

    // a person approves; the next auto node gets its work item
    await asUser(A, (tx, ctx) =>
      pgOrchestrator.signal(tx, ctx, A.flowId, {
        type: 'node_finished',
        nodeRunId: review.id,
        outcome: 'done',
      }),
    );
    const [deployLease] = await claimWork(db, {
      kinds: [RUN_NODE],
      limit: 10,
      owner: 'test',
      leaseSeconds: 60,
    });
    expect(deployLease!.workspaceId).toBe(A.workspaceId);

    // an expired lease cannot be used to write
    await su.query(
      `update work_items set lease_expires_at = now() - interval '1 second' where id = $1`,
      [deployLease!.workItemId],
    );
    expect(await renewLease(db, deployLease!, 60)).toBe(false);
    expect(await withLeaseTx(db, deployLease!, async () => null).catch((e) => e)).toBeInstanceOf(
      LeaseLostError,
    );
    await su.query(
      `update work_items set lease_expires_at = now() + interval '1 minute' where id = $1`,
      [deployLease!.workItemId],
    );

    const deploy = await nodeOf(A, 'deploy');
    await withLeaseTx(db, deployLease!, async (tx, ctx) => {
      await pgOrchestrator.signal(tx, ctx, A.flowId, {
        type: 'node_finished',
        nodeRunId: deploy.id,
        outcome: 'done',
      });
      await completeWork(tx, deployLease!);
    });
    const flow = (
      await asUser(A, (tx) => tx.select().from(flowInstances).where(eq(flowInstances.id, A.flowId)))
    )[0]!;
    expect(flow.status).toBe('done');
    const items = await asUser(A, (tx) => tx.select({ status: workItems.status }).from(workItems));
    expect(items.map((i) => i.status).sort()).toEqual(['done', 'done']);
    expect(await unmatched()).toEqual([]);
  });

  it('HTTP 骨架：健康检查，请求 ID 原样带回', async () => {
    const app = buildApp({ db, runner: { leaseSeconds: 60, pollMs: 5000 } });
    const res = await app.inject({ url: '/healthz', headers: { 'x-request-id': 'req-123' } });
    expect([res.statusCode, res.json(), res.headers['x-request-id']]).toEqual([
      200,
      { ok: true },
      'req-123',
    ]);
    const missing = await app.inject({ url: '/nope' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
