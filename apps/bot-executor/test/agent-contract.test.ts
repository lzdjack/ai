// Engine contract tests (docs/06 §11.4 §3, 07 E2): the executor's driver and the host tool server
// against a scripted fake engine and against the real runtime-pi plugin on a simulated Pi process.
// Covers host tools mounted and checked on every call, the delivery card, the follow-up when the
// agent stops in plain text, the circuit breakers, lease loss and engine crashes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { AgentRuntimePlugin, AgentSandbox } from '@cloudcraft/core-protocol';
import { FINISHING_TOOLS, SUBMIT_DELIVERY, createToolHost } from '@cloudcraft/mcp-tool-host';
import { afterAll, describe, expect, it } from 'vitest';
import { driveAgent, type DriveLimits } from '../src/agent/driver.ts';
import { loadRuntime } from '../src/agent/registry.ts';
import { scriptedRuntime, simulatedPiSandbox, type Script } from './fake-engines.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-contract-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const workDir = path.join(tmp, 'work');
fs.mkdirSync(path.join(workDir, 'demo-web', 'src'), { recursive: true });
fs.writeFileSync(path.join(workDir, 'demo-web', 'src', 'sort.test.ts'), 'test');
const round = { workDir, repos: ['demo-web'] };

const DELIVERY = {
  root_cause: 'sort compares strings',
  summary: 'compare timestamps',
  repro_tests: ['/work/demo-web/src/sort.test.ts'],
  verification: 'vitest run: 1 passed',
};

const pi = await loadRuntime('@cloudcraft/runtime-pi');
const engines: Record<
  string,
  (s: Script) => { runtime: AgentRuntimePlugin; sandbox: AgentSandbox & { commands?: string[] } }
> = {
  'scripted fake engine': (s) => ({
    runtime: scriptedRuntime(s),
    sandbox: {
      start: () => {
        throw new Error('unused');
      },
    },
  }),
  'runtime-pi on a simulated Pi': (s) => ({ runtime: pi, sandbox: simulatedPiSandbox(s) }),
};

