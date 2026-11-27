// RunnerTransport on cc-app (docs/06 §2.12, §5.3a; 07 E1): enrollment, handing out sandbox steps
// with leases, write-back guarded by lease token + fence, and cc-sys reclaiming expired leases.
import crypto from 'node:crypto';
import {
  RUNNER_PATHS,
  type HeartbeatResponse,
  type StepAssignment,
} from '@cloudcraft/core-protocol';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb, withWorkspaceTx, type Db } from '../src/db/client.ts';
import { flowInstances, nodeRuns, runners, workItems } from '../src/db/schema/index.ts';
import { updateRow } from '../src/db/write.ts';
import { PLAN_SCHEMA_VERSION, type Plan } from '../src/orchestrator/advance.ts';
import { pgOrchestrator } from '../src/orchestrator/flow.ts';
import { issueEnrollToken } from '../src/service/runner-service.ts';
import { startSysLoop } from '../src/sys.ts';
import { createTestDb, type TestDb } from './db.ts';
import { seedSpace, testAccounts, testSources, type Space } from './fixtures.ts';

let t: TestDb;
let db: Db;
let A: Space;
let B: Space;
// short leases so expiry can be watched
const app = () =>
  buildApp({
    db,
    runner: { leaseSeconds: 2, pollMs: 100 },
    accounts: testAccounts().settings,
    sources: testSources(),
  });
let server: ReturnType<typeof app>;

const PLAN: Plan = {
  plan_schema_version: PLAN_SCHEMA_VERSION,
  repos: [
    {
      id: 'r1',
      name: 'demo-lib',
      clone_url: 'http://git.test/demo-lib.git',
      ref: 'main',
      build_command: 'pnpm build',
    },
    {
      id: 'r2',
      name: 'demo-web',
      clone_url: 'http://git.test/demo-web.git',
      ref: 'main',
      build_command: 'pnpm build',
    },
  ],
  nodes: [
    {
      key: 'trial_build',
      kind: 'auto',
      node_kind: 'deterministic_verify',
      config: { action: 'trial_build' },
    },
    { key: 'review', kind: 'human' },
  ],
};

interface Runner {
  id: string;
  secret: string;
}

const asUser = <T>(s: Space, fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
  withWorkspaceTx(db, { userId: s.userId, workspaceId: s.workspaceId }, fn);

async function post(path: string, body: unknown, r?: Runner) {
  const res = await server.inject({
    method: 'POST',
    url: path,
    payload: body as object,
    headers: r ? { authorization: `Runner ${r.id}:${r.secret}` } : {},
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}

async function enroll(s: Space, name: string): Promise<Runner> {
  const { token } = await asUser(s, (tx, ctx) => issueEnrollToken(tx, ctx, { name }));
  const secret = `cc_run_key_${crypto.randomBytes(16).toString('hex')}`;
  const r = await post(RUNNER_PATHS.registerRunner, {
    enroll_token: token,
    bot_exec_public_key: crypto
      .generateKeyPairSync('x25519')
      .publicKey.export({ type: 'spki', format: 'der' })
      .toString('base64'),
    secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
  });
  expect(r.status).toBe(200);
  return { id: r.body.runner_id as string, secret };
}

const heartbeat = async (r: Runner, freeSlots: number, held: StepAssignment[] = []) => {
  const res = await post(
    RUNNER_PATHS.heartbeatAndPoll,
    {
      free_slots: freeSlots,
      leases: held.map((s) => ({ work_item_id: s.work_item_id, lease_token: s.lease_token })),
    },
    r,
  );
  expect(res.status).toBe(200);
  return res.body as unknown as HeartbeatResponse;
};

const complete = (
  r: Runner,
  s: StepAssignment,
  o: Partial<{ fence: number; output: object }> = {},
) =>
  post(
    RUNNER_PATHS.completeRoundStep,
    {
      work_item_id: s.work_item_id,
      lease_token: s.lease_token,
      fence: o.fence ?? s.fence,
      outcome: 'done',
      output: o.output ?? { builds: [{ repo: 'demo-web', ok: true }] },
    },
    r,
  );

const startFlow = (s: Space) =>
  asUser(s, (tx, ctx) =>
    pgOrchestrator.startFlow(tx, ctx, { projectId: s.projectId, kind: 'round', plan: PLAN }),
  );

const runsOf = (s: Space, flowId: string) =>
  asUser(s, (tx) =>
    tx
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.flowInstanceId, flowId))
      .orderBy(asc(nodeRuns.createdAt)),
  );

async function waitFor<T>(
  what: string,
  fn: () => Promise<T | null | undefined | false>,
  ms = 10_000,
) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 6 });
  server = app();
  // the fixture flows only have run_node work (no node_kind): runners must not see it
  A = await seedSpace(db, 'run-a');
  B = await seedSpace(db, 'run-b');
}, 60_000);

