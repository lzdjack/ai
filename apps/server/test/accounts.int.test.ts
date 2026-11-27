// Accounts, workspaces, invitations and the change stream (docs/06 §2.3, §2.9, §3.7, §10.1; 07 P2).
// One scenario per concern, over HTTP and real WebSockets against a fresh database.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { createDb, type Db } from '../src/db/client.ts';
import { findUnmatchedProbes } from '../src/db/write.ts';
import { startSysLoop, type SysLoop } from '../src/sys.ts';
import { createTestDb, type TestDb } from './db.ts';
import { testAccounts, testSources } from './fixtures.ts';

let t: TestDb;
let db: Db;
let sys: SysLoop;
let base: string;
let close: () => Promise<void>;
const { settings, mails } = testAccounts();

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 8 });
  const app = buildApp({
    db,
    runner: { leaseSeconds: 60, pollMs: 5000 },
    accounts: settings,
    sources: testSources(),
  });
  await app.listen({ host: '127.0.0.1', port: 0 });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  sys = startSysLoop(db, { reapIntervalMs: 60_000, streamIntervalMs: 30 });
  close = () => app.close();
});
afterAll(async () => {
  await sys?.stop();
  await close?.();
  await db?.close();
  await t?.drop();
});

type Json = Record<string, unknown>;
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as Json };
}

const codeFor = (email: string) => {
  const m = [...mails].reverse().find((x) => x.to === email);
  return /\b(\d{6})\b/.exec(m?.text ?? '')?.[1] ?? '';
};

async function signUp(email: string, name: string, invitation?: string) {
  expect((await call('POST', '/v1/auth/otp', { email, purpose: 'register' })).status).toBe(202);
  const r = await call('POST', '/v1/auth/register', {
    email,
    code: codeFor(email),
    password: 'correct horse battery',
    display_name: name,
    ...(invitation ? { invitation } : {}),
  });
  expect(r.status).toBe(201);
  return {
    token: (r.body.tokens as Json).access_token as string,
    refresh: (r.body.tokens as Json).refresh_token as string,
    userId: r.body.user_id as string,
    workspaceId: r.body.workspace_id as string,
  };
}

