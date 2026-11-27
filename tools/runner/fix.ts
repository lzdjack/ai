// pnpm runner:fix [B001] [--thinking low|medium|high] —— E2 验收（docs/07 E2，06 §5.4、§5.7、§11）：
//   1. 本进程起接口服务、后台任务和模型代理（唯一读模型密钥的地方，执行器经控制 Socket 登记每轮令牌）
//   2. 起真实的执行器进程，跑一张三节点流程：准备工作区 → AI 修题 → 宿主机回放判定
//      AI 修题：执行器按配置加载引擎插件（Pi），引擎在本轮内部网络的断网容器里跑，只能经中继连模型代理
//      和本轮的宿主工具端；交付由宿主机逐次校验，改了哪些文件、提交号由宿主机从 git 读
//      回放判定：Bot 写的复现测试修前必须失败、修后必须通过，所在仓类型检查和全部测试通过，通过才推 fix/ 分支；
//      demo-web 是浏览器验证的仓，Bot 交了浏览器复现物时还在测试环境上做产物替换回放（E2b，06 §5.2）
//   3. 用题库的隐藏测试（Bot 看不到）在推上去的分支上复核：修前失败、修后通过
// 真实调用模型、要花钱，不进 verify。需要 Docker 和 pnpm dev:up。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ensureSandboxImage,
  installRoundDeps,
  openRoundNetwork,
  runContainer,
} from '@cloudcraft/bot-executor';
import { loadConfig } from '@cloudcraft/config';
import { startLlmProxy } from '@cloudcraft/llm-proxy';
import { PLAN_SCHEMA_VERSION, type Plan } from '@cloudcraft/server';
import {
  BUGS_DIR,
  DEMO_NAMESPACE,
  DEMO_REPOS,
  ROOT,
  git,
  loadBugs,
  withSim,
} from '../fixtures/lib.ts';
import { deployDemoEnv } from '../fixtures/env.ts';
import { botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { demoRepoSpec, fail, printBrowserVerdict, sec, startHarness, waitFor } from './harness.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const bugId = argv.find((a) => /^B\d+$/.test(a)) ?? 'B001';
const thinking = flag('--thinking') ?? 'medium';
const c = loadConfig();
if (!c.CC_LLM_BASE_URL || !c.CC_LLM_MODEL || !c.CC_LLM_API_KEY)
  fail('~/.cloudcraft-dev/.env 里的模型接入还没填（填好后先跑 pnpm llm:check）');
const bug = loadBugs().find((b) => b.id === bugId) ?? fail(`题库里没有 ${bugId}`);

type Out = Record<string, unknown>;
/** inside the drill: throws, so the executor and servers are still shut down */
const stop = (msg: string): never => {
  throw new Error(msg);
};
const short = (s: unknown, n = 160) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, n);

