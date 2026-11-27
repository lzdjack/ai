// pnpm repos:try —— P3 验收（docs/07 P3，06 §2.10、§10.3）：
//   1. 本进程起接口服务（连接器插件按配置加载）和后台任务；以演示团队拥有者张三的身份调接口
//   2. 新建 GitLab 连接器（模拟 GitLab，Bot 令牌）：先验证鉴权，库里只存密文
//   3. 挑选 demo 两仓（默认仅查看）→ 改成可修改：自动建项目并探测出构建 / 测试 / 类型检查命令
//   4. 起执行器（不给它任何 git 令牌）：试构建时按仓向服务端取凭据信封，用自己的私钥打开再克隆
//   5. 断网容器里两仓试构建通过
// 需要 Docker 和 pnpm dev:up。
import { loadConfig } from '@cloudcraft/config';
import { accountSettings, signAccessToken } from '@cloudcraft/server';
import { DEMO_NAMESPACE, DEMO_REPOS, withSim } from '../fixtures/lib.ts';
import { botToken, seedDemoRepos } from '../fixtures/seed.ts';
import { fail, sec, startHarness, waitFor } from './harness.ts';

const c = loadConfig();
type Json = Record<string, unknown>;

await seedDemoRepos(c);
await withSim(c, async (simBase) => {
  const h = await startHarness(c, { leaseSeconds: 30 });
  const token = signAccessToken(accountSettings(c), h.team.user);
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${h.server}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
    return json;
  };
  const ws = `/v1/workspaces/${h.team.ws}`;
  const ok: string[] = [];
  try {
    console.log('▶ 连接器');
    const bot = await botToken(simBase);
    const v = await call('POST', `${ws}/connectors/verify`, {
      plugin_id: 'connector-gitlab',
      config: { base_url: simBase },
      credential: { token: bot },
    });
    console.log(
      `  验证鉴权：${v.ok ? '通过' : '失败'}，身份 ${v.identity}，可见 ${v.visible_repo_count} 个仓，${v.latency_ms}ms`,
    );
    const conn = await call('POST', `${ws}/connectors`, {
      plugin_id: 'connector-gitlab',
      name: `模拟 GitLab ${Date.now() % 10000}`,
      config: { base_url: simBase },
      credential: { token: bot },
    });
    console.log(`  已保存「${conn.name}」，令牌显示为 ${conn.credential_hint}`);
    ok.push('✓ GitLab 连接器：先验证鉴权再保存，库里只存密文，接口只回打码提示');

    console.log('\n▶ 挑选仓库与探测');
    const remote = await call('GET', `${ws}/connectors/${conn.id}/remote-repos?q=demo`);
    const items = (remote.items as Json[]).filter((r) =>
      DEMO_REPOS.some((n) => r.path === `${DEMO_NAMESPACE}/${n}`),
    );
    console.log(`  远端仓：${items.map((r) => r.path).join('、')}`);
    const attached = (await call('POST', `${ws}/repos/batch-attach`, {
      connector_id: conn.id,
      remote_ids: items.map((r) => r.remote_id),
    })) as { items: Json[] };
    const web = attached.items.find((r) => String(r.path).endsWith('demo-web'))!;
    const lib = attached.items.find((r) => String(r.path).endsWith('demo-lib'))!;
    console.log(
      `  挑进来：${attached.items.map((r) => `${r.path}（${r.access_mode === 'read_only' ? '仅查看' : '可修改'}）`).join('、')}`,
    );
    const webRw = await call('PATCH', `${ws}/repos/${web.id}`, { access_mode: 'read_write' });
    const libRw = await call('PATCH', `${ws}/repos/${lib.id}`, {
      access_mode: 'read_write',
      project_id: webRw.project_id,
    });
    for (const r of [libRw, webRw]) {
      const st = r.settings as Json;
      console.log(
        `  ${r.path}：${st.package_manager}，构建 ${st.build_command}，测试 ${st.test_command}，类型检查 ${st.typecheck_command}，验证方式 ${st.verify_strategy}${st.dist_dir ? `（产物 ${st.dist_dir}/，资源 ${(st.asset_url_patterns as string[]).join(',')}）` : ''}`,
      );
    }
    if (!(webRw.settings as Json)?.build_command || !(libRw.settings as Json)?.build_command)
      fail('没探测出构建命令');
    ok.push(
      '✓ 挑进来默认仅查看；改成可修改后自动建项目并探测出构建 / 测试 / 类型检查命令和验证方式',
    );

    console.log('\n▶ 试构建（执行器没有任何 git 令牌，克隆凭据走信封）');
    h.startExecutor({ CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('repos:try') });
    const t0 = Date.now();
    const started = await call('POST', `${ws}/projects/${webRw.project_id}/trial-build`);
    const done = await waitFor(
      '试构建结束',
      async () => {
        const f = await call('GET', `${ws}/flows/${started.flow_id}`);
        const n = (f.nodes as Json[])[0];
        return n && (n.status === 'done' || n.status === 'failed') ? n : null;
      },
      10 * 60_000,
    );
    const out = done.output as {
      builds?: { repo: string; ok: boolean; ms: number }[];
      network?: string;
    } | null;
    for (const b of out?.builds ?? [])
      console.log(`  ${sec(b.ms).padStart(6)}  断网构建 ${b.repo}：${b.ok ? '通过' : '失败'}`);
    if (done.status !== 'done') fail(`试构建失败：${done.error}`);
    ok.push(
      `✓ 试构建通过（network=${out?.network}，${sec(Date.now() - t0)}）：执行器按仓取凭据信封、用自己的私钥打开后克隆`,
    );
    console.log(`\n${ok.join('\n')}`);
  } catch (e) {
    console.error(`\n✗ ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await h.close();
  }
});
