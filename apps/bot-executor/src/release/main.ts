// Release executor process (docs/06 §1.2, §2.10): `pnpm release-runner`. Enrolls with its own
// release_exec key pair (a separate runner with the 'release' role), heartbeats cc-app, takes merge /
// publish / release / verify steps and writes back. No database, no sandbox, no repository code: it
// only loads the fixed connector plugins listed in its own environment.
import os from 'node:os';
import path from 'node:path';
import type { ConnectorPlugin } from '@cloudcraft/core-protocol';
import { Type, type Static } from 'typebox';
import Value from 'typebox/value';
import { loadOrEnroll } from '../runner/identity.ts';
import { startRunnerLoop } from '../runner/loop.ts';
import { httpTransport } from '../runner/transport.ts';
import { releaseHandlers } from './steps.ts';

const Env = Type.Object({
  CC_RUNNER_SERVER: Type.String({ pattern: '^https?://', default: 'http://127.0.0.1:4100' }),
  CC_DATA_DIR: Type.String({ default: path.join(os.homedir(), '.cloudcraft-dev') }),
  /** where this executor keeps its identity; defaults to <data dir>/release-runner */
  CC_RUNNER_DIR: Type.Optional(Type.String()),
  CC_RUNNER_ENROLL_TOKEN: Type.Optional(Type.String()),
  CC_RUNNER_SLOTS: Type.Integer({ minimum: 1, maximum: 8, default: 2 }),
  CC_CONNECTOR_PLUGINS: Type.String({
    default: '@cloudcraft/connector-gitlab,@cloudcraft/connector-tita-apollo',
  }),
});
type Env = Static<typeof Env>;

const raw = Object.fromEntries(
  Object.keys(Env.properties).flatMap((k) => (process.env[k] ? [[k, process.env[k]]] : [])),
);
const env = Value.Default(Env, Value.Convert(Env, raw)) as Env;
if (!Value.Check(Env, env)) {
  console.error(
    'invalid release executor config:',
    [...Value.Errors(Env, env)].map((e) => e.instancePath).join(', '),
  );
  process.exit(1);
}
const dir = env.CC_RUNNER_DIR ?? path.join(env.CC_DATA_DIR, 'release-runner');
const log = (m: string) => console.log(`[release] ${m}`);

const plugins = new Map<string, ConnectorPlugin>();
for (const spec of env.CC_CONNECTOR_PLUGINS.split(',')
  .map((x) => x.trim())
  .filter(Boolean)) {
  const p = ((await import(spec)) as { default?: ConnectorPlugin }).default;
  if (!p?.manifest?.id) throw new Error(`${spec} is not a connector plugin`);
  plugins.set(p.manifest.id, p);
}

const transport = httpTransport(env.CC_RUNNER_SERVER);
const creds = await loadOrEnroll({
  dir,
  server: env.CC_RUNNER_SERVER,
  transport,
  enrollToken: env.CC_RUNNER_ENROLL_TOKEN,
  keyRole: 'release_exec',
});
log(`${creds.enrolled ? 'enrolled as' : 'signed in as'} ${creds.runnerId}`);

const handlers = releaseHandlers({
  transport,
  creds,
  keyFile: path.join(dir, 'release_exec.key'),
  plugins,
});
const loop = startRunnerLoop({
  transport,
  creds,
  slots: env.CC_RUNNER_SLOTS,
  handlerFor: (step) => handlers[String(step.config.action)] ?? null,
  log,
});
log(`up, ${env.CC_RUNNER_SLOTS} slot(s), plugins ${[...plugins.keys()].join(', ')}`);
for (const sig of ['SIGINT', 'SIGTERM'] as const)
  process.once(sig, () => {
    log('draining: finishing running steps, taking no new ones');
    void loop.stop().then(() => process.exit(0));
  });
