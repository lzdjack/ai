// The Pi engine as an AgentRuntimePlugin (docs/06 §5.4, §11.4): the whole Pi process runs in the
// sandbox container the executor hands over, driven over stdio (`pi --mode rpc`); host tools are
// registered by the in-container extension and forwarded through the relay.
import type {
  AgentEvent,
  AgentRunEnd,
  AgentRuntimePlugin,
  AgentSession,
  AgentStartContext,
} from '@cloudcraft/core-protocol';
import { Type } from 'typebox';
import Value from 'typebox/value';
import { PiRpc, type PiEvent } from './rpc.ts';
import {
  EXTENSION_SRC,
  PI_ENV,
  PI_PATHS,
  piCommand,
  writePiRoundFiles,
  type ThinkingLevel,
} from './session.ts';

const PiConfig = Type.Object({
  thinking: Type.Union(
    [Type.Literal('off'), Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')],
    { default: 'medium' },
  ),
});

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

/** Pi's RPC records → the shared event shape. */
export function translate(e: PiEvent): AgentEvent[] {
  switch (e.type) {
    case 'tool_execution_start': {
      const a = (e.args ?? {}) as Record<string, unknown>;
      const summary = str(a.command) || str(a.path) || str(a.file_path);
      return [{ type: 'tool_start', tool: str(e.toolName), summary: summary.slice(0, 200) }];
    }
    case 'tool_execution_end':
      return [{ type: 'tool_end', tool: str(e.toolName), is_error: e.isError === true }];
    case 'turn_end':
      return [{ type: 'turn_end' }];
    case 'message_end': {
      const m = (e.message ?? {}) as {
        role?: string;
        content?: Array<{ type: string; text?: string }>;
        usage?: Record<string, unknown>;
      };
      if (m.role !== 'assistant') return [];
      const out: AgentEvent[] = [];
      const text = (m.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      if (text) out.push({ type: 'text', text });
      if (m.usage)
        out.push({
          type: 'usage',
          input: num(m.usage.input),
          output: num(m.usage.output),
          cache_read: num(m.usage.cacheRead),
        });
      return out;
    }
    case 'message_update': {
      const ev = e.assistantMessageEvent as { type?: string; error?: unknown } | undefined;
      return ev?.type === 'error'
        ? [{ type: 'error', message: JSON.stringify(ev.error).slice(0, 500) }]
        : [];
    }
    default:
      return [];
  }
}

async function start(ctx: AgentStartContext): Promise<AgentSession> {
  const cfg = Value.Default(PiConfig, structuredClone(ctx.config)) as { thinking: ThinkingLevel };
  if (!Value.Check(PiConfig, cfg)) throw new Error('invalid Pi settings');
  writePiRoundFiles({
    stateDir: ctx.stateDir,
    model: ctx.model,
    thinking: cfg.thinking,
    relay: ctx.relay,
    tools: ctx.tools,
    systemPrompt: ctx.systemPrompt,
  });
  const proc = ctx.sandbox.start({
    command: piCommand({
      model: ctx.model.id,
      thinking: cfg.thinking,
      tools: ctx.tools.map((t) => t.name),
      continueSession: ctx.resume,
    }),
    env: PI_ENV,
    mounts: [
      { host: ctx.stateDir, container: PI_PATHS.round },
      { host: EXTENSION_SRC, container: PI_PATHS.extensionDir, readonly: true },
    ],
  });
  const rpc = new PiRpc(proc);
  const listeners = new Set<(e: AgentEvent) => void>();
  rpc.on((e) => {
    for (const a of translate(e)) for (const l of listeners) l(a);
  });
  let exited = false;
  const gone = proc.exited.then((code) => {
    exited = true;
    return code;
  });
  let aborting = false;

  return {
    async run(message): Promise<AgentRunEnd> {
      aborting = false;
      const settled = rpc.waitFor((e) => e.type === 'agent_settled', 24 * 3600_000);
      const accepted = await Promise.race([rpc.send({ type: 'prompt', message }), gone]);
      if (exited || typeof accepted !== 'object' || accepted === null)
        return { reason: 'crashed', error: 'engine exited' };
      if (!accepted.success)
        return { reason: 'crashed', error: accepted.error ?? 'prompt refused' };
      const end = await Promise.race([settled.then(() => 'settled' as const), gone]);
      if (end !== 'settled') return { reason: 'crashed', error: `engine exited (${end})` };
      return { reason: aborting ? 'aborted' : 'settled' };
    },
    async steer(message) {
      await rpc.send({ type: 'steer', message });
    },
    async abort() {
      aborting = true;
      if (!exited) await Promise.race([rpc.send({ type: 'abort' }), gone]);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async close() {
      rpc.close();
      const r = await Promise.race([
        gone,
        new Promise((ok) => setTimeout(() => ok('late'), 15_000)),
      ]);
      if (r === 'late') proc.kill();
    },
  };
}

export const piRuntime: AgentRuntimePlugin = {
  manifest: {
    id: 'runtime-pi',
    name: 'Pi',
    version: '1.5.2',
    configSchema: PiConfig,
    capabilities: {
      supportsMidRunSteer: true,
      supportsThinkingStream: true,
      // a custom provider has no price table; the model proxy counts tokens instead
      supportsExactTokenCost: false,
      supportsCrossNodeResume: true,
      supportsContextHook: false,
    },
  },
  start,
};
