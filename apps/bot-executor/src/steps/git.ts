// git on the host for the round's repos. The credential stays on the host: it is sent as an HTTP
// header for one command and never written into .git/config or the container.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export const BOT_AUTHOR = [
  '-c',
  'user.name=CloudCraft Bot',
  '-c',
  'user.email=cc-bot@cloudcraft.local',
];

export interface GitOptions {
  token?: string;
  /** a full header line from a credential envelope; wins over token */
  header?: string;
  signal?: AbortSignal;
}

function env(o: GitOptions): NodeJS.ProcessEnv {
  const line =
    o.header ??
    (o.token ? `Authorization: Basic ${Buffer.from(`x:${o.token}`).toString('base64')}` : null);
  const header = line
    ? { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader', GIT_CONFIG_VALUE_0: line }
    : {};
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    ...header,
  };
}

/** Runs git in `cwd`; credentials only for commands that talk to the remote. */
export async function git(cwd: string, args: string[], o: GitOptions = {}): Promise<string> {
  const r = await exec('git', ['-c', 'credential.helper=', ...args], {
    cwd,
    env: env(o),
    signal: o.signal,
    maxBuffer: 16 * 1024 * 1024,
  });
  return r.stdout;
}

export async function clone(url: string, ref: string, dir: string, o: GitOptions = {}) {
  await git(process.cwd(), ['clone', '-q', '--branch', ref, url, dir], o);
}