afterAll(async () => {
  await server?.close();
  await db?.close();
  await t?.drop();
});

describe('执行器协议（RunnerTransport）', () => {
  it('一次性令牌注册：只能用一次，换来的长期密钥才能领活', async () => {
    const { token } = await asUser(A, (tx, ctx) => issueEnrollToken(tx, ctx, { name: 'once' }));
    const body = {
      enroll_token: token,
      bot_exec_public_key: crypto
        .generateKeyPairSync('x25519')
        .publicKey.export({ type: 'spki', format: 'der' })
        .toString('base64'),
      secret_sha256: crypto.createHash('sha256').update('cc_run_key_x').digest('hex'),
    };
    expect((await post(RUNNER_PATHS.registerRunner, body)).status).toBe(200);
    const again = await post(RUNNER_PATHS.registerRunner, body);
    expect(again).toMatchObject({ status: 401, body: { code: 'runner.unauthorized' } });
    const r = await enroll(A, 'r');
    expect(
      (
        await post(
          RUNNER_PATHS.heartbeatAndPoll,
          { free_slots: 0, leases: [] },
          { ...r, secret: 'wrong' },
        )
      ).status,
    ).toBe(401);
    expect((await heartbeat(r, 1)).assigned).toEqual([]); // fixture work is not sandbox work
  });

  it('领活、续租、写回：写回带错 fence 被拒，对的 fence 和推进函数一起提交', async () => {
    const r = await enroll(A, 'builder');
    const flowId = await startFlow(A);
    const [step] = (await heartbeat(r, 2)).assigned;
    expect(step).toMatchObject({
      node_key: 'trial_build',
      node_kind: 'deterministic_verify',
      config: { action: 'trial_build' },
      repos: PLAN.repos,
      repo_id: null,
    });
    expect((await runsOf(A, flowId))[0]!.executorId).toBe(r.id);

    // renewing a held lease keeps it; nothing new while no slot is free
    expect(await heartbeat(r, 0, [step!])).toMatchObject({ lost: [], assigned: [] });

    expect(await complete(r, step!, { fence: step!.fence - 1 })).toMatchObject({
      status: 409,
      body: { code: 'runner.lease_lost' },
    });
    expect((await complete(r, step!, { output: { x: 'y'.repeat(20_000) } })).status).toBe(413);
    expect(await complete(r, step!)).toMatchObject({ status: 200, body: { accepted: true } });
    const runs = await runsOf(A, flowId);
    expect(runs.map((x) => `${x.nodeKey}:${x.status}`)).toEqual([
      'trial_build:done',
      'review:waiting_human',
    ]);
    expect(runs[0]!.structuredOutput).toEqual({ builds: [{ repo: 'demo-web', ok: true }] });
    // the same result again is refused: the lease is finished
    expect((await complete(r, step!)).status).toBe(409);
  });

  it('执行器失联：租约过期后 cc-sys 回收，换一台执行器接着做，旧执行器的写回被拒', async () => {
    const r1 = await enroll(A, 'dies');
    const r2 = await enroll(A, 'takes-over');
    const flowId = await startFlow(A);
    const [step1] = (await heartbeat(r1, 1)).assigned;
    expect(step1).toBeDefined();
    // r1 goes silent; cc-sys reaps the expired lease (no external change in flight: back to the queue)
    const sys = startSysLoop(db, { reapIntervalMs: 200 });
    const step2 = await waitFor(
      'the step to be handed out again',
      async () => (await heartbeat(r2, 1)).assigned[0],
    );
    await sys.stop();
    expect(step2.node_run_id).toBe(step1!.node_run_id); // same node run resumes, no new attempt
    expect(step2.fence).toBeGreaterThan(step1!.fence);

    expect((await heartbeat(r1, 0, [step1!])).lost).toEqual([step1!.work_item_id]);
    expect((await complete(r1, step1!)).status).toBe(409);
    expect((await complete(r2, step2)).status).toBe(200);
    expect((await runsOf(A, flowId)).map((x) => `${x.nodeKey}#${x.attemptNo}:${x.status}`)).toEqual(
      ['trial_build#1:done', 'review#1:waiting_human'],
    );
    expect((await runsOf(A, flowId))[0]!.executorId).toBe(r2.id);
  });

  it('隔离与排空：别的空间的执行器领不到这里的活，排空中的执行器不接新活', async () => {
    const rb = await enroll(B, 'other-space');
    const ra = await enroll(A, 'draining');
    await asUser(A, (tx, ctx) => updateRow(tx, ctx, runners, ra.id, { drainMode: true }));
    await startFlow(A);
    expect((await heartbeat(rb, 4)).assigned).toEqual([]);
    expect((await heartbeat(ra, 4)).assigned).toEqual([]);
    const queued = await asUser(A, (tx) =>
      tx.select().from(workItems).where(eq(workItems.status, 'queued')),
    );
    expect(queued.some((w) => w.kind === 'bot_step')).toBe(true);
    // flows of B are untouched by all of this
    const flowsB = await asUser(B, (tx) => tx.select().from(flowInstances));
    expect(flowsB).toHaveLength(1);
  });

  it('一段执行节点留在同一台执行器：写回时要下一步，就在同一事务里把它租给自己；排空中不给', async () => {
    const plan: Plan = {
      plan_schema_version: PLAN_SCHEMA_VERSION,
      repos: PLAN.repos,
      nodes: [
        { key: 'prepare', kind: 'auto', node_kind: 'host_prepare' },
        { key: 'fix', kind: 'auto', node_kind: 'ai_agent' },
        {
          key: 'verify',
          kind: 'auto',
          node_kind: 'deterministic_verify',
          config: { action: 'replay' },
        },
        { key: 'review', kind: 'human' },
      ],
    };
    // a space of its own: earlier tests leave sandbox work queued in A
    const C = await seedSpace(db, 'run-c');
    const r = await enroll(C, 'segment');
    const other = await enroll(C, 'bystander');
    const flowId = await asUser(C, (tx, ctx) =>
      pgOrchestrator.startFlow(tx, ctx, { projectId: C.projectId, kind: 'round', plan }),
    );
    const [prep] = (await heartbeat(r, 1)).assigned;
    expect(prep).toMatchObject({ node_key: 'prepare', flow_instance_id: flowId });

    const done1 = await post(
      RUNNER_PATHS.completeRoundStep,
      {
        work_item_id: prep!.work_item_id,
        lease_token: prep!.lease_token,
        fence: prep!.fence,
        outcome: 'done',
        output: {},
        take_next: true,
      },
      r,
    );
    const fix = (done1.body as { next?: StepAssignment }).next;
    expect(fix).toMatchObject({ node_key: 'fix', node_kind: 'ai_agent', flow_instance_id: flowId });
    // already leased to r: nobody else gets it, and r can renew it
    expect((await heartbeat(other, 4)).assigned).toEqual([]);
    expect((await heartbeat(r, 0, [fix!])).lost).toEqual([]);

    // a draining runner finishes its step but is handed nothing more
    await asUser(C, (tx, ctx) => updateRow(tx, ctx, runners, r.id, { drainMode: true }));
    const done2 = await post(
      RUNNER_PATHS.completeRoundStep,
      {
        work_item_id: fix!.work_item_id,
        lease_token: fix!.lease_token,
        fence: fix!.fence,
        outcome: 'done',
        output: {},
        take_next: true,
      },
      r,
    );
    expect(done2).toMatchObject({ status: 200, body: { accepted: true } });
    expect((done2.body as { next?: unknown }).next).toBeUndefined();
    expect((await heartbeat(other, 4)).assigned.map((x) => x.node_key)).toEqual(['verify']);
  });
});
