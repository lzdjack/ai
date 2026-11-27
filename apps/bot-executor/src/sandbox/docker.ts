// Container runner for the code/build sandbox (docs/06 §5.3).
// Every container: non-root, all capabilities dropped, read-only rootfs, resource limits.
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Defaults follow the compact tier build slot in 06 §5.3a; callers override per executor config. */
export interface SandboxLimits {
  memory: string;
  cpus: number;
  pids: number;
  nodeMaxOldSpaceMb: number;
  timeoutMs: number;
}

export const DEFAULT_LIMITS: SandboxLimits = {
  memory: '3g',
  cpus: 2,
  pids: 1024,
  nodeMaxOldSpaceMb: 2560,
  timeoutMs: 15 * 60_000,
};

export interface Mount {
  host: string;
  container: string;
  readonly?: boolean;
}

export interface RunOptions {
  image: string;
  /**
   * 'none' for the execute phase; 'bridge' only for the prepare phase; otherwise the name of this
   * round's --internal network (Docker Desktop / OrbStack, see relay.ts).
   */
  network: 'none' | 'bridge' | (string & {});
  mounts: Mount[];
  script: string;
  workdir?: string;
  env?: Record<string, string>;
  limits?: Partial<SandboxLimits>;
  /** aborting kills the container (e.g. the runner lost its lease) */
  signal?: AbortSignal;
  /** docker labels, e.g. which executor started it, so leftovers can be found after a crash */
  labels?: Record<string, string>;
}

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
  ms: number;
}

const MAX_OUTPUT = 1024 * 1024;

function containerArgs(opts: RunOptions, name: string, interactive: boolean): string[] {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const env: Record<string, string> = {
    CI: 'true',
    NODE_OPTIONS: `--max-old-space-size=${limits.nodeMaxOldSpaceMb}`,
    ...opts.env,
  };
  return [
    'run',
    '--rm',
    ...(interactive ? ['-i'] : []),
    '--name',
    name,
    `--network=${opts.network}`,
    '--user=1000:1000',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--read-only',
    '--tmpfs=/tmp:rw,exec,size=1g',
    '--tmpfs=/home/node:rw,size=256m',
    `--memory=${limits.memory}`,
    `--memory-swap=${limits.memory}`,
    `--cpus=${limits.cpus}`,
    `--pids-limit=${limits.pids}`,
    ...Object.entries(opts.labels ?? {}).map(([k, v]) => `--label=${k}=${v}`),
    ...opts.mounts.map((m) => `--volume=${m.host}:${m.container}${m.readonly ? ':ro' : ''}`),
    ...Object.entries(env).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
    `--workdir=${opts.workdir ?? '/work'}`,
    opts.image,
    'sh',
    '-c',
    opts.script,
  ];
}

export interface StartedContainer {
  name: string;
  /** stdin/stdout belong to the caller (e.g. a JSONL RPC client); stderr is collected into `done` */
  child: ChildProcessWithoutNullStreams;
  done: Promise<RunResult>;
  kill(): void;
}

/** Long-running container with stdin attached; used to drive an AI engine over stdio. */
export function startContainer(opts: RunOptions): StartedContainer {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const name = `cc-sbx-${crypto.randomBytes(6).toString('hex')}`;
  const started = Date.now();
  const child = spawn('docker', containerArgs(opts, name, true), { stdio: 'pipe' });
  let output = '';
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString();
    if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
  });
  const kill = () => spawnSync('docker', ['kill', name], { stdio: 'ignore' });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, limits.timeoutMs);
  const done = new Promise<RunResult>((resolve) => {
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: code,
        timedOut,
        output,
        ms: Date.now() - started,
      });
    });
  });
  return { name, child, done, kill };
}

export function runContainer(opts: RunOptions): Promise<RunResult> {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const name = `cc-sbx-${crypto.randomBytes(6).toString('hex')}`;
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('docker', containerArgs(opts, name, false), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let timedOut = false;
    const kill = () => spawnSync('docker', ['kill', name], { stdio: 'ignore' });
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, limits.timeoutMs);
    if (opts.signal?.aborted) kill();
    opts.signal?.addEventListener('abort', kill, { once: true });
    child.on('close', (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', kill);
      resolve({
        ok: code === 0 && !timedOut,
        exitCode: code,
        timedOut,
        output,
        ms: Date.now() - started,
      });
    });
  });
}

/**
 * Image tag is derived from the Dockerfile content, so editing the Dockerfile yields a new tag
 * and the image is rebuilt on next use.
 */
export function sandboxImageTag(contextDir: string): string {
  const content = fs.readFileSync(path.join(contextDir, 'Dockerfile'));
  return `cloudcraft/sandbox:${crypto.createHash('sha256').update(content).digest('hex').slice(0, 12)}`;
}

export function ensureSandboxImage(contextDir: string): {
  tag: string;
  built: boolean;
  ms: number;
} {
  const tag = sandboxImageTag(contextDir);
  const started = Date.now();
  if (spawnSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' }).status === 0)
    return { tag, built: false, ms: 0 };
  const r = spawnSync('docker', ['build', '-q', '-t', tag, contextDir], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`sandbox image build failed: ${r.stderr.trim()}`);
  return { tag, built: true, ms: Date.now() - started };
}

/** Kills containers left behind by a process that died (they carry its label). Returns how many. */
export function killLabeled(label: string, value: string): number {
  const r = spawnSync('docker', ['ps', '-q', '--filter', `label=${label}=${value}`], {
    encoding: 'utf8',
  });
  const ids = r.stdout.split('\n').filter(Boolean);
  if (ids.length) spawnSync('docker', ['kill', ...ids], { stdio: 'ignore' });
  return ids.length;
}
