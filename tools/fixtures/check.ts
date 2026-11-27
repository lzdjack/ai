// pnpm fixtures:check：题库自检（docs/07 §6.2）。
// 按模拟 GitLab 主分支的样子（初始版本 + 全部植入）搭一套临时仓，然后：
//   1. 植入后两仓的公开测试和类型检查仍然通过（Bug 是行为错误，不是编译错误）
//   2. 每道题：隐藏测试失败 → 打上参考修复 → 隐藏测试通过 → 还原
// 要装依赖（首次需要联网），不进 verify；加题、改 demo 仓时手动跑。
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { BUGS_DIR, DEMO_REPOS, freshRepo, git, injectAll, loadBugs } from './lib.ts';

const run = promisify(execFile);

async function sh(cwd: string, cmd: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  try {
    const r = await run(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, out: `${r.stdout}${r.stderr}` };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const bugs = loadBugs();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-bugs-'));
const dirOf = (repo: string) => path.join(work, repo);
let failed = false;
const fail = (msg: string, out = '') => {
  failed = true;
  console.error(`✗ ${msg}`);
  if (out) console.error(out.split('\n').slice(-25).join('\n'));
};

try {
  for (const repo of DEMO_REPOS) {
    await freshRepo(repo, dirOf(repo));
    await injectAll(repo, dirOf(repo), bugs);
  }
  // 先库后应用：demo-web 通过 link:../demo-lib 引用
  for (const repo of DEMO_REPOS) {
    const r = await sh(dirOf(repo), 'pnpm', ['install', '--ignore-workspace', '--frozen-lockfile', '--prefer-offline', '--silent']);
    if (!r.ok) throw new Error(`${repo} 装依赖失败：\n${r.out}`);
  }
  const failedBefore = failed;
  for (const repo of DEMO_REPOS) {
    const test = await sh(dirOf(repo), 'pnpm', ['exec', 'vitest', 'run']);
    if (!test.ok) fail(`${repo}：植入后公开测试应当仍然通过`, test.out);
    const tsc = await sh(dirOf(repo), 'pnpm', ['exec', 'tsc', '-p', '.']);
    if (!tsc.ok) fail(`${repo}：植入后类型检查应当仍然通过`, tsc.out);
  }
  if (failed === failedBefore) console.log('✓ 植入全部题目后，两仓公开测试与类型检查通过');

  for (const bug of bugs) {
    const runDir = dirOf(bug.runIn);
    const hidden = path.join('src', '__hidden__', `${bug.id}.test.ts`);
    fs.mkdirSync(path.join(runDir, 'src', '__hidden__'), { recursive: true });
    fs.copyFileSync(path.join(BUGS_DIR, bug.verify.unit), path.join(runDir, hidden));

    const before = await sh(runDir, 'pnpm', ['exec', 'vitest', 'run', hidden]);
    for (const [repo, patch] of bug.patches('fix')) await git(dirOf(repo), ['apply', patch]);
    const after = await sh(runDir, 'pnpm', ['exec', 'vitest', 'run', hidden]);

    if (before.ok) fail(`${bug.id}：植入后隐藏测试应当失败，实际通过了`);
    else if (!before.out.includes('AssertionError'))
      fail(`${bug.id}：植入后隐藏测试应当因断言失败，而不是报错`, before.out);
    else if (!after.ok) fail(`${bug.id}：打上参考修复后隐藏测试应当通过`, after.out);
    else console.log(`✓ ${bug.id} [${bug.level}] ${bug.title}`);

    for (const repo of bug.repos) {
      await git(dirOf(repo), ['checkout', '--', '.']);
      await git(dirOf(repo), ['clean', '-fdq']);
    }
    fs.rmSync(path.join(runDir, hidden), { force: true });
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log(`题库自检通过：${bugs.length} 道`);
