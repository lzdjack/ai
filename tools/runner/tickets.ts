// pnpm tickets:try [B001] [--model] —— P4 验收（docs/07 P4，06 §3.1、§3.2、§5.7；05 步骤 3）：
//   1. 演示团队接入模拟 GitLab（已接过就复用）、demo 两仓设为可修改并探测、项目登记测试环境
//   2. 用题库手建一张单（接口，和页面上「手动新建工单」同一个）：拿到 M-<序号>，第 1 轮直接派给 Bot
//   3. 真实执行器跑内置「标准前端修 Bug」：准备 → AI 修题 → 宿主机回放判定（含浏览器复现）→ 等人审核
//      AI 修题默认用演练引擎（打参考修复、交参考浏览器复现物，不调模型）；--model 换成真实模型（Pi）
//   4. 后台核对事实后进「待我审核」：交付卡上的提交号和模拟 GitLab 上 fix/ 分支的头一致
// 需要 Docker 和 pnpm dev:up；--model 还要 ~/.cloudcraft-dev/.env 里的模型接入。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DeliveryCard } from '@cloudcraft/core-protocol';
import { loadConfig } from '@cloudcraft/config';
import { startLlmProxy } from '@cloudcraft/llm-proxy';
import { accountSettings, signAccessToken } from '@cloudcraft/server';
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
import { fail, sec, startHarness, waitFor } from './harness.ts';

const argv = process.argv.slice(2);
const bugId = argv.find((a) => /^B\d+$/.test(a)) ?? 'B001';
const useModel = argv.includes('--model');
const c = loadConfig();
const bug = loadBugs().find((b) => b.id === bugId) ?? fail(`题库里没有 ${bugId}`);
if (useModel && (!c.CC_LLM_BASE_URL || !c.CC_LLM_MODEL || !c.CC_LLM_API_KEY))
  fail('--model 需要先在 .env 里填好模型接入');
type Json = Record<string, unknown>;

