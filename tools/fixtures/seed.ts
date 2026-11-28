// pnpm fixtures:seed：把 demo 两仓推进模拟 GitLab（docs/07 §6.1）。dev:up 最后也会调用。可重复执行。
// 主分支 = 初始版本 + 每道题一个植入提交；补丁、隐藏测试和参考修复不推进去。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, type Config } from '@cloudcraft/config';
import { DEMO_NAMESPACE, DEMO_REPOS, freshRepo, git, injectAll, loadBugs, withSim } from './lib.ts';

interface SimUser {
  username: string;
  role: string;
  token: string;
}

/** 返回每个仓的处理结果：pushed 新推送 / exists 已存在跳过 */
export async function seedDemoRepos(c: Config): Promise<Array<{ repo: string; result: 'pushed' | 'exists' }>> {
  const bugs = loadBugs();
  return withSim(c, async (base) => {
    const users = (await (await fetch(`${base}/__sim/gitlab/users`)).json()) as SimUser[];
    const maintainer = users.find((u) => u.role === 'maintainer');
    if (!maintainer) throw new Error('模拟 GitLab 里没有维护者账号');
    const results: Array<{ repo: string; result: 'pushed' | 'exists' }> = [];
    for (const repo of DEMO_REPOS) {
      const full = `${DEMO_NAMESPACE}/${repo}`;
      const headers = { 'PRIVATE-TOKEN': maintainer.token };
      const api = `${base}/api/v4/projects/${encodeURIComponent(full)}`;
      const existing = await fetch(api, { headers });
      // 项目在、主分支也在才算已完成；上次建了项目但推送失败的，这次补推
      if (existing.ok && (await fetch(`${api}/repository/branches/main`, { headers })).ok) {
        await ensureTestBranch(api, headers);
        results.push({ repo: full, result: 'exists' });
        continue;
      }
      if (!existing.ok) {
        const created = await fetch(`${base}/__sim/gitlab/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path_with_namespace: full, default_branch: 'main' }),
        });
        if (!created.ok) throw new Error(`建项目 ${full} 失败：${created.status} ${await created.text()}`);
      }

      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cc-seed-${repo}-`));
      try {
        await freshRepo(repo, dir);
        await injectAll(repo, dir, bugs);
        await git(dir, ['push', '-q', `${base}/${full}.git`, 'main'], { token: maintainer.token });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      await ensureTestBranch(api, headers);
      results.push({ repo: full, result: 'pushed' });
    }
    return results;
  });
}

/** demo 仓的测试分支（P6 合入测试分支、发测试用）：从主分支切出，受保护 */
export const DEMO_TEST_BRANCH = 'test';

async function ensureTestBranch(api: string, headers: Record<string, string>) {
  if ((await fetch(`${api}/repository/branches/${DEMO_TEST_BRANCH}`, { headers })).ok) return;
  const json = { ...headers, 'Content-Type': 'application/json' };
  const made = await fetch(`${api}/repository/branches`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ branch: DEMO_TEST_BRANCH, ref: 'main' }),
  });
  if (!made.ok) throw new Error(`建测试分支失败：${made.status} ${await made.text()}`);
  const prot = await fetch(`${api}/protected_branches`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name: DEMO_TEST_BRANCH }),
  });
  if (!prot.ok && prot.status !== 409) throw new Error(`保护测试分支失败：${prot.status}`);
}

/** 模拟 GitLab 里的 Bot 令牌（只在宿主机用：克隆、推送 fix/ 分支） */
export async function botToken(base: string): Promise<string> {
  const users = (await (await fetch(`${base}/__sim/gitlab/users`)).json()) as SimUser[];
  const token = users.find((u) => u.username === 'cc-bot')?.token;
  if (!token) throw new Error('模拟 GitLab 里没有 cc-bot 账号');
  return token;
}

/**
 * 推好 demo 两仓后，以 Bot 身份克隆到 workDir（和真实执行器一样在宿主机做）。
 * 令牌走请求头，不写进 .git/config；克隆后逐仓核对。返回 Bot 令牌。
 */
export async function cloneDemoAsBot(c: Config, workDir: string): Promise<string> {
  await seedDemoRepos(c);
  const token = await withSim(c, async (base) => {
    const t = await botToken(base);
    fs.mkdirSync(workDir, { recursive: true });
    for (const repo of DEMO_REPOS)
      await git(workDir, ['clone', '-q', `${base}/${DEMO_NAMESPACE}/${repo}.git`, repo], { token: t });
    return t;
  });
  for (const repo of DEMO_REPOS)
    if (fs.readFileSync(path.join(workDir, repo, '.git', 'config'), 'utf8').includes(token))
      throw new Error(`${repo}/.git/config 里有令牌`);
  return token;
}

if (import.meta.main) {
  const results = await seedDemoRepos(loadConfig());
  for (const r of results) console.log(`${r.result === 'pushed' ? '✓ 已推送' : '· 已存在'}  ${r.repo}`);
}
