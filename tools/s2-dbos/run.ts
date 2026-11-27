// pnpm s2:dbos —— S2 编排对比的 DBOS 一侧：在临时库里跑 3 个场景，每个子进程是一个应用实例，打印结果表。
// 自己实现的一侧是 apps/server/test/orchestration/orchestration.int.test.ts（在 verify 里）。
// 需要先 pnpm dev:up。结论见 docs/06 §3.6。
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { loadConfig } from '@cloudcraft/config';
import { DBOS, DBOSClient } from '@dbos-inc/dbos-sdk';
import { NodePostgresDataSource } from '@dbos-inc/node-pg-datasource';
import {
  PLAN_SCHEMA_VERSION,
  createDb,
  createWorkspace,
  insertRow,
  migrateDatabase,
  pgOrchestrator,
  schema,
  withWorkspaceTx,
} from '@cloudcraft/server';
import pg from 'pg';
import { startFakeTarget } from './fake-target.ts';
import type { ProcConfig } from './proc.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const c = loadConfig();
const url = (user: string, pw: string, db: string) =>
  `postgres://${user}:${encodeURIComponent(pw)}@${c.CC_PG_HOST}:${c.CC_PG_PORT}/${db}`;
const DB = `cc_s2_dbos_${crypto.randomBytes(4).toString('hex')}`;
const superUrl = url('postgres', c.CC_PG_SUPERUSER_PASSWORD, DB);
const migratorUrl = url('cc_migrator', c.CC_PG_MIGRATOR_PASSWORD, DB);
const appUrl = url('cc_app', c.CC_PG_APP_PASSWORD, DB);

const results: { scenario: string; check: string; got: string; ok: boolean }[] = [];
const check = (scenario: string, name: string, got: unknown, ok: boolean) => {
  results.push({ scenario, check: name, got: String(got), ok });
  console.log(`${ok ? '✓' : '✗'} ${scenario} · ${name}：${String(got)}`);
};

// ---------- database: same roles as the product (cc_migrator runs DDL, cc_app runs the app) ----------

async function createDatabase() {
  const admin = new pg.Client({
    connectionString: url('postgres', c.CC_PG_SUPERUSER_PASSWORD, 'postgres'),
  });
  await admin.connect();
  await admin.query(`create database ${DB} owner cc_migrator`);
  await admin.end();
  const s = new pg.Client({ connectionString: superUrl });
  await s.connect();
  await s.query(`create extension if not exists pg_bigm;
    alter schema public owner to cc_migrator;
    revoke all on schema public from public;
    grant usage on schema public to cc_app;`);
  await s.end();
  await migrateDatabase(migratorUrl);
  // DBOS system tables and the data source's transaction log, created by the migrator, used by cc_app
  await DBOS.migrate(migratorUrl, { schemaName: 'dbos', applicationRole: 'cc_app' });
  await NodePostgresDataSource.initializeDBOSSchema({ connectionString: migratorUrl }, 'dbos', {
    applicationRole: 'cc_app',
  });
}

async function dropDatabase() {
  const admin = new pg.Client({
    connectionString: url('postgres', c.CC_PG_SUPERUSER_PASSWORD, 'postgres'),
  });
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.end();
}

async function seedSpace(slug: string) {
  const db = createDb(appUrl, { max: 2 });
  const [user] = await db.orm
    .insert(schema.users)
    .values({ email: `${slug}@test.local`, displayName: slug })
    .returning();
  const { workspaceId, projectId } = await db.orm.transaction(async (tx) => {
    const ctx = await createWorkspace(tx, user!.id, { kind: 'organization', slug, name: slug });
    const p = await insertRow(tx, ctx, schema.projects, { name: slug, slug: 'main' });
    return { workspaceId: ctx.workspaceId, projectId: p.id };
  });
  await withWorkspaceTx(db, { userId: user!.id, workspaceId }, (tx, ctx) =>
    pgOrchestrator.startFlow(tx, ctx, {
      projectId,
      kind: 'round',
      plan: { plan_schema_version: PLAN_SCHEMA_VERSION, nodes: [{ key: 'review', kind: 'human' }] },
    }),
  );
  await db.close();
  return { userId: user!.id, workspaceId };
}

// ---------- processes ----------

interface Proc {
  proc: ChildProcess;
  out: () => string;
}
const procs: Proc[] = [];

