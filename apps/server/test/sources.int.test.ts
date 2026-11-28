// Connectors, repositories and credential envelopes (docs/06 §2.10, §10.3; 07 P3). A scripted code
// source stands in for GitLab (no network); the executor side is a real X25519 key pair.
import crypto from 'node:crypto';
import {
  RUNNER_PATHS,
  type CodeSourceConnector,
  type CredentialEnvelope,
  type HealthCheckResponse,
  type HeartbeatResponse,
  type StepAssignment,
} from '@cloudcraft/core-protocol';
import { openFromServer } from '@cloudcraft/core-protocol/envelope';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb, withWorkspaceTx, type Db } from '../src/db/client.ts';
import { issueEnrollToken } from '../src/service/runner-service.ts';
import { createTestDb, type TestDb } from './db.ts';
import { seedSpace, testAccounts, testSources, type Space } from './fixtures.ts';
import { signAccessToken } from '../src/service/auth-crypto.ts';
import { users, workspaceMembers, roleBindings, roles } from '../src/db/schema/index.ts';
import { insertRow } from '../src/db/write.ts';
import { eq } from 'drizzle-orm';
import pg from 'pg';

const TOKEN = 'glpat-super-secret-91d0';
const FILES: Record<string, Record<string, string>> = {
  '11': {
    'package.json': JSON.stringify({
      scripts: { build: 'tsc -p . && vite build', test: 'vitest run' },
      dependencies: { react: '19.3.1', '@demo/lib': 'link:../demo-lib' },
      devDependencies: { vite: '8.3.8', vitest: '5.1.0', typescript: '6.0.3' },
    }),
    'pnpm-lock.yaml': 'lockfileVersion: 9',
    'tsconfig.json': '{}',
    'index.html': '<div id="root"></div>',
  },
  '12': {
    'package.json': JSON.stringify({
      scripts: { build: 'tsc -p .', test: 'vitest run' },
      devDependencies: { vitest: '5.1.0', typescript: '6.0.3' },
    }),
    'pnpm-lock.yaml': 'lockfileVersion: 9',
    'tsconfig.json': '{}',
  },
};
const REPOS = { '11': 'demo/demo-web', '12': 'demo/demo-lib' } as Record<string, string>;
const fake: CodeSourceConnector = {
  manifest: {
    id: 'connector-fake',
    name: 'Fake',
    category: 'code_source',
    configSchema: {} as never,
    authSchema: {} as never,
  },
  async verify(_c, cred) {
    const ok = cred.token === TOKEN;
    return {
      ok,
      latency_ms: 1,
      identity: ok ? '@cc-bot' : null,
      scopes: [],
      has_merge_perm: false,
      visible_repo_count: ok ? 2 : null,
      ...(ok ? {} : { error_raw: '401' }),
    };
  },
  async listRepos() {
    return { items: Object.keys(REPOS).map((id) => this.toRepo(id)), has_more: false };
  },
  async getRepo(_c, _k, id) {
    return this.toRepo(id);
  },
  async readFile(_c, cred, id, p) {
    if (cred.token !== TOKEN) throw new Error('401');
    return FILES[id]?.[p] ?? null;
  },
  branchHead: async () => null,
  gitAuth: (cred) => ({ header: 'Authorization', value: `Bearer ${String(cred.token)}` }),
  // merges and MRs belong to the delivery segment (delivery.int.test.ts)
  openMergeRequest: () => Promise.reject(new Error('not used here')),
  getMergeRequest: () => Promise.reject(new Error('not used here')),
  mergeMergeRequest: () => Promise.reject(new Error('not used here')),
  isAncestor: () => Promise.resolve(false),
  toRepo(id: string) {
    return {
      remote_id: id,
      path: REPOS[id]!,
      name: REPOS[id]!.split('/')[1]!,
      description: null,
      default_branch: 'main',
      clone_url: `http://git.test/${REPOS[id]}.git`,
      web_url: null,
    };
  },
} as CodeSourceConnector & {
  toRepo(
    id: string,
  ): ReturnType<CodeSourceConnector['getRepo']> extends Promise<infer R> ? R : never;
};

