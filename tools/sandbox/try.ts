// pnpm sandbox:try [--cold] [--keep]：沙箱演练（E0-5 验收，docs/06 §5.3）。
//   1. 宿主机用 Bot 令牌从模拟 GitLab 克隆 demo 两仓（令牌只在宿主机，不进容器）
//   2. 阶段 1 联网准备依赖缓存（按 lockfile 哈希，已有就跳过；--cold 先删掉重来）
//   3. 阶段 2 在 --network=none 容器里离线安装、构建 demo-web
//   4. 隔离自检：断网、非 root、根文件系统只读、容器里没有令牌和密钥
// 输出各步耗时；--keep 保留本轮工作目录便于查看。
import fs from 'node:fs';
import path from 'node:path';
import {
  cloneDepsForRound,
  depsKey,
  ensureSandboxImage,
  offlineInstallScript,
  prepareDeps,
  runContainer,
  type Mount,
  type PreparedDeps,
  type RunResult,
} from '@cloudcraft/bot-executor';
import { loadConfig } from '@cloudcraft/config';
import { seedDemoRepos } from '../fixtures/seed.ts';
import { DEMO_NAMESPACE, DEMO_REPOS, ROOT, git, withSim } from '../fixtures/lib.ts';

const cold = process.argv.includes('--cold');
const keep = process.argv.includes('--keep');
const c = loadConfig();
const cacheRoot = path.join(c.CC_DATA_DIR, 'pnpm-store');
const roundDir = path.join(c.CC_DATA_DIR, 'sandboxes', `try-${Date.now()}`);
const workDir = path.join(roundDir, 'work');
const timings: Array<[string, number]> = [];
const sec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function must(label: string, r: RunResult): void {
  if (r.ok) return;
  console.error(`✗ ${label}${r.timedOut ? '（超时）' : ''}`);
  console.error(r.output.split('\n').slice(-30).join('\n'));
  process.exit(1);
}

const image = ensureSandboxImage(path.join(ROOT, 'infra', 'sandbox'));
if (image.built) timings.push(['构建沙箱镜像（只在 Dockerfile 变了时）', image.ms]);
console.log(`· 沙箱镜像 ${image.tag}${image.built ? '（新构建）' : ''}`);

// 1. 克隆：和真实执行器一样在宿主机做，令牌走请求头，不写进 .git/config
let botToken = '';
const cloneStart = Date.now();
await seedDemoRepos(c);
await withSim(c, async (base) => {
  const users = (await (await fetch(`${base}/__sim/gitlab/users`)).json()) as Array<{
    username: string;
    token: string;
  }>;
  botToken = users.find((u) => u.username === 'cc-bot')?.token ?? '';
  fs.mkdirSync(workDir, { recursive: true });
  for (const repo of DEMO_REPOS)
    await git(workDir, ['clone', '-q', `${base}/${DEMO_NAMESPACE}/${repo}.git`, repo], {
      token: botToken,
    });
});
timings.push(['宿主机克隆两仓', Date.now() - cloneStart]);
for (const repo of DEMO_REPOS) {
  if (fs.readFileSync(path.join(workDir, repo, '.git', 'config'), 'utf8').includes(botToken)) {
    console.error(`✗ ${repo}/.git/config 里有令牌`);
    process.exit(1);
  }
}

// 2. 阶段 1：联网准备依赖缓存
if (cold)
  for (const repo of DEMO_REPOS)
    fs.rmSync(path.join(cacheRoot, depsKey(path.join(workDir, repo), image.tag)), {
      recursive: true,
      force: true,
    });
const prepared: Array<[string, PreparedDeps]> = [];
for (const repo of DEMO_REPOS) {
  const p = await prepareDeps({ image: image.tag, repoDir: path.join(workDir, repo), cacheRoot });
  if (p.result) must(`${repo} 准备依赖`, p.result);
  timings.push([
    `阶段 1 准备依赖 ${repo}${p.cached ? '（命中缓存，跳过）' : '（联网）'}`,
    p.result?.ms ?? 0,
  ]);
  prepared.push([repo, p]);
}

// 3. 阶段 2：断网容器。依赖缓存每轮克隆一份，共享缓存本身不进容器
const cloneDepsStart = Date.now();
const mounts: Mount[] = [
  { host: workDir, container: '/work' },
  ...prepared.map(([, p]) => cloneDepsForRound(p, roundDir)),
];
timings.push(['本轮克隆依赖缓存（写时复制）', Date.now() - cloneDepsStart]);
const offline = (script: string) =>
  runContainer({ image: image.tag, network: 'none', mounts, script });

const install = await offline(
  ['set -e', ...prepared.map(([repo, p]) => offlineInstallScript(`/work/${repo}`, p.key))].join(
    '\n',
  ),
);
must('阶段 2 离线安装', install);
timings.push(['阶段 2 离线安装（断网）', install.ms]);

const build = await offline('cd /work/demo-web && pnpm build');
must('阶段 2 构建 demo-web', build);
timings.push(['阶段 2 构建 demo-web（断网）', build.ms]);
if (!fs.existsSync(path.join(workDir, 'demo-web', 'dist', 'index.html'))) {
  console.error('✗ 构建后没有 dist/index.html');
  process.exit(1);
}

// 4. 隔离自检：每项打印 PASS / FAIL
const probe = await offline(
  [
    `node -e "fetch('https://registry.npmjs.org/',{signal:AbortSignal.timeout(5000)}).then(()=>console.log('FAIL 能连外网'),()=>console.log('PASS 连不上外网'))"`,
    `node -e "fetch('http://host.docker.internal:${c.CC_SIM_PORT}/',{signal:AbortSignal.timeout(3000)}).then(()=>console.log('FAIL 能连宿主机'),()=>console.log('PASS 连不上宿主机'))"`,
    `[ "$(id -u)" != 0 ] && echo 'PASS 非 root 运行' || echo 'FAIL 以 root 运行'`,
    `touch /usr/probe 2>/dev/null && echo 'FAIL 根文件系统可写' || echo 'PASS 根文件系统只读'`,
    `env | grep -qiE 'token|openai|password|secret' && echo 'FAIL 环境变量里有密钥' || echo 'PASS 环境变量里没有密钥'`,
    `grep -rqs "${botToken}" /work/*/.git/config && echo 'FAIL 工作区里有令牌' || echo 'PASS 工作区里没有令牌'`,
  ].join('\n'),
);
const lines = probe.output.split('\n').filter((l) => /^(PASS|FAIL) /.test(l));
for (const l of lines) console.log(`${l.startsWith('PASS') ? '✓' : '✗'} ${l.slice(5)}`);

console.log('\n耗时');
for (const [label, ms] of timings) console.log(`  ${sec(ms).padStart(6)}  ${label}`);
console.log(`  ${sec(timings.reduce((s, [, ms]) => s + ms, 0)).padStart(6)}  合计`);

if (keep) console.log(`\n本轮目录保留在 ${roundDir}`);
else fs.rmSync(roundDir, { recursive: true, force: true });
if (lines.length !== 6 || lines.some((l) => l.startsWith('FAIL'))) process.exit(1);
