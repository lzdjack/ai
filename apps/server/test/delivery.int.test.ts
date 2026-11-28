// The delivery segment end to end (docs/06 §3.3, §6.3, §6.4, §7.1–§7.4; 05 steps 5–12; 07 P6): an
// approved ticket goes to the test environment, is retested, merged back to main and released to
// production. Both executors are played over the real RunnerTransport (the Bot executor builds, the
// release executor merges and releases with the person's own account, opened with its release_exec
// key); cc-sys opens the MRs and notifies. A release step that dies mid-way is marked interrupted,
// waits for a person, and its retry reads back first. No Docker, no network.
import crypto from 'node:crypto';
import {
  RUNNER_PATHS,
  type CodeSourceConnector,
  type DeliveryView,
  type HeartbeatResponse,
  type MergeRequestInfo,
  type ReleaseProviderConnector,
  type StepAssignment,
  type StepSecrets,
} from '@cloudcraft/core-protocol';
import { openFromServer } from '@cloudcraft/core-protocol/envelope';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb, withWorkspaceTx, type Db } from '../src/db/client.ts';
import { reapExpiredLeases } from '../src/orchestrator/effects.ts';
import { signAccessToken } from '../src/service/auth-crypto.ts';
import { deliveryStepInterrupted } from '../src/service/release-step-service.ts';
import { issueEnrollToken } from '../src/service/runner-service.ts';
import { startSysLoop, type SysLoop } from '../src/sys.ts';
import { createTestDb, type TestDb } from './db.ts';
import { seedSpace, testAccounts, testSources, type Space } from './fixtures.ts';

const sha = () => crypto.randomBytes(20).toString('hex');

