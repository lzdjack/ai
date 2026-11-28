// End-to-end smoke of a manual ticket's first round (docs/06 §3.1, §3.2, §5.7; 07 P4): create the
// ticket over HTTP, play the executor over the real RunnerTransport (prepare → fix → replay), let
// cc-sys check the facts against the code platform, and read the delivery card. No Docker, no model.
import crypto from 'node:crypto';
import {
  RUNNER_PATHS,
  type CodeSourceConnector,
  type DeliveryCard,
  type HeartbeatResponse,
  type StepAssignment,
} from '@cloudcraft/core-protocol';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb, withWorkspaceTx, type Db } from '../src/db/client.ts';
import { signAccessToken } from '../src/service/auth-crypto.ts';
import { issueEnrollToken } from '../src/service/runner-service.ts';
import { startSysLoop, type SysLoop } from '../src/sys.ts';
import { createTestDb, type TestDb } from './db.ts';
import { seedSpace, testAccounts, testSources, type Space } from './fixtures.ts';

const TOKEN = 'glpat-ticket-test-0001';
/** branch heads the platform reports: remote id + branch → sha */
const heads = new Map<string, string>();
const fake: CodeSourceConnector = {
  manifest: {
    id: 'connector-fake',
    name: 'Fake',
    category: 'code_source',
    configSchema: {} as never,
    authSchema: {} as never,
  },
  verify: async () => ({
    ok: true,
    latency_ms: 1,
    identity: '@bot',
    scopes: [],
    has_merge_perm: false,
    visible_repo_count: 1,
  }),
  listRepos: async () => ({ items: [], has_more: false }),
  getRepo: async (_c, _k, id) => ({
    remote_id: id,
    path: 'demo/demo-web',
    name: 'demo-web',
    description: null,
    default_branch: 'main',
    clone_url: 'http://git.test/demo/demo-web.git',
    web_url: null,
  }),
  readFile: async (_c, _k, _id, p) =>
    ({
      'package.json': JSON.stringify({
        scripts: { build: 'vite build' },
        dependencies: { react: '19' },
        devDependencies: { vite: '8', vitest: '5', typescript: '6' },
      }),
      'pnpm-lock.yaml': 'x',
      'tsconfig.json': '{}',
      'index.html': '<div id="root"></div>',
    })[p] ?? null,
  listBranches: async () => [],
  branchHead: async (_c, _k, id, branch) => heads.get(`${id}:${branch}`) ?? null,
  gitAuth: () => ({ header: 'Authorization', value: 'Bearer x' }),
  // merges and MRs belong to the delivery segment (delivery.int.test.ts)
  openMergeRequest: () => Promise.reject(new Error('not used here')),
  getMergeRequest: () => Promise.reject(new Error('not used here')),
  mergeMergeRequest: () => Promise.reject(new Error('not used here')),
  isAncestor: () => Promise.resolve(false),
};

let t: TestDb;
let db: Db;
let su: pg.Client;
let A: Space;
let sys: SysLoop;
let server: ReturnType<typeof buildApp>;
let owner = '';
let runnerAuth = '';
const { settings } = testAccounts();
const sources = testSources(new Map([['connector-fake', fake]]));

