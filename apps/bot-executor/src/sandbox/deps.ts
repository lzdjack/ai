// Two-phase dependencies (docs/06 §5.3): prepare online into a shared cache keyed by lockfile hash,
// then install offline inside the --network=none container.
//
// pnpm 12 keeps its store index in SQLite, which cannot be opened on a read-only mount. So the shared
// cache is never mounted into a container: each round gets a copy-on-write clone (APFS clonefile /
// reflink, falling back to a plain copy), mounted at the same path the cache was prepared under.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runContainer, type Mount, type RunResult, type SandboxLimits } from './docker.ts';

export const LOCKFILE = 'pnpm-lock.yaml';

/** Cache key = sandbox image + lockfile; a different image may resolve different native binaries. */
export function depsKey(repoDir: string, image: string): string {
  const lock = fs.readFileSync(path.join(repoDir, LOCKFILE));
  return crypto
    .createHash('sha256')
    .update(image)
    .update('\n')
    .update(lock)
    .digest('hex')
    .slice(0, 16);
}

/** Inside the container the dependency cache always lives here, in both phases. */
const containerDepsDir = (key: string) => `/deps/${key}`;

const pnpmDirs = (key: string) =>
  `--store-dir ${containerDepsDir(key)}/store --cache-dir ${containerDepsDir(key)}/cache`;

export interface PreparedDeps {
  key: string;
  dir: string;
  cached: boolean;
  result: RunResult | null;
}

/**
 * Phase 1 (network on): install from package.json + lockfile only, in a scratch dir inside the
 * container, with lifecycle scripts disabled. The repo is mounted read-only.
 */
export async function prepareDeps(opts: {
  image: string;
  repoDir: string;
  cacheRoot: string;
  limits?: Partial<SandboxLimits>;
  signal?: AbortSignal;
  labels?: Record<string, string>;
}): Promise<PreparedDeps> {
  const key = depsKey(opts.repoDir, opts.image);
  const dir = path.join(opts.cacheRoot, key);
  if (fs.existsSync(path.join(dir, '.ready'))) return { key, dir, cached: true, result: null };

  fs.mkdirSync(opts.cacheRoot, { recursive: true });
  const tmp = `${dir}.tmp-${crypto.randomBytes(4).toString('hex')}`;
  fs.mkdirSync(tmp);
  const result = await runContainer({
    image: opts.image,
    network: 'bridge',
    mounts: [
      { host: opts.repoDir, container: '/src', readonly: true },
      { host: tmp, container: containerDepsDir(key) },
    ],
    workdir: '/tmp',
    script: [
      'set -e',
      'mkdir -p /tmp/prepare',
      `cp /src/package.json /src/${LOCKFILE} /tmp/prepare/`,
      'cd /tmp/prepare',
      `pnpm install --frozen-lockfile --ignore-scripts --ignore-workspace --reporter=append-only ${pnpmDirs(key)}`,
    ].join('\n'),
    limits: opts.limits,
    signal: opts.signal,
    labels: opts.labels,
  });
  if (!result.ok) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return { key, dir, cached: false, result };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  fs.writeFileSync(path.join(dir, '.ready'), new Date().toISOString());
  return { key, dir, cached: false, result };
}

/** Per-round writable clone of a prepared cache; returns the mount for the execute phase. */
export function cloneDepsForRound(prepared: PreparedDeps, roundDir: string) {
  const host = path.join(roundDir, 'deps', prepared.key);
  fs.mkdirSync(path.dirname(host), { recursive: true });
  fs.cpSync(prepared.dir, host, { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
  return { host, container: containerDepsDir(prepared.key) };
}

/** Shell lines that install one repo offline (phase 2) from its cloned cache. */
export function offlineInstallScript(repoPathInContainer: string, key: string): string {
  return `cd ${repoPathInContainer} && pnpm install --offline --frozen-lockfile --ignore-scripts --ignore-workspace --reporter=append-only ${pnpmDirs(key)}`;
}

export interface RoundDepsStep {
  label: string;
  ms: number;
}

/**
 * Both phases for one round, for repos already cloned under `workDir` (mounted at /work):
 * prepare each repo's cache (skipped when cached), clone the caches for this round, then install
 * offline in a --network=none container. Returns the mounts the round's later containers need.
 */
export async function installRoundDeps(opts: {
  image: string;
  workDir: string;
  repos: readonly string[];
  cacheRoot: string;
  roundDir: string;
  limits?: Partial<SandboxLimits>;
  signal?: AbortSignal;
  labels?: Record<string, string>;
}): Promise<
  | { ok: true; mounts: Mount[]; steps: RoundDepsStep[] }
  | { ok: false; label: string; result: RunResult; steps: RoundDepsStep[] }
> {
  const steps: RoundDepsStep[] = [];
  const prepared: Array<[string, PreparedDeps]> = [];
  for (const repo of opts.repos) {
    const p = await prepareDeps({
      image: opts.image,
      repoDir: path.join(opts.workDir, repo),
      cacheRoot: opts.cacheRoot,
      limits: opts.limits,
      signal: opts.signal,
      labels: opts.labels,
    });
    const label = `prepare ${repo}${p.cached ? ' (cached)' : ''}`;
    steps.push({ label, ms: p.result?.ms ?? 0 });
    if (p.result && !p.result.ok) return { ok: false, label, result: p.result, steps };
    prepared.push([repo, p]);
  }

  const cloneStart = Date.now();
  const mounts: Mount[] = [
    { host: opts.workDir, container: '/work' },
    ...prepared.map(([, p]) => cloneDepsForRound(p, opts.roundDir)),
  ];
  steps.push({ label: 'clone caches for this round', ms: Date.now() - cloneStart });

  const install = await runContainer({
    image: opts.image,
    network: 'none',
    mounts,
    script: [
      'set -e',
      ...prepared.map(([repo, p]) => offlineInstallScript(`/work/${repo}`, p.key)),
    ].join('\n'),
    limits: opts.limits,
    signal: opts.signal,
    labels: opts.labels,
  });
  steps.push({ label: 'offline install', ms: install.ms });
  if (!install.ok) return { ok: false, label: 'offline install', result: install, steps };
  return { ok: true, mounts, steps };
}
