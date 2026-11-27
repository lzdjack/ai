// Container runner for the code/build sandbox (docs/06 §5.3).
// Every container: non-root, all capabilities dropped, read-only rootfs, resource limits.
import { spawn, spawnSync } from 'node:child_process';
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
  /** 'none' for the execute phase; 'bridge' only for the prepare phase */
  network: 'none' | 'bridge';
  mounts: Mount[];
  script: string;
  workdir?: string;
  env?: Record<string, string>;
  limits?: Partial<SandboxLimits>;
}

export interface RunResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  output: string;
  ms: number;
}

const MAX_OUTPUT = 1024 * 1024;

export function runContainer(opts: RunOptions): Promise<RunResult> {
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  const name = `cc-sbx-${crypto.randomBytes(6).toString('hex')}`;
  const env: Record<string, string> = {
    CI: 'true',
    NODE_OPTIONS: `--max-old-space-size=${limits.nodeMaxOldSpaceMb}`,
    ...opts.env,
  };
  const args = [
    'run',
    '--rm',
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
    ...opts.mounts.map((m) => `--volume=${m.host}:${m.container}${m.readonly ? ':ro' : ''}`),
    ...Object.entries(env).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
    `--workdir=${opts.workdir ?? '/work'}`,
    opts.image,
    'sh',
    '-c',
    opts.script,
  ];

  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      spawnSync('docker', ['kill', name], { stdio: 'ignore' });
    }, limits.timeoutMs);
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