async function call(method: string, url: string, payload?: unknown, auth = `Bearer ${owner}`) {
  const res = await server.inject({
    method: method as 'GET',
    url,
    payload: payload as object,
    headers: { authorization: auth },
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const ws = () => `/v1/workspaces/${A.workspaceId}`;
const sha = () => crypto.randomBytes(20).toString('hex');

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 8 });
  su = new pg.Client({ connectionString: t.superUrl });
  await su.connect();
  A = await seedSpace(db, 'tk-a');
  server = buildApp({ db, runner: { leaseSeconds: 30, pollMs: 100 }, accounts: settings, sources });
  sys = startSysLoop(db, { reapIntervalMs: 60_000, streamIntervalMs: 50, sources });
  owner = signAccessToken(settings, A.userId);

  // a writable repo in A's project, probed, and a test environment
  const conn = await call('POST', `${ws()}/connectors`, {
    plugin_id: 'connector-fake',
    name: 'GL',
    config: {},
    credential: { token: TOKEN },
  });
  const att = await call('POST', `${ws()}/repos/batch-attach`, {
    connector_id: conn.body.id,
    remote_ids: ['21'],
  });
  const repo = (att.body.items as { id: string }[])[0]!;
  await call('PATCH', `${ws()}/repos/${repo.id}`, {
    access_mode: 'read_write',
    project_id: A.projectId,
  });
  await call('POST', `${ws()}/projects/${A.projectId}/environments`, {
    env_code: 'test',
    name: 'Test',
    env_tier: 'test_gate',
    entry_url: 'http://env.test/',
  });

  const { token } = await withWorkspaceTx(
    db,
    { userId: A.userId, workspaceId: A.workspaceId },
    (tx, ctx) => issueEnrollToken(tx, ctx, { name: 'r' }),
  );
  const secret = `cc_run_key_${crypto.randomBytes(16).toString('hex')}`;
  const reg = await call(
    'POST',
    RUNNER_PATHS.registerRunner,
    {
      enroll_token: token,
      bot_exec_public_key: crypto
        .generateKeyPairSync('x25519')
        .publicKey.export({ type: 'spki', format: 'der' })
        .toString('base64'),
      secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
    },
    '',
  );
  runnerAuth = `Runner ${reg.body.runner_id}:${secret}`;
});
afterAll(async () => {
  await sys?.stop();
  await server?.close();
  await su?.end();
  await db?.close();
  await t?.drop();
});

/** The executor: takes the ticket's first step, then each next one through take_next. */
async function playRound(
  flowId: string,
  outputs: {
    fix: Record<string, unknown> | 'fail';
    verify: (s: StepAssignment) => Record<string, unknown> | Promise<Record<string, unknown>>;
  },
) {
  const hb = (
    await call('POST', RUNNER_PATHS.heartbeatAndPoll, { free_slots: 1, leases: [] }, runnerAuth)
  ).body as unknown as HeartbeatResponse;
  let step: StepAssignment | undefined = hb.assigned.find((s) => s.flow_instance_id === flowId);
  const seen: StepAssignment[] = [];
  while (step) {
    seen.push(step);
    const failed = step.node_key === 'fix' && outputs.fix === 'fail';
    const output =
      step.node_key === 'fix'
        ? failed
          ? {}
          : (outputs.fix as Record<string, unknown>)
        : step.node_key === 'verify'
          ? await outputs.verify(step)
          : {};
    const r = await call(
      'POST',
      RUNNER_PATHS.completeRoundStep,
      {
        work_item_id: step.work_item_id,
        lease_token: step.lease_token,
        fence: step.fence,
        outcome: failed ? 'failed' : 'done',
        output,
        ...(failed
          ? { error: 'stopped: tool_errors (failed 3 times in a row: submit_delivery)' }
          : {}),
        take_next: true,
      },
      runnerAuth,
    );
    expect(r.status).toBe(200);
    step = r.body.next as StepAssignment | undefined;
  }
  return seen;
}

async function waitStatus(ticketId: string, want: string) {
  for (let i = 0; i < 100; i++) {
    const d = await call('GET', `${ws()}/tickets/${ticketId}`);
    if (d.body.status === want) return d.body;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`ticket never reached ${want}`);
}

