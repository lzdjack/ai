// demo 仓与 Bug 题库（docs/07 §6）的公共部分：读题库、跑 git、拿到一个可用的模拟服务。
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Config } from '@cloudcraft/config';
import { BrowserRepro, browserReproErrors } from '@cloudcraft/core-protocol';
import { buildSim } from '@cloudcraft/sim';
import { Type, type Static } from 'typebox';
import Value from 'typebox/value';
import { parse } from 'yaml';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const FIXTURES = path.join(ROOT, 'fixtures');
export const BUGS_DIR = path.join(FIXTURES, 'bugs');
/** 按依赖顺序排列：先库后应用 */
export const DEMO_REPOS = ['demo-lib', 'demo-web'] as const;
export type DemoRepo = (typeof DEMO_REPOS)[number];
export const DEMO_NAMESPACE = 'demo';

const RepoName = Type.Union(DEMO_REPOS.map((r) => Type.Literal(r)));
const PerRepo = Type.Union([Type.String(), Type.Record(Type.String(), Type.String())]);
const BugSchema = Type.Object({
  id: Type.String({ pattern: '^B\\d{3}$' }),
  title: Type.String({ minLength: 1 }),
  repo: Type.Union([RepoName, Type.Array(RepoName, { minItems: 2 })]),
  level: Type.Union([Type.Literal('L0'), Type.Literal('L1'), Type.Literal('L2')]),
  report: Type.String({ minLength: 1 }),
  repro: Type.Array(Type.String()),
  inject: PerRepo,
  /** 植入提交的提交信息：要像正常开发提交，不能透露这是 Bug */
  inject_message: Type.String({ minLength: 1 }),
  fix: PerRepo,
  verify: Type.Object({
    unit: Type.String(),
    /** 参考浏览器复现物（JSON，BrowserRepro），Bot 看不到 */
    browser: Type.Optional(Type.String()),
    /** 改两个仓时，隐藏测试放在哪个仓里跑 */
    run_in: Type.Optional(RepoName),
  }),
  expect_files: Type.Array(Type.String()),
});

/** 题目的参考浏览器复现物（没有时 null） */
export function browserReproOf(bug: Bug): BrowserRepro | null {
  return bug.verify.browser
    ? (JSON.parse(fs.readFileSync(path.join(BUGS_DIR, bug.verify.browser), 'utf8')) as BrowserRepro)
    : null;
}

export interface Bug extends Static<typeof BugSchema> {
  repos: DemoRepo[];
  runIn: DemoRepo;
  patches: (kind: 'inject' | 'fix') => Map<DemoRepo, string>;
}

/** 读全部题目并校验；有问题一次列出全部后抛错 */
export function loadBugs(): Bug[] {
  const problems: string[] = [];
  const bugs: Bug[] = [];
  for (const file of fs.readdirSync(BUGS_DIR).filter((f) => f.endsWith('.yaml')).sort()) {
    const raw: unknown = parse(fs.readFileSync(path.join(BUGS_DIR, file), 'utf8'));
    if (!Value.Check(BugSchema, raw)) {
      for (const e of Value.Errors(BugSchema, raw)) problems.push(`${file} ${e.instancePath} ${e.message}`);
      continue;
    }
    const repos: DemoRepo[] = Array.isArray(raw.repo) ? raw.repo : [raw.repo];
    const runIn = raw.verify.run_in ?? repos[0]!;
    const patches = (kind: 'inject' | 'fix') => {
      const v = raw[kind];
      const entries: [DemoRepo, string][] =
        typeof v === 'string'
          ? [[repos[0]!, v]]
          : repos.map((r) => [r, v[r] ?? ''] as [DemoRepo, string]);
      return new Map(entries.map(([r, f]) => [r, path.join(BUGS_DIR, f)]));
    };
    const bug: Bug = { ...raw, repos, runIn, patches };
    if (`${raw.id}.yaml` !== file) problems.push(`${file}：id 应为 ${file.replace('.yaml', '')}`);
    if (typeof raw.inject === 'string' && repos.length > 1)
      problems.push(`${file}：改多个仓时 inject / fix 要按仓分别给补丁`);
    if (!repos.includes(runIn)) problems.push(`${file}：verify.run_in 不在 repo 里`);
    for (const f of [...patches('inject').values(), ...patches('fix').values(), path.join(BUGS_DIR, raw.verify.unit)])
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) problems.push(`${file}：缺文件 ${path.relative(BUGS_DIR, f)}`);
    if (raw.verify.browser) {
      const b: unknown = JSON.parse(fs.readFileSync(path.join(BUGS_DIR, raw.verify.browser), 'utf8'));
      if (!Value.Check(BrowserRepro, b)) problems.push(`${file}：verify.browser 不是合法的浏览器复现物`);
      else problems.push(...browserReproErrors(b).map((e) => `${file}：verify.browser ${e}`));
    }
    bugs.push(bug);
  }
  if (problems.length) throw new Error(`题库有问题：\n  ${problems.join('\n  ')}`);
  return bugs;
}

