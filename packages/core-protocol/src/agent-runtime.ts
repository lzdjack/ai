// AgentRuntimePlugin (docs/06 §11.4): the one contract every code-fixing engine implements, Pi
// included. The executor owns the sandbox, the model proxy and the host tools; an engine plugin only
// says how to run its agent inside the container it is handed and translates its events. Engine
// specific abilities are capability bits, never branches on a plugin name.
import { Type, type Static, type TSchema } from 'typebox';

/** What an engine can and cannot do; the executor and the UI degrade on these bits only. */
export const AdapterCapabilities = Type.Object({
  supportsMidRunSteer: Type.Boolean(),
  supportsThinkingStream: Type.Boolean(),
  supportsExactTokenCost: Type.Boolean(),
  supportsCrossNodeResume: Type.Boolean(),
  supportsContextHook: Type.Boolean(),
});
export type AdapterCapabilities = Static<typeof AdapterCapabilities>;

export interface AgentRuntimeManifest {
  id: string;
  name: string;
  version: string;
  /** JSON Schema of the engine's settings; the settings page renders from it */
  configSchema: TSchema;
  capabilities: AdapterCapabilities;
}

/** Protocols the model proxy can speak; the engine is configured for the one in use. */
export type ModelApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages';

/** A host tool the engine exposes to its model; calls go to `${relay.url}/tools/<name>`. */
export interface HostToolDecl {
  name: string;
  label: string;
  description: string;
  /** JSON Schema of the parameters (the host validates every call again) */
  parameters: TSchema;
}

export interface SandboxMount {
  host: string;
  container: string;
  readonly?: boolean;
}

/** A running container whose stdio the engine drives. */
export interface SandboxProcess {
  stdin: { write(chunk: string): unknown; end(): unknown };
  stdout: { on(event: 'data', fn: (chunk: Uint8Array) => void): unknown };
  /** resolves with the exit code once the container is gone */
  exited: Promise<number | null>;
  kill(): void;
}

/**
 * Handed to the engine by the executor: the container is already on the round's isolated network,
 * with the repos at /work and resource limits and labels set. The engine adds its own mounts.
 */
export interface AgentSandbox {
  start(o: {
    command: string;
    env?: Record<string, string>;
    mounts?: SandboxMount[];
  }): SandboxProcess;
}

export interface AgentStartContext {
  sandbox: AgentSandbox;
  /** how the container reaches the model proxy and the host tools; the token is per round */
  relay: { url: string; token: string };
  model: { api: ModelApi; id: string };
  tools: HostToolDecl[];
  /** fixed instructions; the engine appends them to its own system prompt */
  systemPrompt: string;
  /** host directory for the engine's files and session state, kept for the whole round */
  stateDir: string;
  /** continue the session kept in stateDir instead of starting a new one */
  resume: boolean;
  /** engine settings, validated against manifest.configSchema */
  config: Record<string, unknown>;
}

/** Engine events, translated to one shape (the trajectory is these, one JSON per line). */
export type AgentEvent =
  | { type: 'tool_start'; tool: string; summary: string }
  | { type: 'tool_end'; tool: string; is_error: boolean }
  | { type: 'turn_end' }
  | { type: 'text'; text: string }
  | { type: 'usage'; input: number; output: number; cache_read: number }
  | { type: 'error'; message: string };

export interface AgentRunEnd {
  /** settled: the agent stopped on its own; aborted: abort() was called; crashed: the engine died */
  reason: 'settled' | 'aborted' | 'crashed';
  error?: string;
}

export interface AgentSession {
  /** sends a user message and resolves when the agent stops working */
  run(message: string): Promise<AgentRunEnd>;
  /** only when capabilities.supportsMidRunSteer: delivered after the running tool finishes */
  steer?(message: string): Promise<void>;
  /** stops the current run; run() then resolves with reason 'aborted' */
  abort(): Promise<void>;
  on(fn: (e: AgentEvent) => void): () => void;
  /** ends the engine process; the session state stays in stateDir */
  close(): Promise<void>;
}

export interface AgentRuntimePlugin {
  manifest: AgentRuntimeManifest;
  start(ctx: AgentStartContext): Promise<AgentSession>;
}

/** Ends of one AI node run (stop_reason in the node's output). */
export const AGENT_STOP_REASONS = [
  'delivered',
  'no_delivery',
  'timeout',
  'max_turns',
  'tool_errors',
  'engine_crashed',
  'aborted',
] as const;
export type AgentStopReason = (typeof AGENT_STOP_REASONS)[number];
