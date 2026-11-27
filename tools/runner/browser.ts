// pnpm runner:browser [B001] —— E2b 验收（docs/07 E2b，06 §5.2、§5.7）：
//   1. 把 demo-web（主分支，Bug 都在）部署到模拟服务的测试环境
//   2. 起接口服务、后台任务、执行器，跑三节点流程：准备 → 修题 → 宿主机回放判定
//      修题用演练引擎（不调模型）：在真实的本轮沙箱里打上参考修复，交付里带题库的参考浏览器复现物
//   3. 回放判定：断网容器里分别构建修前、修后的 demo-web；浏览器容器（完全断网）打开测试环境，
//      把 demo-web 的资源换成本地构建，按复现物操作和断言：修前必须停在断言上、修后必须通过，
//      两次都要满足替换四项不变量，并留修前修后截图
// 需要 Docker 和 pnpm dev:up；第一次会拉 Playwright 镜像。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '@cloudcraft/config';
import { startLlmProxy } from '@cloudcraft/llm-proxy';
import { PLAN_SCHEMA_VERSION, type Plan } from '@cloudcraft/server';
import { deployDemoEnv } from '../fixtures/env.ts';
import {
  DEMO_NAMESPACE,
  DEMO_REPOS,
  ROOT,
  browserReproOf,
  loadBugs,
  withSim,
} from '../fixtures/lib.ts';
import { botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { demoRepoSpec, fail, printBrowserVerdict, sec, startHarness, waitFor } from './harness.ts';

const bugId = process.argv.slice(2).find((a) => /^B\d+$/.test(a)) ?? 'B001';
const c = loadConfig();
const bug = loadBugs().find((b) => b.id === bugId) ?? fail(`题库里没有 ${bugId}`);
const repro = browserReproOf(bug) ?? fail(`${bugId} 没有参考浏览器复现物（verify.browser）`);

await seedDemoRepos(c);
const env = await deployDemoEnv(c);
await withSim(c, async (simBase) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-runner-browser-'));
  // the AI node always registers its round with the model proxy; this drill never calls a model
  const proxy = await startLlmProxy({
    upstream: {
      api: 'openai-responses',
      baseUrl: 'http://127.0.0.1:9',
      apiKey: 'unused',
      model: 'none',
    },
    port: 0,
    controlSocket: path.join(scratch, 'llm-proxy.sock'),
  });
  const h = await startHarness(c, { leaseSeconds: 30 });
  try {
    console.log(`· ${bug.id} [${bug.level}] ${bug.title}`);
    console.log(`· 测试环境 ${env.url}（${env.deployed === 'now' ? '刚部署' : '已部署'}）`);
    h.startExecutor({
      CC_RUNNER_GIT_TOKEN: await botToken(simBase),
      CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('runner:browser'),
      CC_LLM_PROXY_SOCKET: path.join(scratch, 'llm-proxy.sock'),
      CC_AGENT_RUNTIME: path.join(ROOT, 'tools', 'runner', 'patch-engine.ts'),
    });

    const patches = Object.fromEntries(
      [...bug.patches('fix')].map(([repo, file]) => [repo, fs.readFileSync(file, 'utf8')]),
    );
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
            material: { title: bug.title, body: bug.report },
            engine: {
              patches,
              delivery: {
                root_cause: `reference fix of ${bug.id}`,
                summary: `applied ${bug.patches('fix').size} reference patch(es)`,
                repro_tests: [],
                browser_repro: repro,
                verification: 'drill: replayed by the host',
              },
            },
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
        return rs.find((r) => r.status === 'failed') || rs.some((r) => r.nodeKey === 'review')
          ? rs
          : null;
      },
      20 * 60_000,
    );
    console.log('\n节点');
    for (const r of runs.filter((x) => x.nodeKey !== 'review'))
      console.log(
        `  ${r.status === 'done' ? '✓' : '✗'} ${r.nodeKey.padEnd(8)} ${sec(+r.updatedAt - +r.createdAt).padStart(7)}${r.errorRaw ? `  ${String(r.errorRaw).slice(0, 300)}` : ''}`,
      );
    const fix = runs.find((r) => r.nodeKey === 'fix');
    if (fix?.status !== 'done')
      throw new Error(`修题节点失败：${JSON.stringify(fix?.structuredOutput).slice(0, 1500)}`);
    const verify = runs.find((r) => r.nodeKey === 'verify');
    const out = (verify?.structuredOutput ?? {}) as Record<string, unknown>;
    const shots = printBrowserVerdict(
      out,
      path.join(c.CC_DATA_DIR, 'evidence', 'runner-browser', bug.id),
    );
    if (verify?.status !== 'done') throw new Error('回放判定没有通过');
    console.log(
      `\n✓ 三节点流程走完 ${sec(Date.now() - t0)}：浏览器复现物修前停在断言上、修后通过，替换四项不变量两次都满足`,
    );
    if (shots) console.log(`✓ 修前修后截图：${shots}`);
    console.log(`  （fix/ 分支已推到模拟 GitLab ${DEMO_NAMESPACE}/${bug.runIn}）`);
  } catch (e) {
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await h.close();
    await proxy.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
