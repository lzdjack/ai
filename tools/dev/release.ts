// pnpm dev:release <邮箱> —— 给本机正在跑的 cc-app 配好发布，让页面上能把一张单发到正式环境（07 P6b）：
// 这个账号第一个空间里的 demo 项目（没有就接上模拟 GitLab、挑 demo-lib / demo-web）、测试和正式环境
// （模拟服务的两个环境站点）、发布连接器（模拟 Apollo + OSS）、demo-web 的发布设置（测试分支 test）。
// 个人账号不在这里配：第一次点发布 / 合入时页面会弹窗要，下面打印模拟服务里能用的账号。
// 「设置 → 项目」的发布设置页面做出来之前用这个脚本。可重复执行。
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import { accountSettings, signAccessToken } from '@cloudcraft/server';
import pg from 'pg';
import { deployDemoEnv } from '../fixtures/env.ts';
import { withSim } from '../fixtures/lib.ts';
import { DEMO_TEST_BRANCH, botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { setupDemoProject } from '../runner/demo-project.ts';

type Json = Record<string, unknown>;
const email = process.argv[2];
if (!email) {
  console.error('用法：pnpm dev:release <邮箱>');
  process.exit(1);
}
const c = loadConfig();

// the account and its first workspace, looked up as the migrator (like an admin console)
const m = new pg.Client({ connectionString: databaseUrls(c).migrator });
await m.connect();
const row = (
  await m.query<{ user: string; ws: string; name: string }>(
    `select u.id as user, w.id as ws, w.name
       from users u
       join workspace_members wm on wm.user_id = u.id
       join workspaces w on w.id = wm.workspace_id
      where u.email = $1
      order by wm.created_at limit 1`,
    [email.toLowerCase()],
  )
).rows[0];
await m.end();
if (!row) {
  console.error(`没有找到 ${email} 的空间`);
  process.exit(1);
}

const server = `http://127.0.0.1:${c.CC_APP_PORT}`;
const token = signAccessToken(accountSettings(c), row.user);
const call = async (method: string, p: string, body?: unknown): Promise<Json> => {
  const res = await fetch(`${server}${p}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    console.error(`连不上 cc-app（${server}），先 pnpm dev`);
    process.exit(1);
  });
  const json = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};

await seedDemoRepos(c);
const env = await deployDemoEnv(c);
await withSim(c, async (simBase) => {
  const ws = `/v1/workspaces/${row.ws}`;
  const sim = async (p: string) => (await fetch(`${simBase}${p}`)).json() as Promise<Json>;
  const envs = (await sim('/__sim/envs')) as Record<string, { url: string }>;
  const { project, webRepoId } = await setupDemoProject({
    call,
    ws,
    simBase,
    botToken: await botToken(simBase),
    testEnvUrl: env.url,
  });
  await call('POST', `${ws}/projects/${project}/environments`, {
    env_code: 'prod',
    name: '正式环境',
    env_tier: 'production',
    entry_url: envs.prod!.url,
  }).catch(() => null);
  const conns = (await call('GET', `${ws}/connectors`)).items as Json[];
  const oss = await sim('/__sim/oss');
  const rel =
    conns.find((x) => x.plugin_id === 'connector-tita-apollo') ??
    (await call('POST', `${ws}/connectors`, {
      plugin_id: 'connector-tita-apollo',
      name: '模拟 Apollo',
      config: { apollo_url: simBase, oss_url: simBase },
      credential: { oss_access_key: oss.access_key },
    }));
  await call('PUT', `${ws}/projects/${project}/release-config`, {
    repo_id: webRepoId,
    provider_connector_id: rel.id,
    target_ref: {
      app_id: 'demo-web',
      cluster: 'default',
      namespace: 'application',
      config_key: 'demo-web',
      oss_bucket: 'ux',
      oss_prefix: 'demo-web/release/',
      env_map: { test: 'TEST', prod: 'PRO' },
    },
    test_branch: DEMO_TEST_BRANCH,
  });
  const users = (await sim('/__sim/gitlab/users')) as unknown as {
    username: string;
    role: string;
    token: string;
  }[];
  console.log(`✓ 「${row.name}」的 demo 项目可以发布了：demo-web → 测试分支 ${DEMO_TEST_BRANCH}`);
  console.log(`  测试环境 ${envs.test!.url}  正式环境 ${envs.prod!.url}`);
  console.log('  第一次点发布 / 合入时页面会要你自己的账号，模拟服务里可以用：');
  console.log('    模拟 Apollo  用户名 qa-releaser  密码 sim-apollo-pass');
  for (const u of users.filter((x) => x.role === 'maintainer'))
    console.log(`    模拟 GitLab  ${u.username} 的个人访问令牌 ${u.token}`);
});