function startProc(
  p: Omit<ProcConfig, 'sysUrl' | 'appUrl' | 'targetUrl'>,
  targetUrl: string,
): Proc {
  let out = '';
  const cfg: ProcConfig = { sysUrl: appUrl, appUrl, targetUrl, ...p };
  const proc = spawn(
    process.execPath,
    ['--import', 'tsx', 'tools/s2-dbos/proc.ts', JSON.stringify(cfg)],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  proc.stdout!.on('data', (d: Buffer) => (out += d.toString()));
  proc.stderr!.on('data', (d: Buffer) => (out += d.toString()));
  const r = { proc, out: () => out };
  procs.push(r);
  return r;
}

async function kill(p: Proc) {
  if (p.proc.exitCode !== null || p.proc.signalCode !== null) return;
  const exited = new Promise((r) => p.proc.once('exit', r));
  p.proc.kill('SIGKILL');
  await exited;
}

async function waitFor(what: string, fn: () => Promise<boolean> | boolean, ms = 20_000) {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- scenarios ----------

async function main() {
  await createDatabase();
  const A = await seedSpace('s2-a');
  await seedSpace('s2-b');
  const target = await startFakeTarget();
  const client = await DBOSClient.create({ systemDatabaseUrl: appUrl, applicationName: 's2' });
  const status = async (id: string) => (await client.getWorkflow(id))?.status ?? 'missing';
  const settled = async (id: string, ms: number) => {
    await waitFor(
      'outcome',
      async () => !['PENDING', 'ENQUEUED'].includes(await status(id)),
      ms,
    ).catch(() => {});
    const w = await client.getWorkflow(id);
    const err = w?.error ? String((w.error as Error).message ?? w.error).split('\n')[0] : '';
    return { status: w?.status ?? 'missing', err };
  };

  try {
    // ① a review waits; the app is redeployed with a changed workflow
    const S1 = '① 等人 3 天中途部署';
    for (const variant of [
      { name: '默认版本号（源码哈希），v2 加了一步', pin: undefined, next: 'v2' as const },
      { name: '固定版本号，v2 加了一步', pin: 'pinned', next: 'v2' as const },
      { name: '固定版本号，v2 用 DBOS.patch 写', pin: 'pinned', next: 'v2-patched' as const },
    ]) {
      const id = `review-${crypto.randomBytes(3).toString('hex')}`;
      const a = startProc(
        { code: 'v1', pinVersion: variant.pin, start: { workflow: 'review', id, args: [id] } },
        target.url,
      );
      await waitFor('v1 to wait', () => a.out().includes(`fix ${id}#1`));
      await sleep(300);
      await kill(a);
      const b = startProc({ code: variant.next, pinVersion: variant.pin }, target.url);
      await waitFor('v2 up', () => b.out().includes('up,'));
      await client.send(id, 'approve', 'review');
      const r = await settled(id, 15_000);
      const deployed = (target.calls.get(`deploy:${id}`) ?? 0) > 0;
      check(
        S1,
        variant.name,
        r.err
          ? `${r.status}：${r.err}`
          : deployed
            ? `${r.status}，新版本接着跑完`
            : `${r.status}，15 秒内没有进程接管`,
        r.status === 'SUCCESS' && deployed,
      );
      await kill(b);
    }

    // ② fan out to three repos, one fails, back to the fix node; then a person sends it back to build
    {
      const S2 = '② 3 仓扇出 1 个失败再打回';
      const id = `round-${crypto.randomBytes(3).toString('hex')}`;
      const p = startProc(
        {
          code: 'v1',
          start: { workflow: 'round', id, args: [id, ['a', 'b', 'c'], A.userId, A.workspaceId] },
        },
        target.url,
      );
      await waitFor('review', () => (p.out().match(/build c#2/g)?.length ?? 0) > 0);
      await sleep(500);
      await client.send(id, { action: 'rework', to: 'build' }, 'review');
      await waitFor('build #3', () => p.out().includes('build c#3'));
      await sleep(500);
      await client.send(id, { action: 'approve' }, 'review');
      const r = (await client
        .retrieveWorkflow<{ status: string; trail: string[] }>(id)
        .getResult())!;
      check(
        S2,
        '路径',
        r.trail.filter((x) => !x.startsWith('visible')).join(' → '),
        r.status === 'done' && r.trail.includes('build#3@c:done'),
      );
      check(
        S2,
        '工作流内事务按 RLS 只看到本空间的流程',
        r.trail[0],
        r.trail[0] === 'visible flows: 1',
      );
      await kill(p);
    }

    // ③ release killed while the outside change is in flight
    const S3 = '③ 发布中途杀进程';
    for (const variant of [
      { name: '步骤按默认写法', readBackFirst: false },
      { name: '步骤里先回读再发布', readBackFirst: true },
    ]) {
      const id = `deploy-${crypto.randomBytes(3).toString('hex')}`;
      const held = target.holdNext();
      const a = startProc(
        {
          code: 'v1',
          readBackFirst: variant.readBackFirst,
          start: { workflow: 'deploy', id, args: [id] },
        },
        target.url,
      );
      await held;
      await kill(a);
      const b = startProc({ code: 'v1', readBackFirst: variant.readBackFirst }, target.url);
      const r = await settled(id, 15_000);
      const calls = target.calls.get(`deploy:${id}`) ?? 0;
      const auto = r.status === 'SUCCESS';
      check(S3, `${variant.name}：外部发布调用次数`, calls, calls === 1);
      check(
        S3,
        `${variant.name}：重启后是否自动继续（方案要求停下等人点重试）`,
        auto ? '自动继续' : '停下',
        !auto,
      );
      await kill(b);
    }

    // isolation: what the runtime account can read in DBOS tables
    {
      const S = '隔离';
      const app = new pg.Client({ connectionString: appUrl });
      await app.connect();
      const r = await app.query<{ n: string }>('select count(*) as n from dbos.workflow_status');
      const rls = await app.query<{ n: string }>(
        `select count(*) as n from pg_tables where schemaname = 'dbos' and rowsecurity`,
      );
      check(S, '运行账号能直接读全部工作流记录（不分工作空间）', `${r.rows[0]!.n} 条`, false);
      check(S, 'DBOS 表开了 RLS 的数量', rls.rows[0]!.n, Number(rls.rows[0]!.n) > 0);
      await app.end();
    }
  } finally {
    await Promise.all(procs.map(kill));
    await client.destroy();
    await target.close();
    await dropDatabase();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\n${results.length - failed}/${results.length} 项符合方案要求（不符合的就是 DBOS 需要额外处理的地方）`,
  );
}

await main();
process.exit(0);