// ---- the code platform: branch heads, MRs, ancestry (remote id 31) ----
const heads = new Map<string, string>();
const mrs = new Map<string, MergeRequestInfo & { source: string; target: string }>();
/** commits known to contain another (descendant → ancestors) */
const ancestry = new Map<string, Set<string>>();
const merged: { iid: string; token: string; expected: string }[] = [];
const code: CodeSourceConnector = {
  manifest: {
    id: 'connector-code',
    name: 'Code',
    category: 'code_source',
    configSchema: {} as never,
    authSchema: {} as never,
    personalAuthSchema: {} as never,
  },
  verify: async (_c, cred) => ({
    ok: String(cred.token).startsWith('tok-'),
    latency_ms: 1,
    identity: `@${String(cred.token)}`,
    scopes: [],
    has_merge_perm: true,
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
  openMergeRequest: async (_c, _k, id, mr) => {
    const open = [...mrs.values()].find(
      (m) => m.state === 'open' && m.source === mr.source && m.target === mr.target,
    );
    if (open) return { ...open, head_sha: heads.get(`${id}:${mr.source}`) ?? null };
    const iid = String(mrs.size + 1);
    const m = {
      iid,
      state: 'open' as const,
      head_sha: heads.get(`${id}:${mr.source}`) ?? null,
      merge_sha: null,
      web_url: `http://git.test/mr/${iid}`,
      source: mr.source,
      target: mr.target,
    };
    mrs.set(iid, m);
    return m;
  },
  getMergeRequest: async (_c, _k, _id, iid) => mrs.get(iid)!,
  mergeMergeRequest: async () => {
    throw new Error('merges run in the release executor, not here');
  },
  isAncestor: async (_c, _k, _id, a, d) => a === d || !!ancestry.get(d)?.has(a),
};
const release: ReleaseProviderConnector = {
  manifest: {
    id: 'connector-release',
    name: 'Release',
    category: 'release',
    configSchema: {} as never,
    authSchema: {} as never,
    personalAuthSchema: {} as never,
  },
  verify: async () => ({
    ok: true,
    latency_ms: 1,
    identity: null,
    scopes: [],
    has_merge_perm: null,
    visible_repo_count: null,
  }),
  verifyPersonal: async (_c, p) => ({
    ok: p.password === 'right',
    latency_ms: 1,
    identity: String(p.username),
    scopes: [],
    has_merge_perm: null,
    visible_repo_count: null,
    ...(p.password === 'right' ? {} : { error_raw: 'Bad credentials' }),
  }),
  publish: async () => {
    throw new Error('runs in the release executor');
  },
  release: async () => {
    throw new Error('runs in the release executor');
  },
  current: async () => null,
};

let t: TestDb;
let db: Db;
let su: pg.Client;
let A: Space;
let sys: SysLoop;
let server: ReturnType<typeof buildApp>;
let owner = '';
let botAuth = '';
let relAuth = '';
let relKey = '';
let codeConn = '';
let relConn = '';
let repoId = '';
const { settings } = testAccounts();
const sources = testSources(
  new Map<string, CodeSourceConnector | ReleaseProviderConnector>([
    ['connector-code', code],
    ['connector-release', release],
  ]) as never,
);

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

async function enroll(roles: string[]) {
  const { token } = await withWorkspaceTx(
    db,
    { userId: A.userId, workspaceId: A.workspaceId },
    (tx, ctx) => issueEnrollToken(tx, ctx, { name: roles.join('+'), roles }),
  );
  const keys = crypto.generateKeyPairSync('x25519');
  const secret = `cc_run_key_${crypto.randomBytes(16).toString('hex')}`;
  const pub = keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const reg = await call(
    'POST',
    RUNNER_PATHS.registerRunner,
    {
      enroll_token: token,
      [roles.includes('release') ? 'release_exec_public_key' : 'bot_exec_public_key']: pub,
      secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
    },
    '',
  );
  expect(reg.status).toBe(200);
  return {
    auth: `Runner ${reg.body.runner_id as string}:${secret}`,
    key: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };
}

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 8 });
  su = new pg.Client({ connectionString: t.superUrl });
  await su.connect();
  A = await seedSpace(db, 'dl-a');
  server = buildApp({ db, runner: { leaseSeconds: 30, pollMs: 100 }, accounts: settings, sources });
  sys = startSysLoop(db, { reapIntervalMs: 60_000, streamIntervalMs: 50, sources });
  owner = signAccessToken(settings, A.userId);

  const conn = await call('POST', `${ws()}/connectors`, {
    plugin_id: 'connector-code',
    name: 'GL',
    config: { base_url: 'http://git.test' },
    credential: { token: 'tok-bot' },
  });
  codeConn = conn.body.id as string;
  const att = await call('POST', `${ws()}/repos/batch-attach`, {
    connector_id: codeConn,
    remote_ids: ['31'],
  });
  repoId = (att.body.items as { id: string }[])[0]!.id;
  await call('PATCH', `${ws()}/repos/${repoId}`, {
    access_mode: 'read_write',
    project_id: A.projectId,
  });
  for (const [code_, tier] of [
    ['test', 'test_gate'],
    ['prod', 'production'],
  ])
    await call('POST', `${ws()}/projects/${A.projectId}/environments`, {
      env_code: code_,
      name: code_,
      env_tier: tier,
      entry_url: `http://${code_}.env.test/`,
    });
  const rel = await call('POST', `${ws()}/connectors`, {
    plugin_id: 'connector-release',
    name: 'Apollo',
    config: { apollo_url: 'http://apollo.test' },
    credential: { oss_access_key: 'oss-shared-key' },
  });
  relConn = rel.body.id as string;
  const rc = await call('PUT', `${ws()}/projects/${A.projectId}/release-config`, {
    repo_id: repoId,
    provider_connector_id: relConn,
    target_ref: { app_id: 'demo-web', env_map: { test: 'TEST', prod: 'PRO' } },
    test_branch: 'test',
  });
  expect(rc.status).toBe(200);
  botAuth = (await enroll(['bot'])).auth;
  ({ auth: relAuth, key: relKey } = await enroll(['release']));
});
afterAll(async () => {
  await sys?.stop();
  await server?.close();
  await su?.end();
  await db?.close();
  await t?.drop();
});

