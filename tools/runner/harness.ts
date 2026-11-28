// Shared by the executor drills (pnpm runner:try / fix / browser): cc-app and cc-sys in this
// process with short leases, the demo team dev:up seeded, and real executor processes that talk to
// cc-app only.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { databaseUrls, type Config } from '@cloudcraft/config';
import {
  buildApp,
  createDb,
  issueEnrollToken,
  pgOrchestrator,
  schema,
  startSysLoop,
  withWorkspaceTx,
  type Plan,
} from '@cloudcraft/server';
import type { RepoSpec } from '@cloudcraft/core-protocol';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { DEMO_NAMESPACE, ROOT, type DemoRepo } from '../fixtures/lib.ts';

export const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
export const fail = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

/** the demo team, as dev:up seeded it (ids looked up as the migrator, like an admin console) */
async function demoTeam(c: Config) {
  const m = new pg.Client({ connectionString: databaseUrls(c).migrator });
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

/**
 * A demo repo as the plan carries it. The commands and the browser settings are what P3's repo probe
 * and repo targets will fill in; demo-web is checked in a browser on the test environment too.
 */
export function demoRepoSpec(simBase: string, name: DemoRepo): RepoSpec {
  return {
    id: name,
    name,
    clone_url: `${simBase}/${DEMO_NAMESPACE}/${name}.git`,
    ref: 'main',
    build_command: 'pnpm build',
    test_command: 'pnpm exec vitest run',
    typecheck_command: 'pnpm exec tsc -p .',
    ...(name === 'demo-web'
      ? {
          verify_strategy: 'browser_dist_replace' as const,
          dist_dir: 'dist',
          asset_url_patterns: ['/assets/'],
        }
      : {}),
  };
}

type Out = Record<string, unknown>;
interface RunSummary {
  passed: boolean;
  failed_step: number | null;
  failed_on_assert: boolean;
  steps: { step: number; op: string; ok: boolean; error?: string; actual?: string | null }[];
  invariants: Record<string, boolean | number>;
  screenshots: { name: string; file: string }[];
  console_errors: string[];
  stale: string[];
  denied: string[];
  error?: string;
  ms: number;
}

/**
 * Prints the browser part of a replay verdict and copies the screenshots to `evidenceDir` (the round
 * workspace goes away with the drill). Returns that directory, or null when there was no browser run.
 */
export function printBrowserVerdict(out: Out, evidenceDir: string): string | null {
  const v = (out.verdict ?? {}) as Record<string, boolean>;
  const b = out.browser as
    { repo: string; env_url: string; base: RunSummary; head: RunSummary } | undefined;
  console.log('\n宿主机回放判定');
  const mark = (x: boolean | undefined) => (x ? '✓' : '✗');
  if ('repro_fails_before' in v)
    console.log(
      `  ${mark(v.repro_fails_before)} 复现测试修前失败  ${mark(v.repro_passes_after)} 修后通过`,
    );
  if ('browser_fails_before' in v) {
    console.log(`  ${mark(v.browser_fails_before)} 浏览器复现物修前停在断言上`);
    console.log(`  ${mark(v.browser_passes_after)} 浏览器复现物修后通过`);
    console.log(`  ${mark(v.replacement_invariants)} 产物替换四项不变量（修前、修后两次）`);
  }
  console.log(`  ${mark(v.typecheck)} 类型检查  ${mark(v.tests)} 改动仓全部测试`);
  if (!b) {
    if (out.logs) console.log(JSON.stringify(out.logs, null, 2));
    return null;
  }
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const [label, r] of [
    ['修前', b.base],
    ['修后', b.head],
  ] as const) {
    const i = r.invariants;
    console.log(
      `\n  浏览器（${label}构建换进 ${b.env_url}）${sec(r.ms)}：${r.passed ? '通过' : `第 ${r.failed_step} 步没过${r.failed_on_assert ? '（断言）' : ''}`}`,
    );
    for (const s of r.steps)
      console.log(
        `    ${s.ok ? '✓' : '✗'} ${String(s.step).padStart(2)} ${s.op}${s.actual !== undefined ? `  实际：${String(s.actual).replace(/\s+/g, ' ').slice(0, 80)}` : ''}${s.error ? `  ${s.error}` : ''}`,
      );
    console.log(
      `    入口换成本地构建 ${i.entry_js_replaced ? '是' : '否'} · 本地产物命中 ${i.dist_asset_hits} · 拦下线上旧代码 ${i.stale_prod_chunk_blocked} · 页面崩溃 ${i.page_crash ? '是' : '否'}`,
    );
    if (r.console_errors.length)
      console.log(`    页面报错：${r.console_errors.slice(0, 3).join(' | ')}`);
    if (r.denied.length)
      console.log(`    拒绝的请求（不在放行范围）：${r.denied.slice(0, 3).join(' ')}`);
    if (r.error) console.log(`    ${r.error}`);
    for (const s of r.screenshots)
      fs.copyFileSync(s.file, path.join(evidenceDir, path.basename(s.file)));
  }
  if (out.logs) console.log(JSON.stringify(out.logs, null, 2));
  return evidenceDir;
}

export async function waitFor<T>(what: string, fn: () => Promise<T | null | false>, ms: number) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`等待超时：${what}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

export async function startHarness(c: Config, o: { leaseSeconds: number }) {
  const team = await demoTeam(c);
  const db = createDb(databaseUrls(c).app, { max: 6 });
  const app = buildApp({ db, runner: { leaseSeconds: o.leaseSeconds, pollMs: 500 } });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  const server = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  const sys = startSysLoop(db, { reapIntervalMs: 1000, onError: (e) => console.error(e) });
  const asOwner = <T>(fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
    withWorkspaceTx(db, { userId: team.user, workspaceId: team.ws }, fn);
  const runnerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-runner-'));

  let executor: ChildProcess | null = null;
  const startExecutor = (env: Record<string, string | undefined>) => {
    const p = spawn(process.execPath, ['--import', 'tsx', 'apps/bot-executor/src/main.ts'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        CC_RUNNER_SERVER: server,
        CC_DATA_DIR: c.CC_DATA_DIR,
        CC_RUNNER_DIR: runnerDir,
        ...env,
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

  return {
    db,
    asOwner,
    startExecutor,
    killExecutor,
    enrollToken: async (name: string) =>
      (await asOwner((tx, ctx) => issueEnrollToken(tx, ctx, { name }))).token,
    startFlow: (plan: Plan) =>
      asOwner((tx, ctx) =>
        pgOrchestrator.startFlow(tx, ctx, { projectId: team.project, kind: 'round', plan }),
      ),
    runsOf: (flowId: string) =>
      asOwner((tx) =>
        tx
          .select()
          .from(schema.nodeRuns)
          .where(eq(schema.nodeRuns.flowInstanceId, flowId))
          .orderBy(schema.nodeRuns.createdAt),
      ),
    async close() {
      await killExecutor('SIGTERM');
      await sys.stop();
      await app.close();
      await db.close();
      // this drill's executor identity is thrown away, and with it its work root
      const cred = path.join(runnerDir, 'credentials.json');
      if (fs.existsSync(cred)) {
        const { runnerId } = JSON.parse(fs.readFileSync(cred, 'utf8')) as { runnerId: string };
        fs.rmSync(path.join(c.CC_DATA_DIR, 'sandboxes', `runner-${runnerId}`), {
          recursive: true,
          force: true,
        });
      }
      fs.rmSync(runnerDir, { recursive: true, force: true });
    },
  };
}
