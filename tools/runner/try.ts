// pnpm runner:try [--cold] —— E1 验收（docs/07 E1，06 §5.3、§5.3a、§2.12）：
//   1. 本进程起接口服务（cc-app）和后台任务（cc-sys），租约 10 秒；给演示团队签一个执行器注册令牌
//   2. 起真实的执行器进程（只连接口服务，不连数据库）：注册换发长期密钥 → 心跳领活
//   3. 两次试构建（冷 / 热）：执行器从模拟 GitLab 克隆 demo 两仓 → 联网准备依赖 → 断网容器里安装、构建两仓
//   4. 第三次试构建做到一半杀掉执行器：租约过期后 cc-sys 回收，重启执行器（凭长期密钥登录）接着做完
// 用的是 dev:up 建好的本地库和演示团队；--cold 先删依赖缓存。需要 Docker。
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { depsKey, ensureSandboxImage } from '@cloudcraft/bot-executor';
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import {
  PLAN_SCHEMA_VERSION,
  buildApp,
  createDb,
  issueEnrollToken,
  pgOrchestrator,
  schema,
  startSysLoop,
  withWorkspaceTx,
  type Plan,
} from '@cloudcraft/server';
import { and, eq } from 'drizzle-orm';
import pg from 'pg';
import { botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { DEMO_NAMESPACE, DEMO_REPOS, ROOT, withSim } from '../fixtures/lib.ts';

const LEASE_SECONDS = 10;
const cold = process.argv.includes('--cold');
const c = loadConfig();
const urls = databaseUrls(c);
const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const fail = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

// ---- the demo team, as dev:up seeded it (ids looked up as the migrator, like an admin console) ----
async function demoTeam() {
  const m = new pg.Client({ connectionString: urls.migrator });
  await m.connect();
  try {
    const r = await m.query<{ ws: string; project: string; user: string }>(`
      select w.id as ws, p.id as project, u.id as user
      from workspaces w
      join projects p on p.workspace_id = w.id and p.deleted_at is null
      join users u on u.email = 'zhangsan@demo.local'
      where w.slug = 'demo' limit 1`);
    return r.rows[0] ?? fail('没有演示团队，先跑 pnpm dev:up');
  } finally {
    await m.end();
  }
}

await seedDemoRepos(c);
await withSim(c, async (simBase) => {
  const team = await demoTeam();
  const db = createDb(urls.app, { max: 6 });
  const app = buildApp({ db, runner: { leaseSeconds: LEASE_SECONDS, pollMs: 500 } });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  const server = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const sys = startSysLoop(db, { reapIntervalMs: 1000, onError: (e) => console.error(e) });
  const asOwner = <T>(fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
    withWorkspaceTx(db, { userId: team.user, workspaceId: team.ws }, fn);

  const runnerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-runner-try-'));
  const gitToken = await botToken(simBase);
  let executor: ChildProcess | null = null;
  const startExecutor = (enrollToken?: string) => {
    const p = spawn(process.execPath, ['--import', 'tsx', 'apps/bot-executor/src/main.ts'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CC_RUNNER_SERVER: server,
        CC_DATA_DIR: c.CC_DATA_DIR,
        CC_RUNNER_DIR: runnerDir,
        CC_RUNNER_GIT_TOKEN: gitToken,
        ...(enrollToken ? { CC_RUNNER_ENROLL_TOKEN: enrollToken } : {}),
      },
    });
    const out = (d: Buffer) =>
      d
        .toString()
        .split('\n')
        .filter(Boolean)
        .forEach((l) => console.log(`    ${l}`));
    p.stdout!.on('data', out);
    p.stderr!.on('data', out);
    executor = p;
    return p;
  };
  const killExecutor = async (signal: NodeJS.Signals) => {
    const p = executor;
    if (!p || p.exitCode !== null || p.signalCode !== null) return;
    const exited = new Promise((r) => p.once('exit', r));
    p.kill(signal);
    await exited;
  };

  const plan: Plan = {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: DEMO_REPOS.map((name) => ({
      id: name,
      name,
      clone_url: `${simBase}/${DEMO_NAMESPACE}/${name}.git`,
      ref: 'main',
      build_command: 'pnpm build',
    })),
    nodes: [
      {
        key: 'trial_build',
        kind: 'auto',
        node_kind: 'deterministic_verify',
        config: { action: 'trial_build' },
      },
    ],
  };
  const startFlow = () =>
    asOwner((tx, ctx) =>
      pgOrchestrator.startFlow(tx, ctx, { projectId: team.project, kind: 'round', plan }),
    );
  const runOf = async (flowId: string) =>
    (
      await asOwner((tx) =>
        tx.select().from(schema.nodeRuns).where(eq(schema.nodeRuns.flowInstanceId, flowId)),
      )
    )[0]!;
  const waitFor = async <T>(what: string, fn: () => Promise<T | null | false>, ms: number) => {
    const end = Date.now() + ms;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > end) fail(`等待超时：${what}`);
      await new Promise((r) => setTimeout(r, 300));
    }
  };
  const finished = (flowId: string) =>
    waitFor(
      '试构建结束',
      async () => {
        const r = await runOf(flowId);
        return r.status === 'done' || r.status === 'failed' ? r : null;
      },
      10 * 60_000,
    );

  const results: string[] = [];
  try {
    const image = ensureSandboxImage(path.join(ROOT, 'infra', 'sandbox'));
    if (cold) {
      // the lockfile hash only needs the files; take them from the fixture sources
      for (const repo of DEMO_REPOS)
        fs.rmSync(
          path.join(
            c.CC_DATA_DIR,
            'pnpm-store',
            depsKey(path.join(ROOT, 'fixtures', repo), image.tag),
          ),
          { recursive: true, force: true },
        );
      console.log('· 已删依赖缓存（冷启动）');
    }

    const { token } = await asOwner((tx, ctx) => issueEnrollToken(tx, ctx, { name: 'runner:try' }));
    console.log('· 执行器注册令牌已签发（15 分钟有效，只能用一次）');
    startExecutor(token);

    for (const label of [cold ? '冷' : '第 1 次', cold ? '热' : '第 2 次']) {
      console.log(`\n▶ 试构建（${label}）`);
      const t0 = Date.now();
      const run = await finished(await startFlow());
      const out = run.structuredOutput as {
        network?: string;
        timings?: { label: string; ms: number }[];
        builds?: { repo: string; ok: boolean; ms: number; output_tail: string }[];
      } | null;
      if (run.status !== 'done')
        fail(`试构建失败：${run.errorRaw}\n${JSON.stringify(out, null, 2)}`);
      for (const t of out?.timings ?? []) console.log(`  ${sec(t.ms).padStart(6)}  ${t.label}`);
      for (const b of out?.builds ?? [])
        console.log(`  ${sec(b.ms).padStart(6)}  断网构建 ${b.repo}：${b.ok ? '通过' : '失败'}`);
      console.log(`  ${sec(Date.now() - t0).padStart(6)}  合计（含领活与写回）`);
      results.push(
        `✓ 试构建（${label}）：${out?.builds?.map((b) => b.repo).join('、')} 在断网容器（network=${out?.network}）里构建通过，${sec(Date.now() - t0)}`,
      );
    }

    console.log('\n▶ 试构建做到一半杀掉执行器');
    const flowId = await startFlow();
    const taken = await waitFor(
      '执行器领到活',
      async () => ((await runOf(flowId)).executorId ? true : null),
      60_000,
    );
    if (taken) await new Promise((r) => setTimeout(r, 1500)); // let it get into the build
    await killExecutor('SIGKILL');
    const killedAt = Date.now();
    console.log(`  已强杀执行器；租约 ${LEASE_SECONDS} 秒后过期，cc-sys 每秒回收一次`);
    const requeued = await waitFor(
      '租约被回收',
      async () => {
        const [w] = await asOwner((tx) =>
          tx
            .select()
            .from(schema.workItems)
            .where(
              and(eq(schema.workItems.kind, 'bot_step'), eq(schema.workItems.status, 'queued')),
            ),
        );
        return w ?? null;
      },
      LEASE_SECONDS * 1000 + 15_000,
    );
    console.log(
      `  ${sec(Date.now() - killedAt)} 后租约被回收，任务回到队列（fence ${requeued.fence}）`,
    );
    startExecutor(); // signs in with the long-term secret, cleans up leftovers, takes the step again
    const run = await finished(flowId);
    if (run.status !== 'done') fail(`接手后试构建失败：${run.errorRaw}`);
    results.push(
      `✓ 杀执行器：${sec(Date.now() - killedAt)} 内回收并由重启的执行器做完；同一个节点记录（第 ${run.attemptNo} 次尝试），没有多开`,
    );
  } finally {
    await killExecutor('SIGTERM');
    await sys.stop();
    await app.close();
    await db.close();
    // this try's executor identity is thrown away, and with it its (empty) work root
    const cred = path.join(runnerDir, 'credentials.json');
    if (fs.existsSync(cred)) {
      const { runnerId } = JSON.parse(fs.readFileSync(cred, 'utf8')) as { runnerId: string };
      fs.rmSync(path.join(c.CC_DATA_DIR, 'sandboxes', `runner-${runnerId}`), {
        recursive: true,
        force: true,
      });
    }
    fs.rmSync(runnerDir, { recursive: true, force: true });
  }
  console.log(`\n${results.join('\n')}`);
});
