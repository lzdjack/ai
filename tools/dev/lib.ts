// 本地环境脚本的公共部分（docs/07 §4）。
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ConfigError,
  GENERATED_SECRETS,
  defaultDataDir,
  envFilePath,
  loadConfig,
  readEnvFile,
  type Config,
} from '@cloudcraft/config';

export const ROOT = path.resolve(import.meta.dirname, '../..');
export const COMPOSE_FILE = path.join(ROOT, 'infra', 'compose.yaml');

/** 运行时数据目录下的子目录（07 §4.3）；dev:reset 会清空它们，.env 和 keys/ 保留 */
export const DATA_SUBDIRS = [
  'pg',
  'storage',
  'git',
  'sim',
  'pnpm-store',
  'sandboxes',
  'logs',
  'qa',
];

export function dataDir(): string {
  return process.env.CC_DATA_DIR || defaultDataDir();
}

export function ensureDataDirs(dir: string): void {
  for (const sub of [...DATA_SUBDIRS, 'keys'])
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
}

/** 模型接入配置块（06 §11.1）。值由用户自己填，Claude 不经手 */
const LLM_BLOCK = [
  '# 模型接入，由你自己填写，Claude 不经手。填好后跑 pnpm llm:check 自检',
  '# 协议：openai-completions | openai-responses | anthropic-messages（留空时 llm:check 会探测）',
  'CC_LLM_API=',
  '# 第三方 / 中转站的地址，例如 https://example.com/v1（OpenAI 兼容）或 https://example.com（Anthropic）',
  'CC_LLM_BASE_URL=',
  'CC_LLM_MODEL=',
  'CC_LLM_API_KEY=',
];

/**
 * .env 不存在就生成模板；已存在则只补缺失的项（自动生成的密钥、模型接入块），不动用户写的值。
 * 旧模板里留空的 OPENAI_API_KEY= 行换成模型接入块。
 */
export function ensureEnvFile(dir: string): { created: boolean; added: string[] } {
  const file = envFilePath(dir);
  const existing = readEnvFile(file);
  const created = !fs.existsSync(file);
  const added: string[] = GENERATED_SECRETS.filter((k) => !existing[k]);
  const lines: string[] = [];
  if (created) {
    lines.push(
      '# 云匠本地配置（docs/07 §4.5）。这个文件不进仓库，只在本机。',
      ...LLM_BLOCK,
      '# 模型代理每日花费上限（美元），到上限后熔断',
      'CC_LLM_DAILY_BUDGET_USD=5',
      '',
      '# 以下由 dev:up 自动生成，数据库初始化后不要再改（改了要 dev:reset）',
    );
  } else {
    const text = fs.readFileSync(file, 'utf8');
    if (!/^CC_LLM_BASE_URL=/m.test(text)) {
      added.unshift('模型接入（CC_LLM_*）');
      if (/^OPENAI_API_KEY=\s*$/m.test(text))
        fs.writeFileSync(
          file,
          text
            .replace(/^# OpenAI 密钥.*\n/m, '')
            .replace(/^OPENAI_API_KEY=\s*$/m, LLM_BLOCK.join('\n')),
        );
      else lines.push('', ...LLM_BLOCK);
    }
  }
  for (const k of GENERATED_SECRETS)
    if (!existing[k]) lines.push(`${k}=${crypto.randomBytes(24).toString('base64url')}`);
  if (lines.length > 0) {
    const prefix = !created && !fs.readFileSync(file, 'utf8').endsWith('\n') ? '\n' : '';
    fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, { mode: 0o600 });
  }
  fs.chmodSync(file, 0o600);
  return { created, added };
}

/** 本机开发用的凭据信封主密钥（07 §4.5），只生成一次 */
export function ensureMasterKey(dir: string): boolean {
  const file = path.join(dir, 'keys', 'dev-master.key');
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  return true;
}

export function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`配置有问题（${envFilePath(dataDir())}）：`);
      for (const i of e.issues) console.error(`  - ${i.key}：${i.reason}`);
      process.exit(1);
    }
    throw e;
  }
}

/** compose 只拿它需要的变量，不把 OpenAI 密钥等无关配置传进容器 */
function composeEnv(c: Config): NodeJS.ProcessEnv {
  const keys = [
    'CC_DATA_DIR',
    'CC_PG_PORT',
    'CC_PG_DATABASE',
    'CC_PG_SUPERUSER_PASSWORD',
    'CC_PG_MIGRATOR_PASSWORD',
    'CC_PG_APP_PASSWORD',
    'CC_SMTP_PORT',
    'CC_MAILPIT_UI_PORT',
  ] as const;
  const picked = Object.fromEntries(keys.map((k) => [k, String(c[k])]));
  return { PATH: process.env.PATH, HOME: process.env.HOME, ...picked };
}

export interface RunResult {
  ok: boolean;
  out: string;
}

export function compose(c: Config, args: string[]): RunResult {
  const r = spawnSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: composeEnv(c),
  });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

/** 失败时打印输出末尾并退出 */
export function must(label: string, r: RunResult): void {
  if (r.ok) return;
  console.error(`✗ ${label}`);
  console.error(r.out.split('\n').slice(-40).join('\n'));
  process.exit(1);
}
