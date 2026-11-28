// pnpm dev:executor <邮箱> —— 给本机正在跑的 cc-app 起一个执行器，登记在这个账号的第一个空间里。
// 页面上走开工向导时，第 4 步「体检并开工」的试构建要有在线执行器才会被领走；执行器只连 cc-app，
// 克隆凭据走信封（06 §2.10）。Ctrl+C 停止。
// 「设置 → 执行器」页面做出来之前，登记令牌由这个脚本直接签发（和 runner 演练同一个函数）。
// 修题引擎默认是 Pi（要先 pnpm llm-proxy）；设了 CC_AGENT_RUNTIME / CC_PATCH_ENGINE_FILE 就原样传给执行器，
// 比如用演练引擎打参考修复、不调模型（见 tools/runner/patch-engine.ts）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import { createDb, issueEnrollToken, withWorkspaceTx } from '@cloudcraft/server';
import pg from 'pg';
import { ROOT } from '../fixtures/lib.ts';

const email = process.argv[2];
if (!email) {
  console.error('用法：pnpm dev:executor <邮箱>');
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

const db = createDb(databaseUrls(c).app, { max: 1 });
const { token } = await withWorkspaceTx(db, { userId: row.user, workspaceId: row.ws }, (tx, ctx) =>
  issueEnrollToken(tx, ctx, { name: `dev:executor ${os.hostname()}` }),
);
await db.close();

const runnerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-runner-'));
console.log(`· 执行器登记在「${row.name}」，工作目录 ${runnerDir}`);
const p = spawn(process.execPath, ['--import', 'tsx', 'apps/bot-executor/src/main.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CC_RUNNER_SERVER: `http://127.0.0.1:${c.CC_APP_PORT}`,
    CC_DATA_DIR: c.CC_DATA_DIR,
    CC_RUNNER_DIR: runnerDir,
    CC_RUNNER_ENROLL_TOKEN: token,
    ...Object.fromEntries(
      ['CC_AGENT_RUNTIME', 'CC_PATCH_ENGINE_FILE', 'CC_LLM_PROXY_SOCKET']
        .filter((k) => process.env[k])
        .map((k) => [k, process.env[k]]),
    ),
  },
});
const stop = () => p.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
p.on('exit', (code) => {
  fs.rmSync(runnerDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