/** A client connection: collects envelopes, resolves waits on them. */
async function connect(token: string, workspaceId: string, since?: number) {
  const tk = await call('POST', '/v1/ws-ticket', { workspace_id: workspaceId }, token);
  expect(tk.status).toBe(200);
  const got: Json[] = [];
  const ws = new WebSocket(
    `${base.replace('http', 'ws')}/v1/ws?ticket=${tk.body.ticket}${since !== undefined ? `&since=${since}` : ''}`,
  );
  ws.onmessage = (m) => got.push(JSON.parse(String(m.data)) as Json);
  await new Promise((ok) => (ws.onopen = ok));
  const waitFor = async (pred: (e: Json) => boolean, ms = 4000) => {
    const end = Date.now() + ms;
    for (;;) {
      const hit = got.find(pred);
      if (hit) return hit;
      if (Date.now() > end) throw new Error(`no matching message; got ${JSON.stringify(got)}`);
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  return { got, waitFor, close: () => ws.close() };
}
const change =
  (entity: string, pred: (row: Json) => boolean = () => true) =>
  (e: Json) =>
    e.op === 'change' &&
    (e.data as Json).entity === entity &&
    pred(((e.data as Json).row ?? {}) as Json);

describe('账号与空间（P2）', () => {
  let A: Awaited<ReturnType<typeof signUp>>;
  let B: Awaited<ReturnType<typeof signUp>>;
  let org = '';

  it('邮箱验证码注册得到个人空间；建团队空间后拥有者五个动作都放行；验证码只存哈希', async () => {
    A = await signUp('a@test.local', 'Alice');
    expect(mails.at(-1)!.text).toMatch(/\d{6}/);
    const me = await call('GET', '/v1/me', undefined, A.token);
    expect(me.body.workspaces).toMatchObject([{ id: A.workspaceId, kind: 'personal' }]);
    const created = await call('POST', '/v1/workspaces', { name: 'Acme', slug: 'acme' }, A.token);
    expect(created.status).toBe(201);
    org = created.body.id as string;
    const detail = await call('GET', `/v1/workspaces/${org}`, undefined, A.token);
    expect(detail.body.actions).toMatchObject({
      invite_members: { allowed: true },
      manage_members: { allowed: true },
      manage_roles: { allowed: true },
      create_project: { allowed: true },
    });
    const raw = await db.pool.query('select token_hash from user_auth_tokens');
    expect(raw.rows.every((r: { token_hash: string }) => !/^\d{6}$/.test(r.token_hash))).toBe(true);
    // the same address cannot register twice
    expect(
      (await call('POST', '/v1/auth/otp', { email: 'A@test.local', purpose: 'register' })).status,
    ).toBe(202);
    expect(mails.at(-1)!.text).not.toMatch(/\d{6}/);
  });

  it('两个账号在两个空间互相看不到：读空间、成员、通知、开 WebSocket 一律当作不存在', async () => {
    B = await signUp('b@test.local', 'Bob');
    for (const path of [
      `/v1/workspaces/${org}`,
      `/v1/workspaces/${org}/members`,
      `/v1/workspaces/${org}/notifications`,
    ])
      expect((await call('GET', path, undefined, B.token)).status).toBe(404);
    expect((await call('POST', '/v1/ws-ticket', { workspace_id: org }, B.token)).status).toBe(404);
    expect((await call('GET', `/v1/workspaces/${B.workspaceId}`, undefined, A.token)).status).toBe(
      404,
    );
    expect((await call('GET', '/v1/me', undefined, 'cc1.forged.token')).status).toBe(401);
  });

  it('邀请：短口令可预览，绑定邮箱的只能本人领；不能预设拥有者或高于自己的角色；领取后管理者收到通知', async () => {
    const owner = await call(
      'POST',
      `/v1/workspaces/${org}/invitations`,
      { role_key: 'ws_owner' },
      A.token,
    );
    expect([owner.status, owner.body.code]).toEqual([403, 'invitation.role_too_high']);
    const inv = await call(
      'POST',
      `/v1/workspaces/${org}/invitations`,
      { role_key: 'member', email: 'c@test.local' },
      A.token,
    );
    expect(inv.status).toBe(201);
    expect(inv.body.short_code).toMatch(/^#CC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}#$/);
    const preview = await call(
      'GET',
      `/v1/invitations/preview?invitation=${encodeURIComponent(inv.body.short_code as string)}`,
    );
    expect(preview.body).toMatchObject({
      workspace_name: 'Acme',
      owner_name: 'Alice',
      inviter_name: 'Alice',
      role_key: 'member',
    });
    const wrong = await call(
      'POST',
      '/v1/invitations/accept',
      { invitation: inv.body.token },
      B.token,
    );
    expect([wrong.status, wrong.body.code]).toEqual([403, 'invitation.email_mismatch']);

    const C = await signUp('c@test.local', 'Carol', inv.body.link as string);
    expect(C.workspaceId).toBe(org);
    const members = await call('GET', `/v1/workspaces/${org}/members`, undefined, A.token);
    expect((members.body.items as Json[]).map((m) => [m.display_name, m.roles])).toEqual([
      ['Alice', ['ws_owner']],
      ['Carol', ['member']],
    ]);
    // used once
    expect((await call('GET', `/v1/invitations/preview?invitation=${inv.body.token}`)).status).toBe(
      404,
    );
    // a member cannot invite
    const byMember = await call(
      'POST',
      `/v1/workspaces/${org}/invitations`,
      { role_key: 'member' },
      C.token,
    );
    expect([byMember.status, byMember.body.code]).toEqual([403, 'auth.forbidden']);
    const notes = await call('GET', `/v1/workspaces/${org}/notifications`, undefined, A.token);
    expect((notes.body.items as Json[])[0]).toMatchObject({
      event_type: 'member_joined',
      title: expect.stringContaining('Carol'),
    });
    // Carol cannot read Alice's notifications
    expect(
      (
        (await call('GET', `/v1/workspaces/${org}/notifications`, undefined, C.token)).body
          .items as Json[]
      ).length,
    ).toBe(0);
    expect(await findUnmatchedProbes(db.orm as never)).toEqual([]);
  });

  it('实时：两台设备同时在线，一台读掉待办，另一台的未读随即消失；别人收不到这条通知，换空间的人什么都收不到', async () => {
    const pc = await connect(A.token, org);
    const phone = await connect(A.token, org);
    const bob = await connect(B.token, B.workspaceId);
    const inv = await call(
      'POST',
      `/v1/workspaces/${org}/invitations`,
      { role_key: 'external_collab' },
      A.token,
    );
    const D = await signUp('d@test.local', 'Dave', inv.body.short_code as string);
    const carolLogin = await call('POST', '/v1/auth/login', {
      email: 'c@test.local',
      password: 'correct horse battery',
    });
    const carol = await connect((carolLogin.body as Json).access_token as string, org);

    const joined = await phone.waitFor(
      change('notification', (r) => r.read_at === null && String(r.title).includes('Dave')),
    );
    await pc.waitFor(change('member', (r) => r.display_name === 'Dave'));
    const id = (joined.data as Json).entity_id as string;
    expect(
      (await call('POST', `/v1/workspaces/${org}/notifications/${id}/read`, undefined, A.token))
        .status,
    ).toBe(200);
    await phone.waitFor(change('notification', (r) => r.id === id && r.read_at !== null));

    // Dave's own connection would see the member row, never Alice's notification; Carol neither
    const daveConn = await connect(D.token, org, 0);
    await daveConn.waitFor(change('member', (r) => r.display_name === 'Dave'));
    expect(daveConn.got.some(change('notification'))).toBe(false);
    await new Promise((r) => setTimeout(r, 200));
    expect(carol.got.some(change('notification'))).toBe(false);
    expect(bob.got.filter((e) => e.op === 'change')).toEqual([]);
    for (const c of [pc, phone, bob, carol, daveConn]) c.close();
  });

  it('补齐：带上次序号重连补发之后的变更；票据只能用一次', async () => {
    const first = await connect(A.token, org, 0);
    const all = await first.waitFor(
      change('notification', (r) => String(r.title).includes('Dave')),
    );
    const seq = (all.data as Json).seq as number;
    first.close();
    const again = await connect(A.token, org, seq - 1);
    await again.waitFor((e) => e.op === 'change' && (e.data as Json).seq === seq);
    again.close();
    const tk = await call('POST', '/v1/ws-ticket', { workspace_id: org }, A.token);
    const url = `${base.replace('http', 'ws')}/v1/ws?ticket=${tk.body.ticket}`;
    const ok = new WebSocket(url);
    await new Promise((r) => (ok.onopen = r));
    const reused = new WebSocket(url);
    const code = await new Promise<number>((r) => (reused.onclose = (e) => r(e.code)));
    expect(code).toBe(4001);
    ok.close();
  });

  it('防爆破：同一个验证码错 5 次后，正确的也不收；刷新令牌只能用一次，旧的重放会让该账号其他会话失效', async () => {
    await call('POST', '/v1/auth/otp', { email: 'e@test.local', purpose: 'register' });
    const code = codeFor('e@test.local');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      expect(
        (
          await call('POST', '/v1/auth/register', {
            email: 'e@test.local',
            code: wrong,
            password: 'xxxxxxxx',
            display_name: 'E',
          })
        ).status,
      ).toBe(400);
    const late = await call('POST', '/v1/auth/register', {
      email: 'e@test.local',
      code,
      password: 'xxxxxxxx',
      display_name: 'E',
    });
    expect([late.status, late.body.code]).toEqual([400, 'auth.code_invalid']);

    const r1 = await call('POST', '/v1/auth/refresh', { refresh_token: B.refresh });
    expect(r1.status).toBe(200);
    expect((await call('POST', '/v1/auth/refresh', { refresh_token: B.refresh })).status).toBe(401);
    expect(
      (await call('POST', '/v1/auth/refresh', { refresh_token: r1.body.refresh_token })).status,
    ).toBe(401);
    expect(
      (await call('POST', '/v1/auth/login', { email: 'b@test.local', password: 'wrong' })).body
        .code,
    ).toBe('auth.login_failed');
  });

  it('限流：同一邮箱一小时内超过上限就 429，并带 Retry-After', async () => {
    const tight = testAccounts({ rateLimitPerHour: 2 });
    const app = buildApp({
      db,
      runner: { leaseSeconds: 60, pollMs: 5000 },
      accounts: tight.settings,
      sources: testSources(),
    });
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/otp',
        remoteAddress: '10.9.9.9',
        payload: { email: 'f@test.local', purpose: 'register' },
      });
    expect((await send()).statusCode).toBe(202);
    expect((await send()).statusCode).toBe(202);
    const third = await send();
    expect([third.statusCode, third.json().code, third.headers['retry-after']]).toEqual([
      429,
      'auth.rate_limited',
      '3600',
    ]);
    await app.close();
  });
});