let t: TestDb;
let db: Db;
let A: Space;
let server: ReturnType<typeof buildApp>;
/** superuser: reads across RLS to check what is stored */
let su: pg.Client;
const { settings } = testAccounts();
const sources = testSources(new Map([['connector-fake', fake]]));
let owner = '';
let member = '';

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 6 });
  su = new pg.Client({ connectionString: t.superUrl });
  await su.connect();
  A = await seedSpace(db, 'src-a');
  server = buildApp({ db, runner: { leaseSeconds: 30, pollMs: 100 }, accounts: settings, sources });
  owner = signAccessToken(settings, A.userId);
  const [m] = await db.orm
    .insert(users)
    .values({ email: 'member@src.test', displayName: 'M' })
    .returning();
  await withWorkspaceTx(db, { userId: A.userId, workspaceId: A.workspaceId }, async (tx, ctx) => {
    await insertRow(tx, ctx, workspaceMembers, { userId: m!.id });
    const [r] = await tx.select().from(roles).where(eq(roles.key, 'member'));
    await insertRow(tx, ctx, roleBindings, {
      userId: m!.id,
      roleId: r!.id,
      scopeType: 'workspace',
    });
  });
  member = signAccessToken(settings, m!.id);
});
afterAll(async () => {
  await su?.end();
  await server?.close();
  await db?.close();
  await t?.drop();
});

async function call(method: string, url: string, token?: string, payload?: unknown) {
  const res = await server.inject({
    method: method as 'GET',
    url,
    payload: payload as object,
    headers: token ? { authorization: token.startsWith('Runner') ? token : `Bearer ${token}` } : {},
  });
  return { status: res.statusCode, body: res.json() as Record<string, unknown> };
}
const ws = () => `/v1/workspaces/${A.workspaceId}`;

