// Shared by the executor drills (pnpm runner:try, pnpm runner:fix): cc-app and cc-sys in this
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
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { ROOT } from '../fixtures/lib.ts';

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
