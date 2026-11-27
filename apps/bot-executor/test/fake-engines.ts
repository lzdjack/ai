// Scripted engines for the engine contract tests (docs/06 §11.4 §3): the same script runs on
//  - a fake AgentRuntimePlugin that acts directly (proves the contract does not depend on Pi), and
//  - the real runtime-pi plugin on a simulated `pi --mode rpc` process (proves the plugin keeps the
//    contract: its config files, its RPC driving, its event translation), with no Docker and no model.
// Both call host tools over HTTP the way the in-container side would.
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type {
  AgentEvent,
  AgentRunEnd,
  AgentRuntimePlugin,
  AgentSandbox,
  AgentStartContext,
} from '@cloudcraft/core-protocol';

/** What the agent does in one run (one user message). */
export type Action =
  | { call: string; params: unknown }
  | { text: string }
  | { fail: string; summary: string }
  | { crash: true }
  | { hang: true };
export type Script = Action[][];

async function callTool(relay: { url: string; token: string }, tool: string, params: unknown) {
  const res = await fetch(`${relay.url}/tools/${tool}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${relay.token}` },
    body: JSON.stringify(params),
  });
  return res.ok;
}

const USAGE = { input: 10, output: 2, cache_read: 5 };

/** A plugin that is not Pi, with no steering (capability off). */
export function scriptedRuntime(script: Script): AgentRuntimePlugin {
  return {
    manifest: {
      id: 'runtime-scripted',
      name: 'Scripted',
      version: '0',
      configSchema: {} as never,
      capabilities: {
        supportsMidRunSteer: false,
        supportsThinkingStream: false,
        supportsExactTokenCost: false,
        supportsCrossNodeResume: false,
        supportsContextHook: false,
      },
    },
    async start(ctx: AgentStartContext) {
      const runs = [...script];
      const listeners = new Set<(e: AgentEvent) => void>();
      const emit = (e: AgentEvent) => listeners.forEach((l) => l(e));
      let abort: (() => void) | null = null;
      let aborted = false;
      return {
        async run(): Promise<AgentRunEnd> {
          aborted = false;
          for (const a of runs.shift() ?? []) {
            if (aborted) return { reason: 'aborted' };
            if ('crash' in a) return { reason: 'crashed', error: 'boom' };
            if ('hang' in a) {
              await new Promise<void>((ok) => (abort = ok));
              return { reason: 'aborted' };
            }
            if ('text' in a) emit({ type: 'text', text: a.text });
            if ('fail' in a) {
              emit({ type: 'tool_start', tool: a.fail, summary: a.summary });
              emit({ type: 'tool_end', tool: a.fail, is_error: true });
            }
            if ('call' in a) {
              const allowed = ctx.tools.some((t) => t.name === a.call);
              emit({ type: 'tool_start', tool: a.call, summary: '' });
              const ok = allowed && (await callTool(ctx.relay, a.call, a.params));
              emit({ type: 'tool_end', tool: a.call, is_error: !ok });
            }
            emit({ type: 'turn_end' });
          }
          emit({ type: 'usage', ...USAGE });
          return { reason: aborted ? 'aborted' : 'settled' };
        },
        async abort() {
          aborted = true;
          abort?.();
        },
        on(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
        async close() {},
      };
    },
  };
}

/**
 * A sandbox whose "container" is a simulated `pi --mode rpc`: it reads the plugin's config files
 * from the mounted state dir (as the extension does) and answers RPC commands by playing the script.
 */
export function simulatedPiSandbox(script: Script): AgentSandbox & { commands: string[] } {
  const commands: string[] = [];
  return {
    commands,
    start({ command, mounts }) {
      commands.push(command);
      const roundDir = mounts!.find((m) => m.container === '/round')!.host;
      const read = <T>(f: string) =>
        JSON.parse(fs.readFileSync(path.join(roundDir, 'agent', f), 'utf8')) as T;
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      let exit!: (code: number | null) => void;
      const exited = new Promise<number | null>((ok) => (exit = ok));
      const out = (e: object) => stdout.write(`${JSON.stringify(e)}\n`);
      const runs = [...script];
      let wake: (() => void) | null = null;

      async function play(id: string) {
        out({ type: 'response', id, command: 'prompt', success: true });
        out({ type: 'agent_start' });
        for (const a of runs.shift() ?? []) {
          if ('crash' in a) return exit(137);
          if ('hang' in a) {
            await new Promise<void>((ok) => (wake = ok));
            break;
          }
          if ('text' in a)
            out({
              type: 'message_end',
              message: { role: 'assistant', content: [{ type: 'text', text: a.text }] },
            });
          if ('fail' in a) {
            out({ type: 'tool_execution_start', toolName: a.fail, args: { command: a.summary } });
            out({ type: 'tool_execution_end', toolName: a.fail, isError: true });
          }
          if ('call' in a) {
            // Pi only offers the tools the extension registered from tools.json
            const declared = read<{ name: string }[]>('tools.json').some((t) => t.name === a.call);
            out({ type: 'tool_execution_start', toolName: a.call, args: a.params });
            const ok = declared && (await callTool(read('bridge.json'), a.call, a.params));
            out({ type: 'tool_execution_end', toolName: a.call, isError: !ok });
          }
          out({ type: 'turn_end' });
        }
        out({
          type: 'message_end',
          message: {
            role: 'assistant',
            content: [],
            usage: { input: USAGE.input, output: USAGE.output, cacheRead: USAGE.cache_read },
          },
        });
        out({ type: 'agent_settled' });
      }

      let buf = '';
      stdin.on('data', (d: Buffer) => {
        buf += d.toString();
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const cmd = JSON.parse(buf.slice(0, nl)) as { type: string; id: string };
          buf = buf.slice(nl + 1);
          if (cmd.type === 'prompt') void play(cmd.id);
          if (cmd.type === 'abort') {
            out({ type: 'response', id: cmd.id, command: 'abort', success: true });
            wake?.();
          }
        }
      });
      stdin.on('end', () => exit(0));
      return { stdin, stdout, exited, kill: () => exit(137) };
    },
  };
}
