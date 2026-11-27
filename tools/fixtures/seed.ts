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
      results.push({ repo: full, result: 'pushed' });
    }
    return results;
  });
}

if (import.meta.main) {
  const results = await seedDemoRepos(loadConfig());
  for (const r of results) console.log(`${r.result === 'pushed' ? '✓ 已推送' : '· 已存在'}  ${r.repo}`);
}
