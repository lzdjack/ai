// pnpm accounts:try —— P2 验收（docs/07 P2，06 §2.3、§3.7、§10.1）：
//   1. 本进程起接口服务（真实 SMTP 发到 mailpit）和后台任务（变更流中继）
//   2. 两个新账号各自用邮箱验证码注册（验证码从 mailpit 收件箱里读），各有一个空间，互相看不到
//   3. Alice 建团队空间、发邀请短口令；Carol 凭口令注册直接进团队；成员不能再邀请别人
//   4. Alice 的两台设备同时在线：Dave 加入时两台都收到待办通知，一台读掉，另一台的未读随即消失
// 每次运行用新的邮箱，可重复执行。需要 pnpm dev:up。
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import { accountSettings, buildApp, createDb, startSysLoop } from '@cloudcraft/server';

const c = loadConfig();
const run = crypto.randomBytes(3).toString('hex');
const mailpit = `http://127.0.0.1:${c.CC_MAILPIT_UI_PORT}`;
const db = createDb(databaseUrls(c).app, { max: 6 });
// several sign-ups from 127.0.0.1 in one go: a higher hourly budget than the default 10
const app = buildApp({
  db,
  runner: { leaseSeconds: 60, pollMs: 5000 },
  accounts: accountSettings(c, { rateLimitPerHour: 200 }),
});
await app.listen({ host: '127.0.0.1', port: 0 });
const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
const sys = startSysLoop(db, { reapIntervalMs: 60_000, streamIntervalMs: 100 });

type Json = Record<string, unknown>;
const ok: string[] = [];
const fail = (m: string): never => {
  throw new Error(m);
};
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
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json };
}

