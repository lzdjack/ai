// Launching Pi inside the sandbox container (docs/06 §5.4, §11.1).
// Pi runs as `pi --mode rpc` with a provider that points at the relay; the round token stands in
// for the API key, and the model proxy on the host swaps in the real key.
import fs from 'node:fs';
import path from 'node:path';
import type { HostToolDecl, ModelApi } from '@cloudcraft/core-protocol';

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

/** Where things live inside the container; the plugin's state dir is mounted at `round`. */
export const PI_PATHS = {
  round: '/round',
  agentDir: '/round/agent',
  sessionDir: '/round/session',
  systemPrompt: '/round/system.md',
  extensionDir: '/opt/cc-pi',
} as const;

/** Host directory to mount read-only at PI_PATHS.extensionDir. */
export const EXTENSION_SRC = import.meta.dirname;

const PROVIDER = 'cc';
/** Pi's own tools, limited to the work dir by the container */
const BUILTIN_TOOLS = ['read', 'bash', 'edit', 'write'];

/** Writes the round's Pi config into `stateDir`. */
export function writePiRoundFiles(o: {
  stateDir: string;
  model: { api: ModelApi; id: string };
  thinking: ThinkingLevel;
  relay: { url: string; token: string };
  tools: HostToolDecl[];
  systemPrompt: string;
}): void {
  const agentDir = path.join(o.stateDir, 'agent');
  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(o.stateDir, 'session'), { recursive: true });
  const models = {
    providers: {
      [PROVIDER]: {
        name: 'CloudCraft model proxy',
        baseUrl: `${o.relay.url}/llm`,
        api: o.model.api,
        apiKey: o.relay.token,
        models: [{ id: o.model.id, reasoning: o.thinking !== 'off' }],
      },
    },
  };
  fs.writeFileSync(path.join(agentDir, 'models.json'), JSON.stringify(models, null, 2));
  fs.writeFileSync(path.join(agentDir, 'bridge.json'), JSON.stringify(o.relay));
  fs.writeFileSync(path.join(agentDir, 'tools.json'), JSON.stringify(o.tools));
  fs.writeFileSync(path.join(o.stateDir, 'system.md'), o.systemPrompt);
}

/**
 * Shell command for the container. Everything Pi would discover on its own (context files,
 * project extensions, skills, prompt templates, MCP) is off: repo content is untrusted material.
 */
export function piCommand(o: {
  model: string;
  thinking: ThinkingLevel;
  tools: string[];
  continueSession: boolean;
}): string {
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  return [
    'pi',
    '--mode rpc',
    `--provider ${PROVIDER}`,
    `--model ${q(o.model)}`,
    `--thinking ${o.thinking}`,
    `--session-dir ${PI_PATHS.sessionDir}`,
    ...(o.continueSession ? ['--continue'] : []),
    `-e ${PI_PATHS.extensionDir}/extension.ts`,
    `--tools ${[...BUILTIN_TOOLS, ...o.tools].join(',')}`,
    '--no-extensions --no-skills --no-prompt-templates --no-themes --no-mcp',
    '--no-context-files --no-approve --offline',
    `--append-system-prompt ${PI_PATHS.systemPrompt}`,
  ].join(' ');
}

export const PI_ENV = { PI_CODING_AGENT_DIR: PI_PATHS.agentDir };
