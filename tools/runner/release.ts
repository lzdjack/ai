// pnpm release:try [B001] —— P6 验收（docs/07 P6；06 §3.3、§6.3、§6.4、§7.1～§7.4；05 步骤 5～12）：
//   1. 演示团队的项目（复用 tickets:try 的准备）、正式环境、发布连接器（模拟 Apollo + OSS）、发布配置（测试分支 test）
//   2. 张三配好自己的账号：模拟 GitLab 个人令牌（合 MR）、模拟 Apollo 账号（发布）
//   3. 真实执行器：Bot 执行器（演练引擎修题、构建沙箱打包）+ 发布执行器（合 MR、上传、发布、核对）
//   4. 建单 → 交付 → 审核通过 → 发布到测试环境：MR 合入测试分支 → 测试分支最新提交打包 → 上传 → 发布
//      （注入「发布做到一半中断」：Apollo 已生效但执行器拿不到结果 → 这一步失败 → 点重试，先回读，对上就不再发）
//      → 核对 → 通知测试人；测试环境站点的版本和提交号变成这次的
//   5. 复测通过 → 合回主分支（MR → main）→ 发布到正式环境：主分支重新打包 → 上传 → 发布时杀掉发布执行器
//      → 租约过期标「执行中断」→ 重启执行器、点重试 → 核对 → 正式环境站点显示新版本
// 需要 Docker 和 pnpm dev:up。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DeliveryView } from '@cloudcraft/core-protocol';
import { loadConfig } from '@cloudcraft/config';
import { accountSettings, signAccessToken } from '@cloudcraft/server';
import { deployDemoEnv } from '../fixtures/env.ts';
import { ROOT, browserReproOf, loadBugs, withSim } from '../fixtures/lib.ts';
import { DEMO_TEST_BRANCH, botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { setupDemoProject } from './demo-project.ts';
import { fail, sec, startHarness, waitFor } from './harness.ts';

const argv = process.argv.slice(2);
const bugId = argv.find((a) => /^B\d+$/.test(a)) ?? 'B001';
const c = loadConfig();
const bug = loadBugs().find((b) => b.id === bugId) ?? fail(`题库里没有 ${bugId}`);
type Json = Record<string, unknown>;

await seedDemoRepos(c);
const env = await deployDemoEnv(c);
await withSim(c, async (simBase) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-release-'));
  // short leases: a killed release executor is noticed within seconds
  const h = await startHarness(c, { leaseSeconds: 8 });
  const token = signAccessToken(accountSettings(c), h.team.user);
  const call = async (method: string, p: string, body?: unknown) => {
    const res = await fetch(`${h.server}${p}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${JSON.stringify(json)}`);
    return json;
  };
  const sim = async (p: string, init?: RequestInit) => {
    const res = await fetch(`${simBase}${p}`, init);
    return res.json() as Promise<Json>;
  };
  const fault = (body: Json) =>
    sim('/__sim/faults', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const ws = `/v1/workspaces/${h.team.ws}`;
  const ok: string[] = [];
  try {
    console.log(`· ${bug.id} [${bug.level}] ${bug.title}`);
    const bot = await botToken(simBase);
    const users = (await sim('/__sim/gitlab/users')) as unknown as {
      username: string;
      token: string;
    }[];
    const reviewerToken = users.find((u) => u.username === 'qa-reviewer')!.token;
    const envs = (await sim('/__sim/envs')) as Record<string, { url: string }>;

    // 1. project, production environment, release connector and settings
    const { project, webRepoId } = await setupDemoProject({
      call,
      ws,
      simBase,
      botToken: bot,
      testEnvUrl: env.url,
    });
    await call('POST', `${ws}/projects/${project}/environments`, {
      env_code: 'prod',
      name: '正式环境',
      env_tier: 'production',
      entry_url: envs.prod!.url,
    }).catch(() => null);
    const conns = (await call('GET', `${ws}/connectors`)).items as Json[];
    const oss = await sim('/__sim/oss');
    const rel =
      conns.find((x) => x.plugin_id === 'connector-tita-apollo') ??
      (await call('POST', `${ws}/connectors`, {
        plugin_id: 'connector-tita-apollo',
        name: '模拟 Apollo',
        config: { apollo_url: simBase, oss_url: simBase },
        credential: { oss_access_key: oss.access_key },
      }));
    await call('PUT', `${ws}/projects/${project}/release-config`, {
      repo_id: webRepoId,
      provider_connector_id: rel.id,
      target_ref: {
        app_id: 'demo-web',
        cluster: 'default',
        namespace: 'application',
        config_key: 'demo-web',
        oss_bucket: 'ux',
        oss_prefix: 'demo-web/release/',
        env_map: { test: 'TEST', prod: 'PRO' },
      },
      test_branch: DEMO_TEST_BRANCH,
    });
    console.log(`· 发布配置：demo-web → 测试分支 ${DEMO_TEST_BRANCH}，模拟 Apollo TEST / PRO`);

    // 2. 张三's own accounts (01 PC-第一次发布-配账号)
    const gl = conns.find(
      (x) => x.plugin_id === 'connector-gitlab' && (x.config as Json).base_url === simBase,
    )!;
    const a1 = await call('PUT', `${ws}/me/accounts/${gl.id}`, {
      credential: { token: reviewerToken },
    });
    const a2 = await call('PUT', `${ws}/me/accounts/${rel.id}`, {
      credential: { username: 'qa-releaser', password: 'sim-apollo-pass' },
    });
    console.log(`· 个人账号：GitLab ${a1.identity}，Apollo ${a2.identity}`);

    // 3. executors
    const engineFile = path.join(scratch, 'engine.json');
    fs.writeFileSync(
      engineFile,
      JSON.stringify({
        patches: Object.fromEntries(
          [...bug.patches('fix')].map(([repo, f]) => [repo, fs.readFileSync(f, 'utf8')]),
        ),
        delivery: {
          root_cause: `reference fix of ${bug.id}`,
          summary: `applied the reference patch of ${bug.id}`,
          repro_tests: [],
          ...(browserReproOf(bug) ? { browser_repro: browserReproOf(bug) } : {}),
          verification: 'drill: replayed by the host',
        },
      }),
    );
    h.startExecutor({
      CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('release:try bot'),
      CC_AGENT_RUNTIME: path.join(ROOT, 'tools', 'runner', 'patch-engine.ts'),
      CC_PATCH_ENGINE_FILE: engineFile,
    });
    h.startReleaseExecutor({
      CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('release:try release', ['release']),
    });

    // 4. ticket → delivered → approved
    const t0 = Date.now();
    const ticket = await call('POST', `${ws}/projects/${project}/tickets`, {
      title: bug.title,
      body: bug.report.trim(),
      repro_steps: bug.repro,
      priority: 'P1',
    });
    console.log(`\n▶ 建单 ${ticket.no}`);
    const detail = await waitFor(
      '进入待我审核',
      async () => {
        const d = await call('GET', `${ws}/tickets/${ticket.id}`);
        if (d.status === 'needs_help') fail(`第 1 轮需要协助：${(d.rounds as Json[])[0]!.reason}`);
        return d.status === 'in_review' ? d : null;
      },
      20 * 60_000,
    );
    const r1 = (detail.rounds as Json[])[0]!;
    await call('POST', `${ws}/tickets/${ticket.id}/review`, {
      decision: 'approve',
      round_no: 1,
      delivery_digest: (r1.delivery as Json).delivery_digest,
      review_rev: r1.review_rev,
    });
    console.log(`  ${sec(Date.now() - t0)} 后交付并审核通过`);

    const view = () =>
      call('GET', `${ws}/tickets/${ticket.id}/delivery`) as unknown as Promise<DeliveryView>;
    const waitNode = (key: string, status: string, ms = 10 * 60_000) =>
      waitFor(
        `${key} ${status}`,
        async () => {
          const v = await view();
          const n = v.nodes.find((x) => x.key === key);
          if (n?.status === 'failed' && status !== 'failed') fail(`${key} 失败：${n.error}`);
          return n?.status === status ? v : null;
        },
        ms,
      );
    const live = async (name: 'test' | 'prod') =>
      (await (await fetch(`${envs[name]!.url}__version`)).json()) as {
        version: string;
        commit: string | null;
      };

    // 5 → 8 release to test, with an interrupted Apollo publish on the way
    await fault({
      module: 'apollo',
      kind: 'publish_interrupt',
      path: '/envs/TEST/',
      method: 'POST',
      times: 1,
    });
    const t1 = Date.now();
    const started = await call('POST', `${ws}/tickets/${ticket.id}/delivery/test`, { round_no: 1 });
    console.log(`\n▶ 发布到测试环境：${started.release_no}`);
    let v = await waitNode('test_mr_review', 'waiting_human');
    const mr = v.merge_requests[0]!;
    console.log(`  MR !${mr.external_iid} ${mr.source_branch} → ${mr.target_branch}，等审核`);
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/merge-review`, {
      decision: 'approve',
      expected_head_sha: mr.head_sha,
    });
    v = await waitNode('test_release', 'failed');
    const cut = v.nodes.find((n) => n.key === 'test_release')!;
    console.log(`  ✗ 发布到测试这一步失败（注入的中断）：${cut.error?.slice(0, 80)}`);
    const afterCut = await live('test');
    console.log(`  模拟 Apollo 实际已生效：${afterCut.version}`);
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/retry`, { node_key: 'test_release' });
    v = await waitNode('retest', 'waiting_human');
    const testTask = v.release_tasks.find((x) => x.environment.tier === 'test_gate')!;
    const testLive = await live('test');
    for (const s of testTask.steps)
      console.log(
        `  ${s.status === 'succeeded' ? '✓' : '✗'} ${s.slot} 第 ${s.attempt} 次 ${s.command ?? ''}${s.error ? `（${s.error.slice(0, 60)}）` : ''}`,
      );
    if (testLive.commit !== testTask.build_commit) fail('测试环境的提交号和打包的提交不一致');
    const apollo = (await sim('/__sim/apollo')) as { releases: { env: string; name: string }[] };
    const testReleases = apollo.releases.filter(
      (x) => x.env === 'TEST' && x.name.startsWith(testTask.version!),
    );
    console.log(
      `  测试环境 ${envs.test!.url} 现在是 ${testLive.version}（${testLive.commit?.slice(0, 8)}）；Apollo TEST 本版本发布 ${testReleases.length} 次`,
    );
    if (testReleases.length !== 1) fail('重试后又发布了一次');
    ok.push(
      `✓ 合入测试分支 → 测试分支最新提交打包 → 上传 → 发布 → 核对 → 通知测试人（${sec(Date.now() - t1)}）`,
    );
    ok.push('✓ 发布做到一半中断：点重试先回读，Apollo 已生效就不再发布（只发布了 1 次）');

    // 9 retest, 10 merge back
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/retest`, {
      decision: 'pass',
      release_task_id: testTask.id,
    });
    await waitNode('main_request', 'waiting_human');
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/main`);
    v = await waitNode('main_mr_review', 'waiting_human');
    const mainMr = v.merge_requests.find((m) => m.direction === 'to_main')!;
    console.log(`\n▶ 复测通过 → 合回主分支：MR !${mainMr.external_iid} → ${mainMr.target_branch}`);
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/merge-review`, {
      decision: 'approve',
      expected_head_sha: mainMr.head_sha,
    });
    v = await waitNode('prod_request', 'waiting_human');
    console.log(`  发正式三项前置：${JSON.stringify(v.prod_gates)}`);

    // 11 → 12 production, with the release executor killed while Apollo hangs
    await fault({
      module: 'apollo',
      kind: 'timeout',
      path: '/envs/PRO/',
      method: 'POST',
      times: 1,
      delay_ms: 60_000,
    });
    const t2 = Date.now();
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/production`);
    await waitFor(
      '发正式走到发布这一步',
      async () => (await view()).nodes.find((n) => n.key === 'prod_release')?.status === 'running',
      10 * 60_000,
    );
    await new Promise((r) => setTimeout(r, 1500));
    await h.killReleaseExecutor('SIGKILL');
    console.log('\n▶ 发布到正式时杀掉发布执行器（SIGKILL）');
    v = await waitNode('prod_release', 'failed', 60_000);
    console.log(
      `  租约过期 → 这一步标「${v.nodes.find((n) => n.key === 'prod_release')!.error}」，等人处理`,
    );
    h.startReleaseExecutor();
    await call('POST', `${ws}/tickets/${ticket.id}/delivery/retry`, { node_key: 'prod_release' });
    v = await waitFor(
      '发布流程完成',
      async () => {
        const x = await view();
        const f = x.nodes.find((n) => n.status === 'failed');
        if (f) fail(`${f.key} 失败：${f.error}`);
        return x.flow?.status === 'done' ? x : null;
      },
      10 * 60_000,
    );
    const prodTask = v.release_tasks.find((x) => x.environment.tier === 'production')!;
    const prodLive = await live('prod');
    console.log(
      `  正式环境 ${envs.prod!.url} 现在是 ${prodLive.version}（${prodLive.commit?.slice(0, 8)}）`,
    );
    if (prodLive.commit !== prodTask.build_commit) fail('正式环境的提交号和主分支打包的提交不一致');
    if (prodTask.build_commit === testTask.build_commit) fail('正式环境复用了测试包');
    const html = await (await fetch(envs.prod!.url)).text();
    if (!html.includes('<div id="root">')) fail('正式环境页面没有出来');
    ok.push(`✓ 复测通过 → 合回主分支 → 主分支重新打包发正式，核对通过（${sec(Date.now() - t2)}）`);
    ok.push('✓ 发布中途杀掉执行器：标「执行中断」等人，重启后点重试从这一步续上');
    ok.push(`✓ 正式环境站点显示新版本 ${prodLive.version}，提交号就是主分支打包的提交`);
    console.log(`\n${ok.join('\n')}`);
  } catch (e) {
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await sim('/__sim/faults', { method: 'DELETE' }).catch(() => null);
    await h.close();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