await seedDemoRepos(c);
const env = await deployDemoEnv(c);
await withSim(c, async (simBase) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-tickets-'));
  const proxy = await startLlmProxy({
    upstream: useModel
      ? {
          api: c.CC_LLM_API ?? 'openai-responses',
          baseUrl: c.CC_LLM_BASE_URL!,
          apiKey: c.CC_LLM_API_KEY!,
          model: c.CC_LLM_MODEL!,
        }
      : { api: 'openai-responses', baseUrl: 'http://127.0.0.1:9', apiKey: 'unused', model: 'none' },
    port: 0,
    controlSocket: path.join(scratch, 'llm-proxy.sock'),
  });
  const h = await startHarness(c, { leaseSeconds: 30 });
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
  const ws = `/v1/workspaces/${h.team.ws}`;
  const ok: string[] = [];
  try {
    console.log(`· ${bug.id} [${bug.level}] ${bug.title}`);
    console.log(
      `· AI 修题：${useModel ? `真实模型 ${proxy.info.model}` : '演练引擎（参考修复，不调模型）'}`,
    );
    const bot = await botToken(simBase);

    // 1. connector, repos, environment (reused when they exist)
    const conns = (await call('GET', `${ws}/connectors`)).items as Json[];
    const conn =
      conns.find(
        (x) => x.plugin_id === 'connector-gitlab' && (x.config as Json).base_url === simBase,
      ) ??
      (await call('POST', `${ws}/connectors`, {
        plugin_id: 'connector-gitlab',
        name: '模拟 GitLab',
        config: { base_url: simBase },
        credential: { token: bot },
      }));
    const remote = (
      (await call('GET', `${ws}/connectors/${conn.id}/remote-repos?q=demo`)).items as Json[]
    ).filter((r) => DEMO_REPOS.some((n) => r.path === `${DEMO_NAMESPACE}/${n}`));
    const attached = (
      (await call('POST', `${ws}/repos/batch-attach`, {
        connector_id: conn.id,
        remote_ids: remote.map((r) => r.remote_id),
      })) as { items: Json[] }
    ).items;
    const web = attached.find((r) => String(r.path).endsWith('demo-web'))!;
    const lib = attached.find((r) => String(r.path).endsWith('demo-lib'))!;
    const webRw = web.project_id
      ? web
      : await call('PATCH', `${ws}/repos/${web.id}`, { access_mode: 'read_write' });
    const project = webRw.project_id as string;
    if (!lib.project_id)
      await call('PATCH', `${ws}/repos/${lib.id}`, {
        access_mode: 'read_write',
        project_id: project,
      });
    await call('POST', `${ws}/projects/${project}/environments`, {
      env_code: 'test',
      name: '测试环境',
      env_tier: 'test_gate',
      entry_url: env.url,
    }).catch(() => null);
    console.log(`· 项目已就绪：两仓可修改，测试环境 ${env.url}`);

    // 2. the executor, with the drill engine or Pi
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
      CC_RUNNER_ENROLL_TOKEN: await h.enrollToken('tickets:try'),
      CC_LLM_PROXY_SOCKET: path.join(scratch, 'llm-proxy.sock'),
      ...(useModel
        ? {}
        : {
            CC_AGENT_RUNTIME: path.join(ROOT, 'tools', 'runner', 'patch-engine.ts'),
            CC_PATCH_ENGINE_FILE: engineFile,
          }),
    });

    // 3. the ticket, created the way the "new ticket" dialog does
    const t0 = Date.now();
    const ticket = await call('POST', `${ws}/projects/${project}/tickets`, {
      title: bug.title,
      body: bug.report.trim(),
      repro_steps: bug.repro,
      priority: 'P1',
    });
    console.log(`\n▶ 建单 ${ticket.no}（${ticket.status}，第 ${ticket.current_round} 轮）`);
    const detail = await waitFor(
      '进入待我审核或需要协助',
      async () => {
        const d = await call('GET', `${ws}/tickets/${ticket.id}`);
        return d.status === 'in_review' || d.status === 'needs_help' ? d : null;
      },
      40 * 60_000,
    );
    const round = (detail.rounds as Json[])[0]!;
    if (detail.status !== 'in_review') fail(`第 1 轮需要协助：${round.reason}`);
    const card = round.delivery as DeliveryCard;
    console.log(
      `  ${sec(Date.now() - t0)} 后进入待我审核，风险等级 ${card.risk_level}${card.risk_reasons.length ? `（${card.risk_reasons.join('、')}）` : ''}`,
    );
    console.log(`  根因：${card.root_cause}`);
    for (const k of card.checks) console.log(`  ${k.ok ? '✓' : '✗'} ${k.key}`);
    if (card.screenshots.length)
      console.log(`  修前修后截图 ${card.screenshots.length} 张（sha256 已记）`);

    // 4. the commit on the card is the head of the fix/ branch on the platform
    for (const r of card.repos) {
      const res = await fetch(
        `${simBase}/api/v4/projects/${encodeURIComponent(`${DEMO_NAMESPACE}/${r.repo}`)}/repository/branches/${encodeURIComponent(r.branch)}`,
        { headers: { 'PRIVATE-TOKEN': bot } },
      );
      const head = ((await res.json()) as { commit?: { id: string } }).commit?.id;
      console.log(
        `  ${head === r.head_sha ? '✓' : '✗'} ${r.repo} ${r.branch}：交付卡 ${r.head_sha.slice(0, 8)}，模拟 GitLab ${head?.slice(0, 8)}（+${r.added} −${r.deleted}）`,
      );
      if (head !== r.head_sha) fail('交付卡上的提交号和仓库对不上');
    }
    ok.push(`✓ 手建 ${ticket.no} → Bot 交付第 1 轮 → 待我审核（${sec(Date.now() - t0)}）`);
    ok.push('✓ 交付卡上的提交号与模拟 GitLab 上 fix/ 分支的头一致');
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