const lease = (s: StepAssignment) => ({
  work_item_id: s.work_item_id,
  lease_token: s.lease_token,
  fence: s.fence,
});

/** Polls a runner until it gets a step of the flow (cc-sys and the lock may take a moment). */
async function take(auth: string, flowId: string) {
  for (let i = 0; i < 100; i++) {
    const hb = (
      await call('POST', RUNNER_PATHS.heartbeatAndPoll, { free_slots: 1, leases: [] }, auth)
    ).body as unknown as HeartbeatResponse;
    const s = hb.assigned.find((x) => x.flow_instance_id === flowId);
    if (s) return s;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('no step handed out');
}

async function complete(
  auth: string,
  s: StepAssignment,
  output: Record<string, unknown>,
  error?: string,
) {
  const r = await call(
    'POST',
    RUNNER_PATHS.completeRoundStep,
    { ...lease(s), outcome: error ? 'failed' : 'done', output, ...(error ? { error } : {}) },
    auth,
  );
  expect(r.status).toBe(200);
}

async function view(ticketId: string) {
  return (await call('GET', `${ws()}/tickets/${ticketId}/delivery`))
    .body as unknown as DeliveryView;
}

async function waitNode(ticketId: string, key: string, status: string) {
  for (let i = 0; i < 100; i++) {
    const v = await view(ticketId);
    if (v.nodes.find((n) => n.key === key)?.status === status) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`${key} never ${status}: ${JSON.stringify((await view(ticketId)).nodes)}`);
}

/** A ticket whose round 1 is approved: fix/ head on the platform is the delivered commit. */
async function approvedTicket(title: string) {
  const created = await call('POST', `${ws()}/projects/${A.projectId}/tickets`, {
    title,
    body: 'x',
  });
  const id = created.body.id as string;
  const branch = `fix/main/${created.body.no as string}`;
  const head = sha();
  let step: StepAssignment | undefined = await take(botAuth, created.body.flow_id as string);
  while (step) {
    const output =
      step.node_key === 'fix'
        ? {
            delivery: { root_cause: 'r', summary: 's', verification: 'v' },
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
          }
        : step.node_key === 'verify'
          ? (heads.set(`31:${branch}`, head),
            {
              verdict: { repro_fails_before: true, repro_passes_after: true },
              pushed: [{ repo: 'demo-web', branch, head_sha: head }],
            })
          : {};
    const r = await call(
      'POST',
      RUNNER_PATHS.completeRoundStep,
      { ...lease(step), outcome: 'done', output, take_next: true },
      botAuth,
    );
    step = r.body.next as StepAssignment | undefined;
  }
  for (let i = 0; i < 100; i++) {
    const d = await call('GET', `${ws()}/tickets/${id}`);
    if (d.body.status === 'in_review') {
      const r = (d.body.rounds as { delivery: { delivery_digest: string } }[])[0]!;
      const ok = await call('POST', `${ws()}/tickets/${id}/review`, {
        decision: 'approve',
        round_no: 1,
        delivery_digest: r.delivery.delivery_digest,
        review_rev: 0,
      });
      expect(ok.status).toBe(200);
      return { id, branch, head };
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('never in review');
}

/** The release executor merges: it opens the step's accounts with its release_exec key. */
async function playMerge(flowId: string, branchHead: (target: string) => void) {
  const s = await take(relAuth, flowId);
  expect(s.config.action).toBe('merge');
  const env = await call('POST', RUNNER_PATHS.fetchStepSecrets, lease(s), relAuth);
  const secrets = openFromServer(relKey, env.body as never) as unknown as StepSecrets;
  const mr = mrs.get(String(s.config.mr_iid))!;
  merged.push({
    iid: mr.iid,
    token: String(secrets.personal.token),
    expected: String(s.config.expected_sha),
  });
  const mergeSha = sha();
  ancestry.set(mergeSha, new Set([String(s.config.expected_sha)]));
  Object.assign(mr, { state: 'merged', merge_sha: mergeSha, head_sha: null });
  branchHead(mr.target);
  heads.set(`31:${mr.target}`, mergeSha);
  await complete(relAuth, s, { merge_sha: mergeSha });
  return mergeSha;
}

/** build (Bot executor) → publish → release → verify (release executor), all succeeding. */
async function playRelease(flowId: string, ref: string, mergeSha: string) {
  const build = await take(botAuth, flowId);
  expect(build.config).toMatchObject({ action: 'build', ref, target_repo: 'demo-web' });
  // the build sandbox gets no account: step secrets are for the release executor only
  expect((await call('POST', RUNNER_PATHS.fetchStepSecrets, lease(build), botAuth)).status).toBe(
    403,
  );
  const commit = sha();
  ancestry.set(commit, new Set([mergeSha, ...(ancestry.get(mergeSha) ?? [])]));
  const file = Buffer.from(`<h1>${commit}</h1>`);
  const fileSha = crypto.createHash('sha256').update(file).digest('hex');
  const version = `1.0.0-${commit.slice(0, 7)}`;
  const up = await call(
    'POST',
    RUNNER_PATHS.uploadArtifact,
    {
      ...lease(build),
      version,
      commit,
      files: [{ path: 'index.html', sha256: fileSha, data_base64: file.toString('base64') }],
    },
    botAuth,
  );
  expect(up.status).toBe(200);
  await complete(botAuth, build, { version, commit });

  const pub = await take(relAuth, flowId);
  expect(pub.config).toMatchObject({ action: 'publish', version, commit, read_back_first: false });
  const got = await call(
    'POST',
    RUNNER_PATHS.fetchArtifact,
    { ...lease(pub), sha256: fileSha },
    relAuth,
  );
  expect(Buffer.from(got.body.data_base64 as string, 'base64').equals(file)).toBe(true);
  await complete(relAuth, pub, {
    location: { prefix: `demo-web/${version}/` },
    command: 'craft publish',
  });

  const rel = await take(relAuth, flowId);
  const secrets = openFromServer(
    relKey,
    (await call('POST', RUNNER_PATHS.fetchStepSecrets, lease(rel), relAuth)).body as never,
  ) as unknown as StepSecrets;
  return { rel, secrets, version, commit };
}

describe('交付段（P6）：合入测试分支 → 发测试 → 复测 → 合回主分支 → 发正式', () => {
  it('demo 单走到正式环境：本人账号合 MR 和发布、三项前置现算、发布中途中断后人点重试先回读', async () => {
    const { id, branch, head } = await approvedTicket('审批列表排序反了');

    // 5 发起发测试: the clicker's own Apollo account first (01 PC-第一次发布-配账号)
    const start = () => call('POST', `${ws()}/tickets/${id}/delivery/test`, { round_no: 1 });
    expect(start).toBeTruthy();
    let r = await start();
    expect(r.body).toMatchObject({
      code: 'delivery.account_missing',
      data: { connector_ids: [relConn] },
    });
    expect((await view(id)).missing_accounts).toEqual([relConn]);
    r = await call('PUT', `${ws()}/me/accounts/${relConn}`, {
      credential: { username: 'lin.x', password: 'wrong' },
    });
    expect(r.body.code).toBe('account.verify_failed');
    r = await call('PUT', `${ws()}/me/accounts/${relConn}`, {
      credential: { username: 'lin.x', password: 'right' },
    });
    expect(r.status).toBe(200);
    // personal accounts are listed under 我的账号, never with the shared connectors
    const listed = (await call('GET', `${ws()}/connectors`)).body.items as { id: string }[];
    expect(listed.map((c) => c.id).sort()).toEqual([codeConn, relConn].sort());
    r = await start();
    expect(r.status).toBe(200);
    const flowId = r.body.flow_id as string;
    // the same click again lands on the same task
    expect((await start()).body.flow_id).toBe(flowId);

    // 6 MR → test branch: cc-sys opens it with the workspace connector; the reviewer needs their token
    let v = await waitNode(id, 'test_mr_review', 'waiting_human');
    const mr = v.merge_requests[0]!;
    expect(mr).toMatchObject({
      direction: 'to_env',
      source_branch: branch,
      target_branch: 'test',
      head_sha: head,
    });
    expect(v.can.review_mr).toBe(true);
    expect(v.missing_accounts).toEqual([codeConn]);
    // the assignee reviews the test MR: it is "mine" in the list with what waits on them
    const listed1 = (await call('GET', `${ws()}/tickets`)).body.items as {
      id: string;
      waiting_on_me: string | null;
    }[];
    expect(listed1.find((x) => x.id === id)?.waiting_on_me).toBe('merge_review');
    const review = (body: Record<string, unknown>) =>
      call('POST', `${ws()}/tickets/${id}/delivery/merge-review`, body);
    expect((await review({ decision: 'approve', expected_head_sha: sha() })).body.code).toBe(
      'merge.head_changed',
    );
    expect((await review({ decision: 'approve', expected_head_sha: head })).body.code).toBe(
      'delivery.account_missing',
    );
    await call('PUT', `${ws()}/me/accounts/${codeConn}`, { credential: { token: 'tok-owner' } });
    expect((await review({ decision: 'approve', expected_head_sha: head })).status).toBe(200);
    const testMerge = await playMerge(flowId, () => {});
    // merged with the reviewer's own token, at the head they approved
    expect(merged.at(-1)).toMatchObject({ token: 'tok-owner', expected: head });

    // 7 build on the test branch → publish → release (no regression: nothing live yet) → verify
    let p = await playRelease(flowId, 'test', testMerge);
    expect(p.rel.config).toMatchObject({
      action: 'release',
      provider_env: 'TEST',
      version: p.version,
    });
    // the release runs with the clicker's account; the shared key comes along
    expect(p.secrets).toMatchObject({
      plugin_id: 'connector-release',
      personal: { username: 'lin.x', password: 'right' },
      credential: { oss_access_key: 'oss-shared-key' },
    });
    // the serial lock: this task runs, nobody else may release demo-web to test meanwhile
    expect((await view(id)).release_tasks[0]!.status).toBe('running');
    await complete(relAuth, p.rel, {
      revision: '11',
      command: 'tita release --app demo-web --env TEST',
    });
    let vs = await take(relAuth, flowId);
    expect(vs.config).toMatchObject({
      action: 'verify',
      provider_env: 'TEST',
      expect_commit: p.commit,
    });
    await complete(relAuth, vs, { version: p.version, commit: p.commit, revision: '11' });

    // 8 → 9 the tester (the reporter) retests
    v = await waitNode(id, 'retest', 'waiting_human');
    const testTask = v.release_tasks[0]!;
    expect(testTask).toMatchObject({
      status: 'effective_pending_retest',
      version: p.version,
      verified_revision: '11',
    });
    expect(testTask.steps.map((s) => [s.slot, s.status])).toEqual([
      ['build', 'succeeded'],
      ['publish', 'succeeded'],
      ['release', 'succeeded'],
      ['verify', 'succeeded'],
      ['notify', 'succeeded'],
    ]);
    expect(v.test_records[0]).toMatchObject({
      result: 'pending',
      version: p.version,
      tester_id: A.userId,
    });
    // the release tab's facts: the test environment now runs this version, names resolved
    expect(v.environments.find((e) => e.tier === 'test_gate')?.live_version).toBe(p.version);
    expect(v.tester_id).toBe(A.userId);
    expect(v.people[A.userId]).toBeTruthy();
    expect(v.config).toMatchObject({ provider_connector_id: relConn, test_branch: 'test' });
    const listed2 = (await call('GET', `${ws()}/tickets`)).body.items as {
      id: string;
      waiting_on_me: string | null;
    }[];
    expect(listed2.find((x) => x.id === id)?.waiting_on_me).toBe('retest');
    expect(v.prod_gates).toEqual({ code_review: true, retest: false, main_merged: false });
    expect((await call('POST', `${ws()}/tickets/${id}/delivery/production`)).body.code).toBe(
      'delivery.prod_gates_open',
    );
    expect(
      (
        await call('POST', `${ws()}/tickets/${id}/delivery/retest`, {
          decision: 'pass',
          release_task_id: testTask.id,
        })
      ).status,
    ).toBe(200);

    // 10 the assignee asks to merge back; MR → main, reviewed, merged by the release executor
    await waitNode(id, 'main_request', 'waiting_human');
    expect((await call('POST', `${ws()}/tickets/${id}/delivery/main`)).status).toBe(200);
    v = await waitNode(id, 'main_mr_review', 'waiting_human');
    expect(v.merge_requests[1]).toMatchObject({
      direction: 'to_main',
      target_branch: 'main',
      head_sha: head,
    });
    expect((await review({ decision: 'approve', expected_head_sha: head })).status).toBe(200);
    const mainMerge = await playMerge(flowId, () => {});

    // 11 three gates now hold; a production releaser clicks
    v = await waitNode(id, 'prod_request', 'waiting_human');
    expect(v.prod_gates).toEqual({ code_review: true, retest: true, main_merged: true });
    expect(v.can.release_prod).toBe(true);
    expect((await call('POST', `${ws()}/tickets/${id}/delivery/production`)).status).toBe(200);

    // 12 rebuilt on main (never the test package) → publish → release … and the executor dies
    p = await playRelease(flowId, 'main', mainMerge);
    expect(p.rel.config).toMatchObject({
      action: 'release',
      provider_env: 'PRO',
      read_back_first: false,
    });
    await su.query(
      `update work_items set lease_expires_at = now() - interval '1 second' where id = $1`,
      [p.rel.work_item_id],
    );
    expect(
      await reapExpiredLeases(db, { owner: 'test', onInterrupted: deliveryStepInterrupted }),
    ).toBe(1);
    v = await view(id);
    expect(v.nodes.find((n) => n.key === 'prod_release')).toMatchObject({
      status: 'failed',
      error: 'interrupted',
    });
    expect(v.can.retry).toBe('prod_release');
    const prodTask = v.release_tasks.find((x) => x.environment.tier === 'production')!;
    expect(prodTask.status).toBe('failed');
    expect(prodTask.steps.find((s) => s.slot === 'release')).toMatchObject({
      status: 'failed',
      error: 'interrupted',
    });
    // the late write-back of the dead attempt is refused
    expect(
      (
        await call(
          'POST',
          RUNNER_PATHS.completeRoundStep,
          { ...lease(p.rel), outcome: 'done', output: {} },
          relAuth,
        )
      ).status,
    ).toBe(409);

    // 「从这一步重试」: the retry is told to read back first (the release may have happened)
    expect(
      (await call('POST', `${ws()}/tickets/${id}/delivery/retry`, { node_key: 'prod_release' }))
        .status,
    ).toBe(200);
    const retry = await take(relAuth, flowId);
    expect(retry.config).toMatchObject({
      action: 'release',
      provider_env: 'PRO',
      read_back_first: true,
    });
    await complete(relAuth, retry, { revision: '12', read_back: true });
    vs = await take(relAuth, flowId);
    await complete(relAuth, vs, { version: p.version, commit: p.commit, revision: '12' });

    for (let i = 0; i < 100 && (await view(id)).flow?.status !== 'done'; i++)
      await new Promise((res) => setTimeout(res, 50));
    v = await view(id);
    expect(v.flow?.status).toBe('done');
    expect(v.release_tasks.map((x) => [x.environment.tier, x.status, x.version])).toEqual([
      ['test_gate', 'effective', expect.stringMatching(/^1\.0\.0-/)],
      ['production', 'effective', p.version],
    ]);
    // the release effect ran once and its retry was recorded as read back
    const eff = await su.query(
      `select status, verified_at is not null as read_back from effects where effect_key like 'release:%' order by created_at`,
    );
    expect(eff.rows).toEqual([
      { status: 'succeeded', read_back: false },
      { status: 'succeeded', read_back: true },
    ]);
    const notes = (await call('GET', `${ws()}/notifications`)).body.items as {
      event_type: string;
    }[];
    expect(notes.map((n) => n.event_type)).toEqual(
      expect.arrayContaining([
        'merge_review',
        'retest_ready',
        'retest_passed',
        'released_to_production',
        'delivery_failed',
      ]),
    );

    // every step that moved said so on the change stream, so an open screen knows to read again
    const silent = await su.query(
      `select n.node_key, n.status from node_runs n
        where n.flow_instance_id = $1 and not exists (
          select 1 from change_stream c
           where c.entity = 'node_run' and c.entity_id = n.id
             and c.row->>'status' = n.status and c.row->>'ticket_id' = $2)`,
      [flowId, id],
    );
    expect(silent.rows).toEqual([]);

    // the view is one moment in time: a release that commits while it is being read shows up in all
    // of it or in none of it. Holding release_configs parks the read between the live versions and
    // the release list, which both come from release_tasks.
    const prodVersion = p.version;
    await su.query('begin');
    await su.query('lock table release_configs in access exclusive mode');
    const reading = view(id);
    let parked = false;
    for (let i = 0; i < 100 && !parked; i++) {
      await new Promise((res) => setTimeout(res, 20));
      const w = await su.query(
        `select 1 from pg_locks where relation = 'release_configs'::regclass and not granted`,
      );
      parked = !!w.rowCount;
    }
    expect(parked).toBe(true);
    await su.query(`update release_tasks set status = 'superseded' where version = $1`, [
      prodVersion,
    ]);
    await su.query('commit');
    v = await reading;
    const seen = () => ({
      live: v.environments.find((e) => e.tier === 'production')?.live_version,
      task: v.release_tasks.find((x) => x.environment.tier === 'production')?.status,
    });
    expect(seen()).toEqual({ live: prodVersion, task: 'effective' });
    v = await view(id);
    expect(seen()).toEqual({ live: null, task: 'superseded' });
  }, 60_000);

  it('MR 被打回：发布流程结束，本单回「打回重修」开第 2 轮，在同一分支上带着意见修', async () => {
    const { id, branch, head } = await approvedTicket('导出没反应');
    expect(
      (await call('POST', `${ws()}/tickets/${id}/delivery/test`, { round_no: 1 })).status,
    ).toBe(200);
    await waitNode(id, 'test_mr_review', 'waiting_human');
    const back = await call('POST', `${ws()}/tickets/${id}/delivery/merge-review`, {
      decision: 'reject',
      expected_head_sha: head,
      comment: '测试分支上冲突的写法不对',
    });
    expect(back.status).toBe(200);
    const v = await view(id);
    expect(v.flow?.status).toBe('cancelled');
    expect(v.merge_requests[0]!.state).toBe('rejected');
    expect(v.release_tasks[0]!.status).toBe('cancelled');
    const d = await call('GET', `${ws()}/tickets/${id}`);
    expect(d.body).toMatchObject({ status: 'fixing', current_round: 2 });
    const r2 = (d.body.rounds as { cause: string; flow_id: string }[])[1]!;
    expect(r2.cause).toBe('mr_rejected');
    const s = await take(botAuth, r2.flow_id);
    expect(s.config.branch).toBe(branch);
    const fix = await call(
      'POST',
      RUNNER_PATHS.completeRoundStep,
      { ...lease(s), outcome: 'done', output: {}, take_next: true },
      botAuth,
    );
    const next = fix.body.next as StepAssignment;
    expect((next.config.material as { review: unknown }).review).toEqual({
      round_no: 1,
      comment: '测试分支上冲突的写法不对',
      category: 'mr_rejected',
      location: null,
    });
  });
});
