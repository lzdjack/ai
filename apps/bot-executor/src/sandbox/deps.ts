// Two-phase dependencies (docs/06 §5.3): prepare online into a shared cache keyed by lockfile hash,
// then install offline inside the --network=none container.
//
// pnpm 12 keeps its store index in SQLite, which cannot be opened on a read-only mount. So the shared
// cache is never mounted into a container: each round gets a copy-on-write clone (APFS clonefile /
// reflink, falling back to a plain copy), mounted at the same path the cache was prepared under.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runContainer, type RunResult, type SandboxLimits } from './docker.ts';

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