const run = promisify(execFile);

/** 跑 git：隔离本机 git 配置和凭据助手；令牌走请求头，不写进地址（也就不会进钥匙串） */
export async function git(
  cwd: string,
  args: string[],
  opts: { token?: string; allowFail?: boolean } = {},
): Promise<{ ok: boolean; out: string }> {
  const auth = opts.token
    ? ['-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x:${opts.token}`).toString('base64')}`]
    : [];
  try {
    const r = await run(
      'git',
      ['-c', 'user.name=demo 维护者', '-c', 'user.email=maintainer@demo.local', '-c', 'credential.helper=', ...auth, ...args],
      {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_TERMINAL_PROMPT: '0',
        },
      },
    );
    return { ok: true, out: `${r.stdout}${r.stderr}` };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    if (opts.allowFail) return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? err.message}` };
    throw new Error(`git ${args[0]} 失败（${cwd}）：${err.stderr ?? err.message}`, { cause: e });
  }
}

/** 把 fixtures/<仓> 复制成一个新的 git 仓（不带 node_modules / dist），提交一次初始版本 */
export async function freshRepo(repo: DemoRepo, dest: string): Promise<void> {
  fs.cpSync(path.join(FIXTURES, repo), dest, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|dist)([\\/]|$)/.test(path.relative(FIXTURES, src)),
  });
  await git(dest, ['init', '-q', '-b', 'main']);
  await git(dest, ['add', '-A']);
  await git(dest, ['commit', '-qm', `初始化 ${repo}`]);
}

/** 依次打上各题的植入补丁，每题一个提交（和推进模拟 GitLab 的主分支一致） */
export async function injectAll(repo: DemoRepo, dir: string, bugs: Bug[]): Promise<void> {
  for (const bug of bugs) {
    const patch = bug.patches('inject').get(repo);
    if (!patch) continue;
    await git(dir, ['apply', patch]);
    await git(dir, ['add', '-A']);
    await git(dir, ['commit', '-qm', bug.inject_message]);
  }
}

/**
 * 拿到一个可用的模拟服务地址：pnpm dev 已经起了就用它；
 * 否则在本进程临时起一个（同一份数据目录），用完关掉。
 */
export async function withSim<T>(c: Config, fn: (base: string) => Promise<T>): Promise<T> {
  const running = `http://127.0.0.1:${c.CC_SIM_PORT}`;
  const alive = await fetch(`${running}/__sim/faults`, { signal: AbortSignal.timeout(1000) })
    .then((r) => r.ok)
    .catch(() => false);
  if (alive) return fn(running);
  const app = await buildSim({ dataDir: c.CC_DATA_DIR });
  await app.listen({ host: '127.0.0.1', port: 0 });
  await app.envSites.listen('test', 0);
  const addr = app.server.address();
  try {
    return await fn(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
  } finally {
    await app.close();
  }
}