/** The newest mail to `to` in mailpit, waiting for it to arrive. */
async function mailTo(to: string) {
  for (let i = 0; i < 50; i++) {
    const s = (await (
      await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
    ).json()) as {
      messages: { ID: string; Subject: string }[];
    };
    if (s.messages.length) {
      const m = (await (await fetch(`${mailpit}/api/v1/message/${s.messages[0]!.ID}`)).json()) as {
        Text: string;
      };
      return { subject: s.messages[0]!.Subject, text: m.Text };
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return fail(`mailpit 里没有发给 ${to} 的邮件`);
}

async function signUp(name: string, invitation?: string) {
  const email = `${name.toLowerCase()}-${run}@demo.test`;
  if ((await call('POST', '/v1/auth/otp', { email, purpose: 'register' })).status !== 202)
    fail('发验证码失败');
  const mail = await mailTo(email);
  const code = /\b(\d{6})\b/.exec(mail.text)?.[1] ?? fail('邮件里没有验证码');
  const r = await call('POST', '/v1/auth/register', {
    email,
    code,
    password: 'demo-password-123',
    display_name: name,
    ...(invitation ? { invitation } : {}),
  });
  if (r.status !== 201) fail(`${name} 注册失败：${JSON.stringify(r.body)}`);
  console.log(`  ${name}：mailpit 收到「${mail.subject}」，验证码 ${code}，注册成功`);
  return {
    email,
    token: (r.body.tokens as Json).access_token as string,
    workspaceId: r.body.workspace_id as string,
  };
}

async function connect(token: string, workspaceId: string) {
  const tk = await call('POST', '/v1/ws-ticket', { workspace_id: workspaceId }, token);
  const got: Json[] = [];
  const ws = new WebSocket(`${base.replace('http', 'ws')}/v1/ws?ticket=${tk.body.ticket}`);
  ws.onmessage = (m) => got.push(JSON.parse(String(m.data)) as Json);
  await new Promise((r) => (ws.onopen = r));
  return {
    async waitFor(pred: (row: Json) => boolean) {
      for (let i = 0; i < 100; i++) {
        const e = got.find(
          (x) =>
            x.op === 'change' &&
            (x.data as Json).entity === 'notification' &&
            pred((x.data as Json).row as Json),
        );
        if (e) return e.data as Json;
        await new Promise((r) => setTimeout(r, 50));
      }
      return fail('等不到通知推送');
    },
    close: () => ws.close(),
  };
}

try {
  console.log('▶ 注册（验证码走 mailpit）');
  const alice = await signUp('Alice');
  const bob = await signUp('Bob');
  ok.push('✓ 邮箱验证码注册：验证码邮件在 mailpit 可见，注册后各得一个个人空间');

  console.log('\n▶ 两个空间互相隔离');
  const looks = [
    (await call('GET', `/v1/workspaces/${alice.workspaceId}`, undefined, bob.token)).status,
    (await call('GET', `/v1/workspaces/${alice.workspaceId}/notifications`, undefined, bob.token))
      .status,
    (await call('POST', '/v1/ws-ticket', { workspace_id: alice.workspaceId }, bob.token)).status,
    (await call('GET', `/v1/workspaces/${bob.workspaceId}/members`, undefined, alice.token)).status,
  ];
  console.log(`  Bob 读 Alice 的空间 / 通知 / 开推送、Alice 读 Bob 的成员：${looks.join(' / ')}`);
  if (looks.some((s) => s !== 404)) fail('隔离没生效');
  ok.push('✓ 两个账号在两个空间互相看不到数据（读接口、推送票据都当作不存在）');

  console.log('\n▶ 团队空间与邀请短口令');
  const team = await call(
    'POST',
    '/v1/workspaces',
    { name: `Alice 的团队 ${run}`, slug: `team-${run}` },
    alice.token,
  );
  const teamId = team.body.id as string;
  const inv = await call(
    'POST',
    `/v1/workspaces/${teamId}/invitations`,
    { role_key: 'member' },
    alice.token,
  );
  console.log(`  邀请短口令 ${inv.body.short_code}，链接 ${inv.body.link}`);
  const preview = await call(
    'GET',
    `/v1/invitations/preview?invitation=${encodeURIComponent(inv.body.short_code as string)}`,
  );
  console.log(
    `  预览：${preview.body.workspace_name}，拥有者 ${preview.body.owner_name}，角色 ${preview.body.role_key}`,
  );
  const carol = await signUp('Carol', inv.body.short_code as string);
  if (carol.workspaceId !== teamId) fail('Carol 没进团队');
  const byCarol = await call(
    'POST',
    `/v1/workspaces/${teamId}/invitations`,
    { role_key: 'member' },
    carol.token,
  );
  console.log(`  Carol（成员）想再邀请人：${byCarol.status} ${byCarol.body.message}`);
  if (byCarol.status !== 403) fail('成员不该能邀请');
  ok.push('✓ 邀请短口令：可预览、凭口令注册直接入团队；成员角色没有邀请权限，被拦下');

  console.log('\n▶ 两台设备实时同步');
  const pc = await connect(alice.token, teamId);
  const phone = await connect(alice.token, teamId);
  const inv2 = await call(
    'POST',
    `/v1/workspaces/${teamId}/invitations`,
    { role_key: 'member' },
    alice.token,
  );
  await signUp('Dave', inv2.body.token as string);
  const t0 = Date.now();
  const onPc = await pc.waitFor((r) => String(r.title).includes('Dave') && r.read_at === null);
  await phone.waitFor((r) => r.id === onPc.entity_id && r.read_at === null);
  console.log(`  两台设备都收到待办「${(onPc.row as Json).title}」（${Date.now() - t0}ms）`);
  const t1 = Date.now();
  await call(
    'POST',
    `/v1/workspaces/${teamId}/notifications/${onPc.entity_id}/read`,
    undefined,
    alice.token,
  );
  await phone.waitFor((r) => r.id === onPc.entity_id && r.read_at !== null);
  console.log(`  电脑上读掉后，手机上的未读 ${Date.now() - t1}ms 内消失`);
  pc.close();
  phone.close();
  ok.push('✓ 实时：一端读掉待办，另一端的未读随即消失（WebSocket 变更流）');
  console.log(`\n${ok.join('\n')}`);
} catch (e) {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exitCode = 1;
} finally {
  await sys.stop();
  await app.close();
  await db.close();
}
