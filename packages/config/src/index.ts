// 统一配置（docs/07 §4.5）：~/.cloudcraft-dev/.env + 环境变量（环境变量优先），TypeBox 校验。
// 报错只给键名和英文原因，由调用方（tools/ 或服务启动处）翻译成给人看的提示。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { Type, type Static } from 'typebox';
import Value from 'typebox/value';

const Port = (def: number) => Type.Integer({ minimum: 1, maximum: 65535, default: def });
const Secret = Type.String({ minLength: 16 });

export const ConfigSchema = Type.Object({
  CC_DATA_DIR: Type.String({ minLength: 1 }),
  CC_PG_HOST: Type.String({ default: '127.0.0.1' }),
  CC_PG_PORT: Port(55432),
  CC_PG_DATABASE: Type.String({ default: 'cloudcraft' }),
  CC_PG_SUPERUSER_PASSWORD: Secret,
  CC_PG_MIGRATOR_PASSWORD: Secret,
  CC_PG_APP_PASSWORD: Secret,
  CC_SMTP_HOST: Type.String({ default: '127.0.0.1' }),
  CC_SMTP_PORT: Port(1025),
  CC_MAILPIT_UI_PORT: Port(8025),
  CC_APP_PORT: Port(4100),
  CC_SIM_PORT: Port(4200),
  CC_WEB_PORT: Port(4300),
  // 模型接入（06 §11.1）：协议 + Base URL + 模型 + 密钥。密钥只有模型代理进程读取
  CC_LLM_API: Type.Optional(
    Type.Union([
      Type.Literal('openai-completions'),
      Type.Literal('openai-responses'),
      Type.Literal('anthropic-messages'),
    ]),
  ),
  CC_LLM_BASE_URL: Type.Optional(Type.String({ pattern: '^https?://' })),
  CC_LLM_MODEL: Type.Optional(Type.String({ minLength: 1 })),
  CC_LLM_API_KEY: Type.Optional(Type.String()),
  CC_LLM_DAILY_BUDGET_USD: Type.Number({ minimum: 0, default: 5 }),
});

export type Config = Static<typeof ConfigSchema>;

/** 自动生成的密钥类配置（dev:up 首次运行时写入 .env） */
export const GENERATED_SECRETS = [
  'CC_PG_SUPERUSER_PASSWORD',
  'CC_PG_MIGRATOR_PASSWORD',
  'CC_PG_APP_PASSWORD',
] as const;

export interface ConfigIssue {
  key: string;
  reason: string;
}

export class ConfigError extends Error {
  constructor(readonly issues: ConfigIssue[]) {
    super(`invalid config: ${issues.map((i) => `${i.key} (${i.reason})`).join(', ')}`);
    this.name = 'ConfigError';
  }
}

export function defaultDataDir(): string {
  return path.join(os.homedir(), '.cloudcraft-dev');
}

export function envFilePath(dataDir: string): string {
  return path.join(dataDir, '.env');
}

export function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(
    Object.entries(parsed).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== ''),
  );
}

/** 读取并校验配置；不合法时抛 ConfigError（列出全部问题，不只第一个）。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = env.CC_DATA_DIR || defaultDataDir();
  const fromProcess = Object.fromEntries(
    Object.keys(ConfigSchema.properties)
      .filter((k) => env[k] !== undefined && env[k] !== '')
      .map((k) => [k, env[k]]),
  );
  const raw = { ...readEnvFile(envFilePath(dataDir)), ...fromProcess, CC_DATA_DIR: dataDir };
  const value = Value.Default(ConfigSchema, Value.Convert(ConfigSchema, raw));
  if (Value.Check(ConfigSchema, value)) return value;
  const issues = Value.Errors(ConfigSchema, value).map((e) => ({
    key: e.instancePath.replace(/^\//, '') || keyFromRequired(e) || '(root)',
    reason: e.message,
  }));
  throw new ConfigError(issues);
}

function keyFromRequired(e: { params?: unknown }): string | undefined {
  const params = e.params as { requiredProperties?: string[] } | undefined;
  return params?.requiredProperties?.join(', ');
}

/** 应用账号（运行时，受 RLS 约束）和迁移账号的连接串 */
export function databaseUrls(c: Config): { app: string; migrator: string } {
  const base = `${c.CC_PG_HOST}:${c.CC_PG_PORT}/${c.CC_PG_DATABASE}`;
  return {
    app: `postgres://cc_app:${encodeURIComponent(c.CC_PG_APP_PASSWORD)}@${base}`,
    migrator: `postgres://cc_migrator:${encodeURIComponent(c.CC_PG_MIGRATOR_PASSWORD)}@${base}`,
  };
}