/** Enrolls an executor with a real X25519 key pair: its auth header and private key. */
async function enrollRunner(name: string) {
  const keys = crypto.generateKeyPairSync('x25519');
  const { token } = await withWorkspaceTx(
    db,
    { userId: A.userId, workspaceId: A.workspaceId },
    (tx, ctx) => issueEnrollToken(tx, ctx, { name }),
  );
  const secret = `cc_run_key_${crypto.randomBytes(16).toString('hex')}`;
  const reg = await call('POST', RUNNER_PATHS.registerRunner, undefined, {
    enroll_token: token,
    bot_exec_public_key: keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
  });
  return {
    id: reg.body.runner_id as string,
    auth: `Runner ${reg.body.runner_id}:${secret}`,
    pem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

describe('连接器、仓库与凭据信封（P3）', () => {
  let connectorId = '';
  let web = '';
  let lib = '';
  let project = '';
  let flow = '';

  it('连接器：鉴权不通不保存；保存后库里只有密文，接口只回打码提示；成员角色不能管连接器', async () => {
    const bad = await call('POST', `${ws()}/connectors`, owner, {
      plugin_id: 'connector-fake',
      name: 'GL',
      config: {},
      credential: { token: 'wrong' },
    });
    expect([bad.status, bad.body.code]).toEqual([400, 'connector.verify_failed']);
    const byMember = await call('POST', `${ws()}/connectors/verify`, member, {
      plugin_id: 'connector-fake',
      config: {},
      credential: { token: TOKEN },
    });
    expect(byMember.status).toBe(403);
    const ok = await call('POST', `${ws()}/connectors`, owner, {
      plugin_id: 'connector-fake',
      name: 'GL',
      config: { base_url: 'http://git.test' },
      credential: { token: TOKEN },
    });
    expect(ok.status).toBe(201);
    connectorId = ok.body.id as string;
    expect(ok.body.credential_hint).toBe('•••• 91d0');
    const stored = await su.query('select ciphertext, wrapped_dek from secret_items');
    expect(JSON.stringify(stored.rows)).not.toContain(TOKEN);
    const list = await call('GET', `${ws()}/connectors`, owner);
    expect(JSON.stringify(list.body)).not.toContain(TOKEN);
  });

  it('仓库：挑进来默认仅查看；改成可修改后自动建项目并探测，可并入别的项目；人工覆盖不被重新探测冲掉，可还原', async () => {
    const attached = await call('POST', `${ws()}/repos/batch-attach`, owner, {
      connector_id: connectorId,
      remote_ids: ['11', '12'],
    });
    const items = attached.body.items as { id: string; path: string; access_mode: string }[];
    expect(items.map((r) => [r.path, r.access_mode])).toEqual([
      ['demo/demo-lib', 'read_only'],
      ['demo/demo-web', 'read_only'],
    ]);
    web = items.find((r) => r.path.endsWith('web'))!.id;
    lib = items.find((r) => r.path.endsWith('lib'))!.id;
    const rw = await call('PATCH', `${ws()}/repos/${web}`, owner, { access_mode: 'read_write' });
    expect(rw.body).toMatchObject({
      access_mode: 'read_write',
      probe: { state: 'done' },
      settings: {
        package_manager: 'pnpm',
        build_command: 'pnpm build',
        test_command: 'pnpm exec vitest run',
        typecheck_command: 'pnpm exec tsc -p . --noEmit',
        dist_dir: 'dist',
        verify_strategy: 'browser_dist_replace',
        asset_url_patterns: ['/assets/'],
      },
    });
    project = rw.body.project_id as string;
    // made writable on its own it gets its own project, then joins demo-web's
    const libOwn = await call('PATCH', `${ws()}/repos/${lib}`, owner, {
      access_mode: 'read_write',
    });
    expect(libOwn.body.project_id).not.toBe(project);
    const libRw = await call('PATCH', `${ws()}/repos/${lib}`, owner, { project_id: project });
    expect(libRw.body).toMatchObject({
      project_id: project,
      settings: { verify_strategy: 'test_suite', build_command: 'pnpm build' },
    });

    const over = await call('PATCH', `${ws()}/repos/${web}`, owner, {
      settings: { build_command: 'pnpm run build:ci' },
    });
    expect(over.body).toMatchObject({
      manual_overrides: ['build_command'],
      settings: { build_command: 'pnpm run build:ci' },
      detected: { build_command: 'pnpm build' },
    });
    const reprobed = await call('POST', `${ws()}/repos/${web}/probe`, owner);
    expect((reprobed.body.settings as Record<string, unknown>).build_command).toBe(
      'pnpm run build:ci',
    );
    const reset = await call('PATCH', `${ws()}/repos/${web}`, owner, {
      reset_overrides: ['build_command'],
    });
    expect(reset.body).toMatchObject({
      manual_overrides: [],
      settings: { build_command: 'pnpm build' },
    });
    expect(
      (await call('PATCH', `${ws()}/repos/${web}`, member, { access_mode: 'read_only' })).status,
    ).toBe(403);
  });

  it('试构建：按依赖顺序把项目的仓排进执行计划，只带凭据引用不带凭据', async () => {
    const r = await call('POST', `${ws()}/projects/${project}/trial-build`, owner);
    expect(r.status).toBe(202);
    flow = r.body.flow_id as string;
    const plan = (await su.query('select plan from flow_instances where id = $1', [flow])).rows[0]
      .plan;
    expect(plan.repos.map((x: { name: string }) => x.name)).toEqual(['demo-lib', 'demo-web']);
    expect(plan.repos.every((x: { credential_ref?: string }) => x.credential_ref)).toBe(true);
    expect(JSON.stringify(plan)).not.toContain(TOKEN);
  });

  it('信封：持有租约的执行器拿到只有自己私钥能开的凭据；不在本步的、租约丢了的都拿不到；每次下发都记账', async () => {
    const keys = crypto.generateKeyPairSync('x25519');
    const { token } = await withWorkspaceTx(
      db,
      { userId: A.userId, workspaceId: A.workspaceId },
      (tx, ctx) => issueEnrollToken(tx, ctx, { name: 'r1' }),
    );
    const secret = `cc_run_key_${crypto.randomBytes(16).toString('hex')}`;
    const reg = await call('POST', RUNNER_PATHS.registerRunner, undefined, {
      enroll_token: token,
      bot_exec_public_key: keys.publicKey
        .export({ type: 'spki', format: 'der' })
        .toString('base64'),
      secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
    });
    const auth = `Runner ${reg.body.runner_id}:${secret}`;
    const hb = (
      await call('POST', RUNNER_PATHS.heartbeatAndPoll, auth, { free_slots: 1, leases: [] })
    ).body as unknown as HeartbeatResponse;
    const step = hb.assigned.find((s) => s.flow_instance_id === flow) as StepAssignment;
    const ref = step.repos[1]!.credential_ref!;
    const req = {
      work_item_id: step.work_item_id,
      lease_token: step.lease_token,
      fence: step.fence,
      secret_id: ref,
    };

    const got = await call('POST', RUNNER_PATHS.fetchCredential, auth, req);
    expect(got.status).toBe(200);
    const pem = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    expect(openFromServer(pem, got.body as unknown as CredentialEnvelope)).toEqual({
      git_http_header: `Authorization: Bearer ${TOKEN}`,
    });
    // someone else's private key opens nothing
    const other = crypto
      .generateKeyPairSync('x25519')
      .privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    expect(() => openFromServer(other, got.body as unknown as CredentialEnvelope)).toThrow();
    expect(JSON.stringify(got.body)).not.toContain(TOKEN);

    const notInStep = await call('POST', RUNNER_PATHS.fetchCredential, auth, {
      ...req,
      secret_id: crypto.randomUUID(),
    });
    expect([notInStep.status, notInStep.body.code]).toEqual([403, 'runner.credential_not_in_step']);
    const wrongLease = await call('POST', RUNNER_PATHS.fetchCredential, auth, {
      ...req,
      lease_token: crypto.randomUUID(),
    });
    expect(wrongLease.status).toBe(409);
    const deliveries = await su.query('select runner_id from secret_deliveries');
    expect(deliveries.rows).toEqual([{ runner_id: reg.body.runner_id }]);
  });
  describe('环境账号与体检（P3b-3）', () => {
    const PASSWORD = 'env-pass-7c1e9a';
    let env = '';
    let account = '';
    let runner: Awaited<ReturnType<typeof enrollRunner>>;
    /** the env_login step of a flow, leased to the test executor */
    const stepOf = async (flowId: string) => {
      const hb = (
        await call('POST', RUNNER_PATHS.heartbeatAndPoll, runner.auth, {
          free_slots: 8,
          leases: [],
        })
      ).body as unknown as HeartbeatResponse;
      return hb.assigned.find((x) => x.flow_instance_id === flowId) as StepAssignment;
    };
    const secretOf = async (step: StepAssignment, ref: string) => {
      const got = await call('POST', RUNNER_PATHS.fetchCredential, runner.auth, {
        work_item_id: step.work_item_id,
        lease_token: step.lease_token,
        fence: step.fence,
        secret_id: ref,
      });
      expect(got.status).toBe(200);
      return openFromServer(runner.pem, got.body as unknown as CredentialEnvelope).secret;
    };
    const finish = (step: StepAssignment, output: Record<string, unknown>) =>
      call('POST', RUNNER_PATHS.completeRoundStep, runner.auth, {
        work_item_id: step.work_item_id,
        lease_token: step.lease_token,
        fence: step.fence,
        outcome: 'done',
        output,
      });

    it('登记账号：密码要账号名；保存后库里只有密文、接口不回任何密码；成员不能登记', async () => {
      runner = await enrollRunner('r-env');
      const e = await call('POST', `${ws()}/projects/${project}/environments`, owner, {
        env_code: 'test',
        name: '测试环境',
        env_tier: 'test_gate',
        entry_url: 'http://env.test/',
      });
      env = e.body.id as string;
      const url = `${ws()}/projects/${project}/environments/${env}/accounts`;
      const body = {
        role_name: '普通员工',
        credential_type: 'password',
        account_name: 'emp_test01',
        secret: PASSWORD,
        data_permission: 'read_write',
      };
      const noName = await call('POST', url, owner, { ...body, account_name: undefined });
      expect([noName.status, noName.body.code]).toEqual([400, 'env_account.name_required']);
      expect((await call('POST', url, member, body)).status).toBe(403);
      const ok = await call('POST', url, owner, body);
      expect(ok.status).toBe(201);
      account = (ok.body.account as { id: string }).id;
      expect(ok.body.account).toMatchObject({
        account_name: 'emp_test01',
        hint: '',
        login: { state: 'unchecked' },
      });
      expect(JSON.stringify(ok.body)).not.toContain(PASSWORD);
      const stored = await su.query(
        'select s.ciphertext, s.credential_class from secret_items s join env_accounts a on a.secret_id = s.id',
      );
      expect(stored.rows[0].credential_class).toBe('workspace_secret');
      expect(JSON.stringify(stored.rows)).not.toContain(PASSWORD);
      const plan = (
        await su.query('select plan from flow_instances where id = $1', [ok.body.flow_id])
      ).rows[0].plan;
      expect(JSON.stringify(plan)).not.toContain(PASSWORD);
      expect(
        JSON.stringify((await call('GET', `${ws()}/projects/${project}/env-accounts`, owner)).body),
      ).not.toContain(PASSWORD);

      // the Bot signs in: only the executor holding the step opens the password; the result lands on the account
      const step = await stepOf(ok.body.flow_id as string);
      const target = (step.config.targets as { credential_ref: string; account_id: string }[])[0]!;
      expect(target.account_id).toBe(account);
      expect(await secretOf(step, target.credential_ref)).toBe(PASSWORD);
      const done = await finish(step, {
        results: [
          {
            credential_ref: target.credential_ref,
            account_id: crypto.randomUUID(),
            state: 'ok',
            opened: true,
            identity: '张三 · 研发部',
            ms: 900,
          },
        ],
      });
      expect(done.status).toBe(200);
      const list = await call('GET', `${ws()}/projects/${project}/env-accounts`, owner);
      expect((list.body.items as unknown[])[0]).toMatchObject({
        id: account,
        login: { state: 'ok', identity: '张三 · 研发部' },
      });
    });

    it('Cookie 账号：不用填账号名，过期时间从 Cookie 里读；Bot 认出的人当账号名；读不出 Cookie 的不收', async () => {
      const url = `${ws()}/projects/${project}/environments/${env}/accounts`;
      const bad = await call('POST', url, owner, {
        role_name: '部门负责人',
        credential_type: 'cookie',
        secret: 'not a cookie',
        data_permission: 'read_only',
      });
      expect([bad.status, bad.body.code]).toEqual([400, 'env_account.cookie_unreadable']);
      const ok = await call('POST', url, owner, {
        role_name: '部门负责人',
        credential_type: 'cookie',
        secret: 'SESSION=6f2c9a81b; tita_uid=882041; Path=/; Expires=Sun, 27 Dec 2026 00:00:00 GMT',
        data_permission: 'read_only',
      });
      expect(ok.body.account).toMatchObject({
        account_name: null,
        login: { state: 'unchecked', expires_at: '2026-12-27T00:00:00.000Z' },
      });
      const step = await stepOf(ok.body.flow_id as string);
      const ref = (step.config.targets as { credential_ref: string }[])[0]!.credential_ref;
      expect(await secretOf(step, ref)).toContain('SESSION=6f2c9a81b');
      await finish(step, {
        results: [
          { credential_ref: ref, state: 'ok', opened: true, identity: '李娜 · 研发部', ms: 400 },
        ],
      });
      const row = (
        (await call('GET', `${ws()}/projects/${project}/env-accounts`, owner)).body.items as {
          id: string;
          account_name: string;
        }[]
      ).find((x) => x.id === (ok.body.account as { id: string }).id);
      expect(row?.account_name).toBe('李娜 · 研发部');
    });

    it('保存前试登录：不留账号，试完密文就销毁；换密码当场覆盖旧密文并重新试', async () => {
      const before = await su.query('select count(*)::int as n from env_accounts');
      const r = await call(
        'POST',
        `${ws()}/projects/${project}/environments/${env}/accounts/try`,
        owner,
        {
          role_name: '普通员工',
          credential_type: 'password',
          account_name: 'emp_test02',
          secret: 'try-only-pass-1',
          data_permission: 'read_only',
        },
      );
      expect(r.status).toBe(202);
      const step = await stepOf(r.body.flow_id as string);
      const ref = (step.config.targets as { credential_ref: string; account_id?: string }[])[0]!;
      expect(ref.account_id).toBeUndefined();
      expect(await secretOf(step, ref.credential_ref)).toBe('try-only-pass-1');
      await finish(step, {
        results: [
          {
            credential_ref: ref.credential_ref,
            state: 'failed',
            opened: true,
            error: 'the password was not accepted',
            ms: 700,
          },
        ],
      });
      const sec = await su.query(
        'select ciphertext, rotation_state from secret_items where id = $1',
        [ref.credential_ref],
      );
      expect(sec.rows[0]).toEqual({ ciphertext: null, rotation_state: 'revoked_purged' });
      expect((await su.query('select count(*)::int as n from env_accounts')).rows[0].n).toBe(
        before.rows[0].n,
      );

      const [{ secret_id: secretId, ciphertext: oldCipher }] = (
        await su.query(
          'select a.secret_id, s.ciphertext from env_accounts a join secret_items s on s.id = a.secret_id where a.id = $1',
          [account],
        )
      ).rows;
      const up = await call('PATCH', `${ws()}/projects/${project}/env-accounts/${account}`, owner, {
        secret: 'env-pass-rotated-2',
      });
      expect(up.body).toMatchObject({ account: { login: { state: 'unchecked' } } });
      expect(up.body.flow_id).toBeTruthy();
      const now = (await su.query('select ciphertext from secret_items where id = $1', [secretId]))
        .rows[0].ciphertext;
      expect(now).not.toBe(oldCipher);
    });

    it('体检：每个项目一次运行，先试登录全部账号再试构建；没探测的仓不排试构建', async () => {
      const r = await call('POST', `${ws()}/onboarding/health-check`, owner, {});
      expect(r.status).toBe(202);
      const body = r.body as unknown as HealthCheckResponse;
      expect(body.facts.environments).toEqual([
        expect.objectContaining({ id: env, name: '测试环境', accounts: 2 }),
      ]);
      expect(body.facts.repos).toMatchObject({ read_write: 2, read_only: 0 });
      const mine = body.flows.find((f) => f.project_id === project)!;
      const plan = (
        await su.query('select plan, kind from flow_instances where id = $1', [mine.flow_id])
      ).rows[0];
      expect(plan.kind).toBe('health_check');
      expect(plan.plan.nodes.map((n: { key: string }) => n.key)).toEqual([
        'env_login',
        'trial_build',
      ]);
      expect(plan.plan.nodes[0].config.targets).toHaveLength(2);
    });
  });
});
