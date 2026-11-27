// pnpm runner:try [--cold] —— E1 验收（docs/07 E1，06 §5.3、§5.3a、§2.12）：
//   1. 本进程起接口服务（cc-app）和后台任务（cc-sys），租约 10 秒；给演示团队签一个执行器注册令牌
//   2. 起真实的执行器进程（只连接口服务，不连数据库）：注册换发长期密钥 → 心跳领活
//   3. 两次试构建（冷 / 热）：执行器从模拟 GitLab 克隆 demo 两仓 → 联网准备依赖 → 断网容器里安装、构建两仓
//   4. 第三次试构建做到一半杀掉执行器：租约过期后 cc-sys 回收，重启执行器（凭长期密钥登录）接着做完
// 用的是 dev:up 建好的本地库和演示团队；--cold 先删依赖缓存。需要 Docker。
import fs from 'node:fs';
import path from 'node:path';
import { depsKey, ensureSandboxImage } from '@cloudcraft/bot-executor';
import { loadConfig } from '@cloudcraft/config';
import { PLAN_SCHEMA_VERSION, schema, type Plan } from '@cloudcraft/server';
import { and, eq } from 'drizzle-orm';
import { botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { DEMO_NAMESPACE, DEMO_REPOS, ROOT, withSim } from '../fixtures/lib.ts';
import { fail, sec, startHarness, waitFor } from './harness.ts';

const LEASE_SECONDS = 10;
const cold = process.argv.includes('--cold');
const c = loadConfig();

await seedDemoRepos(c);
await withSim(c, async (simBase) => {
  const h = await startHarness(c, { leaseSeconds: LEASE_SECONDS });
  const gitToken = await botToken(simBase);
  const startExecutor = (enrollToken?: string) =>
    h.startExecutor({ CC_RUNNER_GIT_TOKEN: gitToken, CC_RUNNER_ENROLL_TOKEN: enrollToken });

  const plan: Plan = {
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: DEMO_REPOS.map((name) => ({
      id: name,
      name,
      clone_url: `${simBase}/${DEMO_NAMESPACE}/${name}.git`,
      ref: 'main',
      build_command: 'pnpm build',
    })),
    nodes: [
      {
        key: 'trial_build',
        kind: 'auto',
        node_kind: 'deterministic_verify',
        config: { action: 'trial_build' },
      },
    ],
  };
  const runOf = async (flowId: string) => (await h.runsOf(flowId))[0]!;
  const finished = (flowId: string) =>
    waitFor(
      '试构建结束',
      async () => {
        const r = await runOf(flowId);
        return r.status === 'done' || r.status === 'failed' ? r : null;
      },
      10 * 60_000,
    );

  const results: string[] = [];
  try {
    const image = ensureSandboxImage(path.join(ROOT, 'infra', 'sandbox'));
    if (cold) {
      // the lockfile hash only needs the files; take them from the fixture sources
      for (const repo of DEMO_REPOS)
        fs.rmSync(
          path.join(
            c.CC_DATA_DIR,
            'pnpm-store',
            depsKey(path.join(ROOT, 'fixtures', repo), image.tag),
          ),
          { recursive: true, force: true },
        );
      console.log('· 已删依赖缓存（冷启动）');
    }

    startExecutor(await h.enrollToken('runner:try'));
    console.log('· 执行器注册令牌已签发（15 分钟有效，只能用一次）');

    for (const label of [cold ? '冷' : '第 1 次', cold ? '热' : '第 2 次']) {
      console.log(`\n▶ 试构建（${label}）`);
      const t0 = Date.now();
      const run = await finished(await h.startFlow(plan));
      const out = run.structuredOutput as {
        network?: string;
        timings?: { label: string; ms: number }[];
        builds?: { repo: string; ok: boolean; ms: number; output_tail: string }[];
      } | null;
      if (run.status !== 'done')
        fail(`试构建失败：${run.errorRaw}\n${JSON.stringify(out, null, 2)}`);
      for (const t of out?.timings ?? []) console.log(`  ${sec(t.ms).padStart(6)}  ${t.label}`);
      for (const b of out?.builds ?? [])
        console.log(`  ${sec(b.ms).padStart(6)}  断网构建 ${b.repo}：${b.ok ? '通过' : '失败'}`);
      console.log(`  ${sec(Date.now() - t0).padStart(6)}  合计（含领活与写回）`);
      results.push(
        `✓ 试构建（${label}）：${out?.builds?.map((b) => b.repo).join('、')} 在断网容器（network=${out?.network}）里构建通过，${sec(Date.now() - t0)}`,
      );
    }

    console.log('\n▶ 试构建做到一半杀掉执行器');
    const flowId = await h.startFlow(plan);
    await waitFor(
      '执行器领到活',
      async () => ((await runOf(flowId)).executorId ? true : null),
      60_000,
    );
    await new Promise((r) => setTimeout(r, 1500)); // let it get into the build
    await h.killExecutor('SIGKILL');
    const killedAt = Date.now();
    console.log(`  已强杀执行器；租约 ${LEASE_SECONDS} 秒后过期，cc-sys 每秒回收一次`);
    const requeued = await waitFor(
      '租约被回收',
      async () => {
        const [w] = await h.asOwner((tx) =>
          tx
            .select()
            .from(schema.workItems)
            .where(
              and(eq(schema.workItems.kind, 'bot_step'), eq(schema.workItems.status, 'queued')),
            ),
        );
        return w ?? null;
      },
      LEASE_SECONDS * 1000 + 15_000,
    );
    console.log(
      `  ${sec(Date.now() - killedAt)} 后租约被回收，任务回到队列（fence ${requeued.fence}）`,
    );
    startExecutor(); // signs in with the long-term secret, cleans up leftovers, takes the step again
    const run = await finished(flowId);
    if (run.status !== 'done') fail(`接手后试构建失败：${run.errorRaw}`);
    results.push(
      `✓ 杀执行器：${sec(Date.now() - killedAt)} 内回收并由重启的执行器做完；同一个节点记录（第 ${run.attemptNo} 次尝试），没有多开`,
    );
  } finally {
    await h.close();
  }
  console.log(`\n${results.join('\n')}`);
});
