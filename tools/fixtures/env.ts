// 把 demo-web 部署到模拟服务的测试环境（sim envsite，docs/06 §5.2 的「环境」）。
// 部署的是模拟 GitLab 主分支的样子（初始版本 + 全部植入，Bug 都在）；在宿主机临时目录里装依赖、构建。
// 浏览器复现在这个页面上把 demo-web 的资源换成 Bot 的构建。P6 起由发布流程部署。可重复执行。
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { loadConfig, type Config } from '@cloudcraft/config';
import { DEMO_REPOS, freshRepo, injectAll, loadBugs, withSim } from './lib.ts';

const run = promisify(execFile);
const sh = (cwd: string, cmd: string, args: string[]) =>
  run(cmd, args, { cwd, maxBuffer: 64 * 1024 * 1024 }).catch((e: { stdout?: string; stderr?: string }) => {
    throw new Error(`${cmd} ${args.join(' ')} 失败：\n${e.stdout ?? ''}${e.stderr ?? ''}`.slice(0, 4000));
  });

function filesOf(root: string, rel = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, filesOf(root, r));
    else out[r] = fs.readFileSync(path.join(root, r)).toString('base64');
  }
  return out;
}

export interface DemoEnv {
  url: string;
  deployed: 'now' | 'already';
}

/** 返回测试环境地址；没部署过（或 force）才构建部署 */
export async function deployDemoEnv(c: Config, opts: { force?: boolean } = {}): Promise<DemoEnv> {
  return withSim(c, async (base) => {
    const state = (await (await fetch(`${base}/__sim/envs`)).json()) as Record<
      'test' | 'prod',
      { url: string | null; deployed: boolean }
    >;
    if (!state.test.url) throw new Error('模拟服务没有起测试环境站点');
    if (state.test.deployed && state.prod.deployed && !opts.force)
      return { url: state.test.url, deployed: 'already' };

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-env-'));
    try {
      const bugs = loadBugs();
      for (const repo of DEMO_REPOS) {
        await freshRepo(repo, path.join(work, repo));
        await injectAll(repo, path.join(work, repo), bugs);
      }
      // 先库后应用：demo-web 通过 link:../demo-lib 引用
      for (const repo of DEMO_REPOS)
        await sh(path.join(work, repo), 'pnpm', [
          'install',
          '--ignore-workspace',
          '--frozen-lockfile',
          '--prefer-offline',
          '--silent',
        ]);
      const web = path.join(work, 'demo-web');
      await sh(web, 'pnpm', ['exec', 'vite', 'build', '--logLevel', 'error']);
      // 接口种子数据：和开发期模拟接口同一份（mock/data.ts，Node 直接去掉类型执行）
      const seed = await sh(web, process.execPath, [
        '--input-type=module',
        '-e',
        "import { seedApprovals } from './mock/data.ts'; process.stdout.write(JSON.stringify(seedApprovals()))",
      ]);
      // 测试和正式两个环境先放同一个基线版本；P6 的发布流程之后按模拟 Apollo 的发布覆盖
      for (const name of ['test', 'prod']) {
        const res = await fetch(`${base}/__sim/envs/${name}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ files: filesOf(path.join(web, 'dist')), api_seed: JSON.parse(seed.stdout) }),
        });
        if (!res.ok) throw new Error(`部署失败：${res.status} ${await res.text()}`);
      }
      return { url: state.test.url, deployed: 'now' };
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });
}

if (import.meta.main) {
  const env = await deployDemoEnv(loadConfig(), { force: process.argv.includes('--force') });
  console.log(`${env.deployed === 'now' ? '✓ 已部署' : '· 已部署过'}  demo-web 测试环境 ${env.url}`);
}