describe('手动建单与第一轮交付（P4 端到端冒烟）', () => {
  it('建单 → 执行器跑完三个节点 → 宿主机核对分支提交 → 待我审核，交付卡上的提交号就是代码平台上 fix/ 分支的头', async () => {
    const created = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
      title: '审批列表按提交时间排序反了',
      body: '最新的在最下面',
      repro_steps: ['打开 /#/approvals'],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ no: 'M-1', status: 'fixing', current_round: 1 });
    const head = sha();
    const base = sha();
    const branch = 'fix/main/M-1';
    const seen = await playRound(created.body.flow_id as string, {
      fix: {
        model: 'gpt-x',
        delivery: {
          root_cause: 'sort.ts compared strings',
          summary: 'compare timestamps',
          verification: 'vitest',
          repro_tests: ['demo-web/src/sort.test.ts'],
        },
        changes: [
          {
            repo: 'demo-web',
            base_sha: base,
            head_sha: head,
            files: ['M src/pages/approvals/sort.ts', 'A src/pages/approvals/sort.test.ts'],
            added: 12,
            deleted: 1,
          },
        ],
        touched_tests: [],
      },
      verify: () => {
        heads.set(`21:${branch}`, head);
        return {
          verdict: {
            repro_fails_before: true,
            repro_passes_after: true,
            typecheck: true,
            tests: true,
          },
          pushed: [{ repo: 'demo-web', branch, head_sha: head }],
          digests: {},
        };
      },
    });
    expect(seen.map((s) => s.node_key)).toEqual(['prepare', 'fix', 'verify']);
    expect(seen[0]!.config.branch).toBe('fix/main/M-1');
    // a first round starts a new branch, never continues one already on the platform
    expect(seen[0]!.config.fresh).toBe(true);
    expect(seen[2]!.config.env_url).toBe('http://env.test/');
    expect((seen[1]!.config.material as { body: string }).body).toContain('打开 /#/approvals');

    const d = await waitStatus(created.body.id as string, 'in_review');
    const card = (d.rounds as { delivery: DeliveryCard }[])[0]!.delivery;
    expect(card.repos).toEqual([
      {
        repo: 'demo-web',
        branch: 'fix/main/M-1',
        base_sha: base,
        head_sha: head,
        files: expect.any(Array),
        added: 12,
        deleted: 1,
      },
    ]);
    expect(card).toMatchObject({
      root_cause: 'sort.ts compared strings',
      risk_level: 'L0',
      model: 'gpt-x',
      touched_tests: [],
    });
    expect(card.checks.every((c) => c.ok)).toBe(true);
    expect(card.delivery_digest).toMatch(/^[0-9a-f]{64}$/);
    const slices = await su.query('select head_sha, branch from round_repo_slices');
    expect(slices.rows).toEqual([{ head_sha: head, branch: 'fix/main/M-1' }]);
    const notes = await call('GET', `${ws()}/notifications`);
    expect(
      (notes.body.items as { event_type: string; title: string }[]).find(
        (n) => n.event_type === 'round_delivered',
      )?.title,
    ).toContain('M-1');
  });

  it('事实对不上（平台上分支头不是执行器报的提交）就不进审核，转「需要协助」并写明原因', async () => {
    const created = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
      title: 'second',
      body: 'x',
    });
    const head = sha();
    await playRound(created.body.flow_id as string, {
      fix: {
        delivery: { root_cause: 'x', summary: 'y', verification: 'z' },
        changes: [
          {
            repo: 'demo-web',
            base_sha: sha(),
            head_sha: head,
            files: ['M a.ts'],
            added: 1,
            deleted: 0,
          },
        ],
        touched_tests: [],
      },
      verify: () => {
        heads.set('21:fix/main/M-2', sha()); // someone else pushed
        return {
          verdict: { repro_fails_before: true, repro_passes_after: true },
          pushed: [{ repo: 'demo-web', branch: 'fix/main/M-2', head_sha: head }],
        };
      },
    });
    const d = await waitStatus(created.body.id as string, 'needs_help');
    expect((d.rounds as { reason: string }[])[0]!.reason).toBe('facts.head_mismatch:demo-web');
  });

  it('AI 节点失败：本轮「需要协助」，原因带上执行器的报错；改了已有测试的交付按门禁拦下', async () => {
    const failed = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
      title: 'third',
      body: 'x',
    });
    await playRound(failed.body.flow_id as string, { fix: 'fail', verify: () => ({}) });
    const d = await waitStatus(failed.body.id as string, 'needs_help');
    expect((d.rounds as { reason: string }[])[0]!.reason).toContain('tool_errors');

    const touched = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
      title: 'fourth',
      body: 'x',
    });
    const head = sha();
    await playRound(touched.body.flow_id as string, {
      fix: {
        delivery: { root_cause: 'x', summary: 'y', verification: 'z' },
        changes: [
          {
            repo: 'demo-web',
            base_sha: sha(),
            head_sha: head,
            files: ['M src/old.test.ts'],
            added: 1,
            deleted: 3,
          },
        ],
        touched_tests: ['demo-web/src/old.test.ts'],
      },
      verify: () => {
        heads.set('21:fix/main/M-4', head);
        return {
          verdict: { repro_fails_before: true, repro_passes_after: true },
          pushed: [{ repo: 'demo-web', branch: 'fix/main/M-4', head_sha: head }],
        };
      },
    });
    const d2 = await waitStatus(touched.body.id as string, 'needs_help');
    expect((d2.rounds as { reason: string }[])[0]!.reason).toBe('gate.touched_existing_tests');
  });
});

