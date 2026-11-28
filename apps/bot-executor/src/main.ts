// Bot executor process (docs/06 §1.2, §5.3a): `pnpm runner`. Enrolls once with a one-time token,
// then heartbeats cc-app, takes sandbox steps and writes back. No database access, no release
// credentials. Configured from its own environment, not the server's .env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Type, type Static } from 'typebox';
import Value from 'typebox/value';
import { proxyClient } from './agent/proxy-client.ts';
import { loadRuntime } from './agent/registry.ts';
import { startRunnerLoop, type StepHandler } from './runner/loop.ts';
import { gitAuthSource } from './runner/credentials.ts';
import { loadOrEnroll } from './runner/identity.ts';
import { httpTransport } from './runner/transport.ts';
import { ensureSandboxImage, killLabeled } from './sandbox/docker.ts';
import { fixStep } from './steps/fix.ts';
import { prepareStep } from './steps/prepare.ts';
import { replayStep } from './steps/replay.ts';
import { trialBuild } from './steps/trial-build.ts';
import { Workspaces } from './steps/workspace.ts';

const Env = Type.Object({
  CC_RUNNER_SERVER: Type.String({ pattern: '^https?://', default: 'http://127.0.0.1:4100' }),
  CC_DATA_DIR: Type.String({ default: path.join(os.homedir(), '.cloudcraft-dev') }),
  /** where this executor keeps its identity; defaults to <data dir>/runner */
  CC_RUNNER_DIR: Type.Optional(Type.String()),
  CC_RUNNER_ENROLL_TOKEN: Type.Optional(Type.String()),
  CC_RUNNER_GIT_TOKEN: Type.Optional(Type.String()),
  CC_RUNNER_SLOTS: Type.Integer({ minimum: 1, maximum: 32, default: 1 }),
  /** engine plugin to load (module name; its default export is an AgentRuntimePlugin) */
  CC_AGENT_RUNTIME: Type.String({ default: '@cloudcraft/runtime-pi' }),
  /** the model proxy's control socket; defaults to <data dir>/run/llm-proxy.sock */
  CC_LLM_PROXY_SOCKET: Type.Optional(Type.String()),
});
type Env = Static<typeof Env>;

const raw = Object.fromEntries(
  Object.keys(Env.properties).flatMap((k) => (process.env[k] ? [[k, process.env[k]]] : [])),
);
const env = Value.Default(Env, Value.Convert(Env, raw)) as Env;
if (!Value.Check(Env, env)) {
  console.error(
    'invalid executor config:',
    [...Value.Errors(Env, env)].map((e) => e.instancePath).join(', '),
  );
  process.exit(1);
}
const dir = env.CC_RUNNER_DIR ?? path.join(env.CC_DATA_DIR, 'runner');
const log = (m: string) => console.log(`[runner] ${m}`);

const transport = httpTransport(env.CC_RUNNER_SERVER);
const creds = await loadOrEnroll({
  dir,
  server: env.CC_RUNNER_SERVER,
  transport,
  enrollToken: env.CC_RUNNER_ENROLL_TOKEN,
});
log(`${creds.enrolled ? 'enrolled as' : 'signed in as'} ${creds.runnerId}`);

// a previous run of this executor may have died mid-step: its containers and work dirs are stale
// (the server reclaims its leases on its own)
const LABEL = 'cloudcraft.runner';
const workRoot = path.join(env.CC_DATA_DIR, 'sandboxes', `runner-${creds.runnerId}`);
const leftovers = killLabeled(LABEL, creds.runnerId);
fs.rmSync(workRoot, { recursive: true, force: true });
if (leftovers) log(`killed ${leftovers} container(s) left from a previous run`);

const sandboxDir = path.resolve(import.meta.dirname, '../../../infra/sandbox');
const image = ensureSandboxImage(sandboxDir);
const labels = { [LABEL]: creds.runnerId };
const cacheRoot = path.join(env.CC_DATA_DIR, 'pnpm-store');
const runtime = await loadRuntime(env.CC_AGENT_RUNTIME);
// clone / push credentials: envelopes from the server; the executor's own token only for repos
// without a credential reference (local drills)
const gitAuth = gitAuthSource({
  transport,
  creds,
  keyFile: path.join(dir, 'bot_exec.key'),
  fallbackToken: env.CC_RUNNER_GIT_TOKEN,
});
const workspaces = new Workspaces({ image: image.tag, root: workRoot, cacheRoot, gitAuth, labels });
const handlers: Record<string, StepHandler> = {
  trial_build: trialBuild({
    image: image.tag,
    cacheRoot,
    workRoot,
    gitAuth,
    labels,
  }),
  prepare: prepareStep(workspaces),
  fix: fixStep({
    image: image.tag,
    sandboxDir,
    workspaces,
    proxy: proxyClient(
      env.CC_LLM_PROXY_SOCKET ?? path.join(env.CC_DATA_DIR, 'run', 'llm-proxy.sock'),
    ),
    runtime,
    labels,
  }),
  replay: replayStep({ image: image.tag, workspaces, gitAuth, labels }),
};
/** By node kind; a deterministic_verify node names its check in config.action. */
const handlerFor = (step: { node_kind: string; config: Record<string, unknown> }) => {
  if (step.node_kind === 'host_prepare') return handlers.prepare!;
  if (step.node_kind === 'ai_agent') return handlers.fix!;
  return handlers[String(step.config.action)] ?? null;
};

const loop = startRunnerLoop({
  transport,
  creds,
  slots: env.CC_RUNNER_SLOTS,
  handlerFor,
  onSegmentEnd: (step) => workspaces.release(step.flow_instance_id),
  log,
});
log(
  `up, ${env.CC_RUNNER_SLOTS} slot(s), sandbox image ${image.tag}, engine ${runtime.manifest.name}`,
);
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.once(sig, () => {
    log('draining: finishing running steps, taking no new ones');
    void loop.stop().then(() => process.exit(0));
  });