await seedDemoRepos(c);
const env = await deployDemoEnv(c);
await withSim(c, async (simBase) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-runner-fix-'));
  const proxy = await startLlmProxy({
    upstream: {
      api: c.CC_LLM_API ?? 'openai-responses',
      baseUrl: c.CC_LLM_BASE_URL!,
      apiKey: c.CC_LLM_API_KEY!,
      model: c.CC_LLM_MODEL!,
    },
    port: 0,
    controlSocket: path.join(scratch, 'llm-proxy.sock'),
  });
  const h = await startHarness(c, { leaseSeconds: 30 });
  const gitToken = await botToken(simBase);
  const ok: string[] = [];
  try {
    console.log(`· ${bug.id} [${bug.level}] ${bug.title}`);
    console.log(`· 模型 ${proxy.info.model}（${proxy.info.api}，thinking=${thinking}）`);

    // isolation self-check of a round network (06 §5.3 item 3, §15 item 6), as the AI node gets it
    const image = ensureSandboxImage(path.join(ROOT, 'infra', 'sandbox'));
    const net = await openRoundNetwork({
      image: image.tag,
      contextDir: path.join(ROOT, 'infra', 'sandbox'),
      routes: { '/llm': proxy.info.port },
    });
    try {
      const probe = await runContainer({
        image: image.tag,
        network: net.network,
        mounts: [],
        script: [
          `node -e "fetch('https://registry.npmjs.org/',{signal:AbortSignal.timeout(4000)}).then(()=>console.log('FAIL 能连外网'),()=>console.log('PASS 连不上外网'))"`,
          `node -e "fetch('http://host.docker.internal:${proxy.info.port}/',{signal:AbortSignal.timeout(3000)}).then(()=>console.log('FAIL 能直连宿主机'),()=>console.log('PASS 不能直连宿主机'))"`,
          `node -e "fetch('${net.relayUrl}/llm/responses',{method:'POST'}).then(r=>console.log(r.status===401?'PASS 中继拒绝无令牌请求':'FAIL 中继放行了无令牌请求 '+r.status))"`,
          `node -e "fetch('${net.relayUrl}/other',{headers:{authorization:'Bearer ${net.token}'}}).then(r=>console.log(r.status===404?'PASS 中继只转发登记的路径':'FAIL 中继转发了未登记路径 '+r.status))"`,
        ].join('\n'),
      });
      const lines = probe.output.split('\n').filter((l) => /^(PASS|FAIL) /.test(l));
      for (const l of lines) console.log(`${l.startsWith('PASS') ? '✓' : '✗'} ${l.slice(5)}`);
      if (lines.length !== 4 || lines.some((l) => l.startsWith('FAIL')))
        stop('本轮网络隔离自检没过');
      ok.push('✓ 本轮网络隔离自检 4 项通过');
    } finally {
      net.close();
    }
    h.startExecutor({
      CC_RUNNER_GIT_TOKEN: gitToken,
      CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('runner:fix'),
      CC_LLM_PROXY_SOCKET: path.join(scratch, 'llm-proxy.sock'),
    });

    const repro = bug.repro.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const plan: Plan = {
      plan_schema_version: PLAN_SCHEMA_VERSION,
      repos: DEMO_REPOS.map((name) => demoRepoSpec(simBase, name)),
      nodes: [
        { key: 'prepare', kind: 'auto', node_kind: 'host_prepare' },
        {
          key: 'fix',
          kind: 'auto',
          node_kind: 'ai_agent',
          config: {
            material: {
              title: bug.title,
              body: `${bug.report.trim()}${repro ? `\n\n复现步骤：\n${repro}` : ''}`,
            },
            engine: { thinking },
          },
        },
        {
          key: 'verify',
          kind: 'auto',
          node_kind: 'deterministic_verify',
          config: { action: 'replay', env_url: env.url },
        },
        { key: 'review', kind: 'human' },
      ],
    };
    const t0 = Date.now();
    const flowId = await h.startFlow(plan);
    const runs = await waitFor(
      '三个节点走完',
      async () => {
        const rs = await h.runsOf(flowId);
        const failed = rs.find((r) => r.status === 'failed');
        return failed || rs.some((r) => r.nodeKey === 'review') ? rs : null;
      },
      40 * 60_000,
    );
    const total = Date.now() - t0;
    const by = (k: string) => runs.find((r) => r.nodeKey === k);
    const prep = by('prepare');
    const fix = by('fix');
    const verify = by('verify');
    const fixOut = (fix?.structuredOutput ?? {}) as Out;
    const verOut = (verify?.structuredOutput ?? {}) as Out;

    console.log('\n节点');
    for (const r of [prep, fix, verify].filter(Boolean))
      console.log(
        `  ${r!.status === 'done' ? '✓' : '✗'} ${r!.nodeKey.padEnd(8)} ${sec(+r!.updatedAt - +r!.createdAt).padStart(7)}${r!.errorRaw ? `  ${short(r!.errorRaw, 300)}` : ''}`,
      );
    if (fix) {
      const d = fixOut.delivery as Out | null;
      const u = fixOut.usage as Out | null;
      console.log('\nAI 修题');
      console.log(
        `  引擎 ${short((fixOut.engine as Out)?.id)}，结束原因 ${short(fixOut.stop_reason)}，${fixOut.turns} 个回合，${fixOut.tool_calls} 次工具调用（${fixOut.tool_errors} 次出错）${fixOut.follow_up_used ? '，追问过一次' : ''}`,
      );
      if (fixOut.error) console.log(`  ✗ ${short(fixOut.error, 400)}`);
      if (d) {
        console.log(`  根因：${short(d.root_cause, 240)}`);
        console.log(`  改动：${short(d.summary, 240)}`);
        if ((d.repro_tests as string[]).length)
          console.log(`  复现测试：${(d.repro_tests as string[]).join('、')}`);
        if (d.browser_repro)
          console.log(`  浏览器复现物：${JSON.stringify(d.browser_repro).slice(0, 400)}`);
      }
      for (const ch of (fixOut.changes as Out[]) ?? [])
        console.log(
          `  宿主机读到 ${ch.repo}：${(ch.files as string[]).join('、')}（${String(ch.head_sha).slice(0, 8)}）`,
        );
      if ((fixOut.touched_tests as string[])?.length)
        console.log(`  ✗ 动了已有测试：${(fixOut.touched_tests as string[]).join('、')}`);
      if (u)
        console.log(
          `  模型代理计量：${u.requests} 次请求，输入 ${u.input}（缓存命中 ${u.cacheRead}），输出 ${u.output}`,
        );
    }
    if (verify) {
      printBrowserVerdict(verOut, path.join(c.CC_DATA_DIR, 'evidence', 'runner-fix', bug.id));
      for (const p of (verOut.pushed as Out[]) ?? []) console.log(`  · 已推 ${p.repo} ${p.branch}`);
    }
    if (verify?.status !== 'done') {
      // keep the engine's files (session, trajectory) for a look before the work root goes away
      const keep = path.join(c.CC_DATA_DIR, 'evidence', 'runner-fix', bug.id, 'engine');
      const roots = path.join(c.CC_DATA_DIR, 'sandboxes');
      for (const r of fs.readdirSync(roots))
        for (const f of fs.readdirSync(path.join(roots, r)).filter((x) => x.startsWith('flow-')))
          if (fs.existsSync(path.join(roots, r, f, 'engine')))
            fs.cpSync(path.join(roots, r, f, 'engine'), keep, { recursive: true });
      console.log(`  引擎会话留在 ${keep}`);
      stop('回放判定没有通过');
    }
    ok.push(
      `✓ 三节点流程走完 ${sec(total)}：准备 → AI 修题（${short(fixOut.stop_reason)}）→ 回放判定通过并推送`,
    );

    // ---- independent check with the hidden test the bot never saw ----
    const pushed = (verOut.pushed as { repo: string; branch: string }[]) ?? [];
    const dir = path.join(scratch, 'check');
    const workDir = path.join(dir, 'work');
    fs.mkdirSync(workDir, { recursive: true });
    for (const repo of DEMO_REPOS) {
      await git(workDir, ['clone', '-q', `${simBase}/${DEMO_NAMESPACE}/${repo}.git`, repo], {
        token: gitToken,
      });
      const p = pushed.find((x) => x.repo === repo);
      if (p) {
        await git(path.join(workDir, repo), ['fetch', '-q', 'origin', p.branch], {
          token: gitToken,
        });
        await git(path.join(workDir, repo), ['checkout', '-q', 'FETCH_HEAD']);
      }
    }
    const deps = await installRoundDeps({
      image: image.tag,
      workDir,
      repos: DEMO_REPOS,
      cacheRoot: path.join(c.CC_DATA_DIR, 'pnpm-store'),
      roundDir: dir,
    });
    if (!deps.ok) return stop(`复核装依赖失败：${deps.label}`);
    const hidden = path.join('src', '__hidden__', `${bug.id}.test.ts`);
    fs.mkdirSync(path.join(workDir, bug.runIn, 'src', '__hidden__'), { recursive: true });
    fs.copyFileSync(path.join(BUGS_DIR, bug.verify.unit), path.join(workDir, bug.runIn, hidden));
    const test = (tag: string) =>
      `(cd /work/${bug.runIn} && pnpm exec vitest run ${hidden} >/dev/null 2>&1); echo "RESULT ${tag} $?"`;
    const check = await runContainer({
      image: image.tag,
      network: 'none',
      mounts: deps.mounts,
      script: [
        `git config --global --add safe.directory '*'`,
        test('head'),
        ...pushed.map((p) => `cd /work/${p.repo} && git checkout -q origin/main`),
        test('base'),
      ].join('\n'),
    });
    const res = Object.fromEntries(
      [...check.output.matchAll(/^RESULT (\S+) (\d+)$/gm)].map((m) => [m[1], Number(m[2])]),
    );
    const hiddenOk = res.base !== undefined && res.base !== 0 && res.head === 0;
    console.log(
      `\n${hiddenOk ? '✓' : '✗'} 隐藏测试复核：修前${res.base ? '失败' : '未失败'} → 修后${res.head === 0 ? '通过' : '未通过'}`,
    );
    if (!hiddenOk) stop('隐藏测试复核没过');
    ok.push(`✓ 隐藏测试（Bot 看不到）复核：修前失败、修后通过`);
    console.log(`\n${ok.join('\n')}`);
  } catch (e) {
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await h.close();
    await proxy.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
