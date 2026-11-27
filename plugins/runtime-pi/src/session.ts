// Launching Pi inside the sandbox container (docs/06 §5.4, §11.1).
// Pi runs as `pi --mode rpc` with a provider that points at the relay; the round token stands in
// for the API key, and the model proxy on the host swaps in the real key.
import fs from 'node:fs';
import path from 'node:path';

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export interface PiModelConfig {
  api: 'openai-completions' | 'openai-responses' | 'anthropic-messages';
  model: string;
  thinking: ThinkingLevel;
}

/** Where things live inside the container. */
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
const TOOLS = ['read', 'bash', 'edit', 'write', 'submit_delivery'];

/** Writes the round's Pi config into `hostRoundDir` (mounted at PI_PATHS.round). */
export function writePiRoundFiles(opts: {
  hostRoundDir: string;
  model: PiModelConfig;
  relayUrl: string;
  token: string;
  systemPrompt: string;
}): void {
  const agentDir = path.join(opts.hostRoundDir, 'agent');
  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(opts.hostRoundDir, 'session'), { recursive: true });
  const models = {
    providers: {
      [PROVIDER]: {
        name: 'CloudCraft model proxy',
        baseUrl: `${opts.relayUrl}/llm`,
        api: opts.model.api,
        apiKey: opts.token,
        models: [{ id: opts.model.model, reasoning: opts.model.thinking !== 'off' }],
      },
    },
  };
  fs.writeFileSync(path.join(agentDir, 'models.json'), JSON.stringify(models, null, 2));
  fs.writeFileSync(
    path.join(agentDir, 'bridge.json'),
    JSON.stringify({ url: opts.relayUrl, token: opts.token }),
  );
  fs.writeFileSync(path.join(opts.hostRoundDir, 'system.md'), opts.systemPrompt);
}

/**
 * Shell command for the container. Everything Pi would discover on its own (context files,
 * project extensions, skills, prompt templates, MCP) is off: repo content is untrusted material.
 */
export function piCommand(opts: { model: PiModelConfig; continueSession?: boolean }): string {
  const args = [
    'pi',
    '--mode rpc',
    `--provider ${PROVIDER}`,
    `--model '${opts.model.model}'`,
    `--thinking ${opts.model.thinking}`,
    `--session-dir ${PI_PATHS.sessionDir}`,
    ...(opts.continueSession ? ['--continue'] : []),
    `-e ${PI_PATHS.extensionDir}/extension.ts`,
    `--tools ${TOOLS.join(',')}`,
    '--no-extensions --no-skills --no-prompt-templates --no-themes --no-mcp',
    '--no-context-files --no-approve --offline',
    `--append-system-prompt ${PI_PATHS.systemPrompt}`,
  ];
  return args.join(' ');
}

export const PI_ENV = { PI_CODING_AGENT_DIR: PI_PATHS.agentDir };