describe('审核（P5）：通过 / 打回开下一轮、证据、项目风险规则', () => {
  it('打回 → 第 2 轮带着意见在同一分支上修 → 再交付 → 通过；只有修复人能审，交付变了旧卡审不了，一轮只审一次', async () => {
    // a second member of A who is not on the ticket
    const other = (
      await su.query<{ id: string }>(
        `insert into users (email, display_name) values ('tk-other@test.local', 'other') returning id`,
      )
    ).rows[0]!.id;
    await su.query(`insert into workspace_members (workspace_id, user_id) values ($1, $2)`, [
      A.workspaceId,
      other,
    ]);
    await su.query(
      `insert into role_bindings (workspace_id, user_id, role_id)
       select $1, $2, id from roles where workspace_id = $1 and is_owner`,
      [A.workspaceId, other],
    );
    const otherAuth = `Bearer ${signAccessToken(settings, other)}`;

    const created = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
      title: '导出按钮没反应',
      body: '点了没下载',
    });
    const id = created.body.id as string;
    const branch = `fix/main/${created.body.no as string}`;
    const png = Buffer.from('89504e470d0a1a0a-not-really-a-png');
    const pngSha = crypto.createHash('sha256').update(png).digest('hex');
    const round = (head: string) => ({
      fix: {
        model: 'gpt-x',
        delivery: { root_cause: 'handler not bound', summary: 's', verification: 'v' },
        changes: [
          {
            repo: 'demo-web',
            base_sha: 'b'.repeat(40),
            head_sha: head,
            files: ['M src/export.ts', 'A src/export.test.ts'],
            added: 8,
            deleted: 2,
          },
        ],
        touched_tests: [],
      },
      verify: async (s: StepAssignment) => {
        heads.set(`21:${branch}`, head);
        // the executor uploads the screenshot under the step's lease before it writes back
        const up = await call(
          'POST',
          RUNNER_PATHS.uploadEvidence,
          {
            work_item_id: s.work_item_id,
            lease_token: s.lease_token,
            fence: s.fence,
            name: 'head-after',
            sha256: pngSha,
            content_type: 'image/png',
            data_base64: png.toString('base64'),
          },
          runnerAuth,
        );
        expect(up.status).toBe(200);
        return {
          verdict: {
            repro_fails_before: true,
            repro_passes_after: true,
            typecheck: true,
            tests: true,
          },
          pushed: [{ repo: 'demo-web', branch, head_sha: head }],
          browser: { head: { screenshots: [{ name: 'after', sha256: pngSha }] } },
          digests: {},
        };
      },
    });
    await playRound(created.body.flow_id as string, round(sha()));
    let d = await waitStatus(id, 'in_review');
    type Round = {
      round_no: number;
      cause: string;
      review_rev: number;
      delivery: DeliveryCard;
      review: { result: string; comment: string } | null;
    };
    const card1 = (d.rounds as Round[])[0]!.delivery;
    expect(d.is_assignee).toBe(true);

    // the evidence: readable in the workspace, invisible elsewhere
    const shot = card1.screenshots.find((x) => x.name === 'head-after');
    expect(shot?.evidence_id).toBeTruthy();
    const img = await server.inject({
      method: 'GET',
      url: `${ws()}/evidence/${shot!.evidence_id}`,
      headers: { authorization: `Bearer ${owner}` },
    });
    expect(img.statusCode).toBe(200);
    expect(img.rawPayload.equals(png)).toBe(true);
    const B = await seedSpace(db, 'tk-b');
    const fromB = await server.inject({
      method: 'GET',
      url: `/v1/workspaces/${B.workspaceId}/evidence/${shot!.evidence_id}`,
      headers: { authorization: `Bearer ${signAccessToken(settings, B.userId)}` },
    });
    expect(fromB.statusCode).toBe(404);

    const review = (body: Record<string, unknown>, auth?: string) =>
      call('POST', `${ws()}/tickets/${id}/review`, body, auth);
    const base = { round_no: 1, delivery_digest: card1.delivery_digest, review_rev: 0 };
    expect((await review({ ...base, decision: 'approve' }, otherAuth)).status).toBe(403);
    expect(
      (await review({ ...base, delivery_digest: 'stale', decision: 'approve' })).body.code,
    ).toBe('review.stale');
    expect((await review({ ...base, decision: 'reject' })).body.code).toBe(
      'review.comment_required',
    );

    // a stricter project rule: 10 changed lines are no longer L0 for round 2
    await su.query(`update projects set risk_rules = '{"l0_max_lines": 5}' where id = $1`, [
      A.projectId,
    ]);
    const rejected = await review({
      ...base,
      decision: 'reject',
      comment: '管理员账号点了还是没反应',
      reject_category: 'still_broken',
      location: { repo: 'demo-web', path: 'src/export.ts', line: 12 },
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({ status: 'fixing', current_round: 2 });
    const rs = rejected.body.rounds as Round[];
    expect(rs[0]!.review).toMatchObject({
      result: 'rejected',
      comment: '管理员账号点了还是没反应',
    });
    expect(rs[1]).toMatchObject({ round_no: 2, cause: 'code_rejected', status: 'fixing' });
    // one review per round
    expect((await review({ ...base, decision: 'approve' })).status).toBe(409);

    const flow2 = rs[1] as unknown as { flow_id: string };
    const seen = await playRound(flow2.flow_id, round(sha()));
    // round 2 continues on the branch round 1 pushed
    expect(seen[0]!.config.branch).toBe(branch);
    expect(seen[0]!.config.fresh).toBeUndefined();
    expect((seen[1]!.config.material as { review: unknown }).review).toEqual({
      round_no: 1,
      comment: '管理员账号点了还是没反应',
      category: 'still_broken',
      location: { repo: 'demo-web', path: 'src/export.ts', line: 12 },
    });
    d = await waitStatus(id, 'in_review');
    const card2 = (d.rounds as Round[])[1]!.delivery;
    expect(card2.risk_level).toBe('L1');

    const ok = await review({
      decision: 'approve',
      round_no: 2,
      delivery_digest: card2.delivery_digest,
      review_rev: 0,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('approved');
    const flows = await su.query(
      `select f.status from flow_instances f join rounds r on r.flow_instance_id = f.id
        where r.ticket_id = $1 order by r.round_no`,
      [id],
    );
    expect(flows.rows.map((x) => x.status)).toEqual(['done', 'done']);
    expect((await su.query('select count(*)::int as n from reviews')).rows[0].n).toBe(2);
  });
});
