// S2 编排对比的 DBOS 一侧（docs/07 S2，06 §15 第 9 项）：同样 3 个场景写成 DBOS 工作流。
// 一个子进程 = 一个部署的应用实例；run.ts 起停它们、杀进程、换代码版本。对比结论定了之后连同依赖一起删掉。
//
// 用法：node --import tsx tools/s2-dbos/proc.ts '<json ProcConfig>'
import { DBOS } from '@dbos-inc/dbos-sdk';
import { NodePostgresDataSource } from '@dbos-inc/node-pg-datasource';
import { targetApi } from './fake-target.ts';

export interface ProcConfig {
  sysUrl: string;
  appUrl: string;
  targetUrl: string;
  /** which source of the review workflow this deployment ships */
  code: 'v1' | 'v2' | 'v2-patched';
  /** pin DBOS application version instead of the source hash */
  pinVersion?: string;
  /** the deploy step reads the outside world back before calling it */
  readBackFirst?: boolean;
  start?: { workflow: 'review' | 'round' | 'deploy'; id: string; args: unknown[] };
}

const cfg = JSON.parse(process.argv[2]!) as ProcConfig;
const say = (m: string) => console.log(`[${cfg.code}] ${m}`);
const api = targetApi(cfg.targetUrl);
const DAYS_3 = 3 * 24 * 3600;

// --- steps ---------------------------------------------------------------------------------

const prepare = DBOS.registerStep(async (id: string) => say(`prepare ${id}`), { name: 'prepare' });
const fix = DBOS.registerStep(async (id: string, n: number) => say(`fix ${id}#${n}`), {
  name: 'fix',
});
const notify = DBOS.registerStep(async (id: string) => say(`notify ${id}`), { name: 'notify' });
const build = DBOS.registerStep(
  async (repo: string, attempt: number) => {
    say(`build ${repo}#${attempt}`);
    return repo === 'b' && attempt === 1 ? 'failed' : 'done';
  },
  { name: 'build' },
);
const deploy = DBOS.registerStep(
  async (key: string) => {
    if (cfg.readBackFirst) {
      const r = await api.readBack(key);
      if (r) {
        say(`deploy ${key}: already there, skipped`);
        return r;
      }
    }
    say(`deploy ${key}`);
    return api.deploy(key, 'pkg-1');
  },
  { name: 'deploy' },
);

// workflow-internal database work goes through a DBOS data source transaction; RLS context has to
// be entered as its first statement (06 §2.3)
const appDb = new NodePostgresDataSource('app', { connectionString: cfg.appUrl });
const countVisibleFlows = appDb.registerTransaction(
  async (userId: string, workspaceId: string) => {
    await NodePostgresDataSource.client.query('select app_enter($1, $2)', [userId, workspaceId]);
    const r = await NodePostgresDataSource.client.query<{ n: string }>(
      'select count(*) as n from flow_instances',
    );
    return Number(r.rows[0]!.n);
  },
  { name: 'countVisibleFlows' },
);

// --- ① wait for a person for days, across a redeploy -------------------------------------------

async function reviewV1(id: string) {
  await fix(id, 1);
  const m = await DBOS.recv<string>('review', DAYS_3);
  if (m !== 'approve') return 'timed out';
  await deploy(`deploy:${id}`);
  return 'deployed';
}
// v2 adds a notification step before the wait — an ordinary product change
async function reviewV2(id: string) {
  await fix(id, 1);
  await notify(id);
  const m = await DBOS.recv<string>('review', DAYS_3);
  if (m !== 'approve') return 'timed out';
  await deploy(`deploy:${id}`);
  return 'deployed';
}
// the same change written the way DBOS asks for it
async function reviewV2Patched(id: string) {
  await fix(id, 1);
  if (await DBOS.patch('notify-before-review')) await notify(id);
  const m = await DBOS.recv<string>('review', DAYS_3);
  if (m !== 'approve') return 'timed out';
  await deploy(`deploy:${id}`);
  return 'deployed';
}
const review = DBOS.registerWorkflow(
  { v1: reviewV1, v2: reviewV2, 'v2-patched': reviewV2Patched }[cfg.code],
  { name: 'review' },
);

// --- ② three repos fan out, one fails, back to a middle node -----------------------------------

const buildRepo = DBOS.registerWorkflow(
  async (repo: string, attempt: number) => build(repo, attempt),
  { name: 'buildRepo' },
);

type ReviewMsg = { action: 'approve' } | { action: 'rework'; to: 'fix' | 'build' };

/** The template's graph has to be interpreted inside the workflow so people can pick any node. */
async function roundWorkflow(id: string, repos: string[], userId: string, workspaceId: string) {
  const trail: string[] = [];
  const attempt = { fix: 0, build: 0, review: 0 };
  await prepare(id);
  trail.push(`visible flows: ${await countVisibleFlows(userId, workspaceId)}`);
  let at: 'fix' | 'build' | 'review' = 'fix';
  for (;;) {
    if (at === 'fix') {
      await fix(id, ++attempt.fix);
      trail.push(`fix#${attempt.fix}`);
      at = 'build';
    } else if (at === 'build') {
      const n = ++attempt.build;
      const handles = [];
      for (const r of repos) handles.push(await DBOS.startWorkflow(buildRepo)(r, n));
      const results = await Promise.all(handles.map((h) => h.getResult()));
      trail.push(...repos.map((r, i) => `build#${n}@${r}:${results[i]}`));
      if (results.every((x) => x === 'done')) at = 'review';
      else if (n < 2) at = 'fix';
      else return { status: 'failed', trail };
    } else {
      trail.push(`review#${++attempt.review}`);
      const m = await DBOS.recv<ReviewMsg>('review', DAYS_3);
      if (!m) return { status: 'timed out', trail };
      if (m.action === 'approve') return { status: 'done', trail };
      at = m.to;
    }
  }
}
const round = DBOS.registerWorkflow(roundWorkflow, { name: 'round' });

// --- ③ release killed halfway ------------------------------------------------------------------

const deployFlow = DBOS.registerWorkflow(
  async (id: string) => {
    await deploy(`deploy:${id}`);
    say(`verify ${id}`);
    return 'deployed';
  },
  { name: 'deployFlow' },
);

// --- process ---------------------------------------------------------------------------------

DBOS.setConfig({
  name: 's2',
  systemDatabaseUrl: cfg.sysUrl,
  runMigrations: false,
  logLevel: 'warn',
  ...(cfg.pinVersion ? { applicationVersion: cfg.pinVersion } : {}),
});
await DBOS.launch();
say(`up, application version ${DBOS.applicationVersion.slice(0, 12)}`);

if (cfg.start) {
  const { workflow, id, args } = cfg.start;
  const fn = { review, round, deploy: deployFlow }[workflow] as (
    ...a: unknown[]
  ) => Promise<unknown>;
  const h = await DBOS.startWorkflow(fn, { workflowID: id })(...args);
  say(`started ${id}`);
  void h.getResult().then(
    (r) => say(`finished ${id}: ${JSON.stringify(r)}`),
    (e: unknown) => say(`errored ${id}: ${(e as Error).message.split('\n')[0]}`),
  );
}
