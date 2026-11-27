// Bot executor process (docs/06 §1.2, §5.3a): `pnpm runner`. Enrolls once with a one-time token,
// then heartbeats cc-app, takes sandbox steps and writes back. No database access, no release
// credentials. Configured from its own environment, not the server's .env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Type, type Static } from 'typebox';
import Value from 'typebox/value';
import { startRunnerLoop, type StepHandler } from './runner/loop.ts';
import { loadOrEnroll } from './runner/identity.ts';
import { httpTransport } from './runner/transport.ts';
import { ensureSandboxImage, killLabeled } from './sandbox/docker.ts';
import { trialBuild } from './steps/trial-build.ts';

const Env = Type.Object({
  CC_RUNNER_SERVER: Type.String({ pattern: '^https?://', default: 'http://127.0.0.1:4100' }),
  CC_DATA_DIR: Type.String({ default: path.join(os.homedir(), '.cloudcraft-dev') }),
  /** where this executor keeps its identity; defaults to <data dir>/runner */
  CC_RUNNER_DIR: Type.Optional(Type.String()),
  CC_RUNNER_ENROLL_TOKEN: Type.Optional(Type.String()),
  CC_RUNNER_GIT_TOKEN: Type.Optional(Type.String()),
  CC_RUNNER_SLOTS: Type.Integer({ minimum: 1, maximum: 32, default: 1 }),
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

const image = ensureSandboxImage(path.resolve(import.meta.dirname, '../../../infra/sandbox'));
const build = trialBuild({
  image: image.tag,
  cacheRoot: path.join(env.CC_DATA_DIR, 'pnpm-store'),
  workRoot,
  gitToken: env.CC_RUNNER_GIT_TOKEN,
  labels: { [LABEL]: creds.runnerId },
});
const handlerFor = (step: {
  node_kind: string;
  config: Record<string, unknown>;
}): StepHandler | null => (step.config.action === 'trial_build' ? build : null);

const loop = startRunnerLoop({ transport, creds, slots: env.CC_RUNNER_SLOTS, handlerFor, log });
log(`up, ${env.CC_RUNNER_SLOTS} slot(s), sandbox image ${image.tag}`);
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.once(sig, () => {
    log('draining: finishing running steps, taking no new ones');
    void loop.stop().then(() => process.exit(0));
  });