async function play(
  engine: string,
  script: Script,
  o: { limits?: Partial<DriveLimits>; abortAfterMs?: number } = {},
) {
  const token = crypto.randomBytes(32).toString('hex');
  const host = createToolHost({ round, allowed: FINISHING_TOOLS, token });
  await new Promise<void>((r) => host.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(host.server.address() as AddressInfo).port}`;
  const { runtime, sandbox } = engines[engine]!(script);
  const ac = new AbortController();
  if (o.abortAfterMs) setTimeout(() => ac.abort(), o.abortAfterMs);
  const stateDir = fs.mkdtempSync(path.join(tmp, 'state-'));
  try {
    const r = await driveAgent({
      runtime,
      ctx: {
        sandbox,
        relay: { url, token },
        model: { api: 'openai-responses', id: 'm' },
        tools: host.decls,
        systemPrompt: 'fix it',
        stateDir,
        resume: false,
        config: {},
      },
      task: 'the bug',
      finished: () => FINISHING_TOOLS.some((t) => host.results.has(t)),
      limits: o.limits,
      signal: ac.signal,
    });
    return { r, host, sandbox, stateDir };
  } finally {
    host.server.close();
  }
}

describe.each(Object.keys(engines))('引擎契约：%s', (engine) => {
  it('宿主工具逐次校验：参数不对、复现文件不存在都被拒，第一次合格的交付被收下，重复交付被拒', async () => {
    const { r, host } = await play(engine, [
      [
        { call: SUBMIT_DELIVERY, params: { root_cause: 'x' } },
        {
          call: SUBMIT_DELIVERY,
          params: { ...DELIVERY, repro_tests: ['demo-web/../../etc/passwd'] },
        },
        { call: SUBMIT_DELIVERY, params: DELIVERY },
        { call: SUBMIT_DELIVERY, params: DELIVERY },
      ],
    ]);
    expect(r).toMatchObject({ stop_reason: 'delivered', follow_up_used: false, tool_errors: 3 });
    expect(host.calls.map((c) => c.status)).toEqual([400, 400, 200, 409]);
    // the host keeps its own normalized copy, not the model's paths
    expect(host.results.get(SUBMIT_DELIVERY)).toEqual({
      ...DELIVERY,
      repro_tests: ['demo-web/src/sort.test.ts'],
    });
    expect(r.engine_usage.input).toBeGreaterThan(0);
  });

  it('纯文本收尾：追问一次后交付；追问后仍不交付就记为没有交付', async () => {
    const once = await play(engine, [
      [{ text: 'I think it is fixed.' }],
      [{ call: SUBMIT_DELIVERY, params: DELIVERY }],
    ]);
    expect(once.r).toMatchObject({ stop_reason: 'delivered', follow_up_used: true });
    const never = await play(engine, [[{ text: 'done' }], [{ text: 'really done' }]]);
    expect(never.r).toMatchObject({ stop_reason: 'no_delivery', follow_up_used: true });
  });

  it('熔断：同一个调用连续失败 3 次、回合数到顶、超时，都中止引擎', async () => {
    const fail = { fail: 'bash', summary: 'pnpm exec vitest run' };
    const errors = await play(engine, [[fail, fail, fail, { hang: true }]]);
    expect(errors.r).toMatchObject({ stop_reason: 'tool_errors', tool_errors: 3 });
    // different failing calls in a row are normal work (a repro test is supposed to fail first)
    const mixed = await play(engine, [
      [
        fail,
        { fail: 'bash', summary: 'pnpm exec tsc' },
        fail,
        { call: SUBMIT_DELIVERY, params: DELIVERY },
      ],
    ]);
    expect(mixed.r.stop_reason).toBe('delivered');
    const turns = await play(
      engine,
      [[{ text: 'a' }, { text: 'b' }, { text: 'c' }, { hang: true }]],
      {
        limits: { maxTurns: 2 },
      },
    );
    expect(turns.r.stop_reason).toBe('max_turns');
    const slow = await play(engine, [[{ hang: true }]], { limits: { timeoutMs: 100 } });
    expect(slow.r.stop_reason).toBe('timeout');
  });

  it('租约丢了就中止；引擎进程崩了记为崩溃，不追问', async () => {
    const lost = await play(engine, [[{ hang: true }]], { abortAfterMs: 50 });
    expect(lost.r.stop_reason).toBe('aborted');
    const crash = await play(engine, [[{ crash: true }]]);
    expect(crash.r).toMatchObject({ stop_reason: 'engine_crashed', follow_up_used: false });
  });
});

describe('runtime-pi 插件', () => {
  it('按契约加载；容器里只连中继，令牌代替密钥，只挂本节点允许的宿主工具，关掉自动发现', async () => {
    expect(pi.manifest.capabilities.supportsMidRunSteer).toBe(true);
    const { stateDir, sandbox } = await play('runtime-pi on a simulated Pi', [
      [{ call: SUBMIT_DELIVERY, params: DELIVERY }],
    ]);
    const models = JSON.parse(fs.readFileSync(path.join(stateDir, 'agent', 'models.json'), 'utf8'));
    const provider = Object.values(models.providers)[0] as { baseUrl: string; apiKey: string };
    expect(provider.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/llm$/);
    expect(provider.apiKey).toMatch(/^[0-9a-f]{64}$/);
    const tools = JSON.parse(fs.readFileSync(path.join(stateDir, 'agent', 'tools.json'), 'utf8'));
    expect(tools.map((t: { name: string }) => t.name)).toEqual([SUBMIT_DELIVERY]);
    const cmd = sandbox.commands![0]!;
    expect(cmd).toContain('--tools read,bash,edit,write,submit_delivery');
    expect(cmd).toContain('--no-context-files');
    expect(cmd).toContain('--offline');
  });

  it('不是引擎插件的模块不能加载', async () => {
    await expect(loadRuntime('@cloudcraft/core-protocol')).rejects.toThrow(/not an engine plugin/);
  });
});

describe('宿主工具端', () => {
  it('没有本轮令牌一律 401；本节点没开放的工具 404', async () => {
    const host = createToolHost({ round, allowed: FINISHING_TOOLS, token: 'a'.repeat(64) });
    await new Promise<void>((r) => host.server.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(host.server.address() as AddressInfo).port}`;
    const post = (tool: string, token: string) =>
      fetch(`${url}/tools/${tool}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify(DELIVERY),
      }).then((r) => r.status);
    expect(await post(SUBMIT_DELIVERY, 'b'.repeat(64))).toBe(401);
    expect(await post('ask_user', 'a'.repeat(64))).toBe(404);
    expect(host.results.size).toBe(0);
    host.server.close();
  });
});
