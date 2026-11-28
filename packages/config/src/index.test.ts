import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, databaseUrls, loadConfig } from './index.ts';

function tempDir(envFile?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-config-'));
  if (envFile !== undefined) fs.writeFileSync(path.join(dir, '.env'), envFile);
  return dir;
}

const secrets = [
  'CC_PG_SUPERUSER_PASSWORD=aaaaaaaaaaaaaaaaaaaa',
  'CC_PG_MIGRATOR_PASSWORD=bbbbbbbbbbbbbbbbbbbb',
  'CC_PG_APP_PASSWORD=cccccccccccccccccc/+@',
  'CC_AUTH_SECRET=dddddddddddddddddddd',
  'CC_OTP_PEPPER=eeeeeeeeeeeeeeeeeeee',
].join('\n');

describe('配置模块', () => {
  it('读 .env、补默认值、环境变量优先、数字从字符串转换', () => {
    const dir = tempDir(`${secrets}\nCC_PG_PORT=6000\nCC_LLM_API_KEY=\n`);
    const c = loadConfig({ CC_DATA_DIR: dir, CC_PG_PORT: '7000' });
    expect(c.CC_PG_PORT).toBe(7000);
    expect(c.CC_SMTP_PORT).toBe(1025);
    expect(c.CC_LLM_DAILY_BUDGET_USD).toBe(5);
    expect(c.CC_LLM_API_KEY).toBeUndefined();
    const url = new URL(databaseUrls(c).app);
    expect(url.username).toBe('cc_app');
    expect(decodeURIComponent(url.password)).toBe('cccccccccccccccccc/+@');
    expect(`${url.hostname}:${url.port}${url.pathname}`).toBe('127.0.0.1:7000/cloudcraft');
  });

  it('不合法时一次列出全部问题', () => {
    const dir = tempDir('CC_PG_SUPERUSER_PASSWORD=short\nCC_PG_PORT=abc\n');
    let err: unknown;
    try {
      loadConfig({ CC_DATA_DIR: dir });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConfigError);
    const keys = (err as ConfigError).issues.map((i) => i.key).join(' ');
    for (const k of [
      'CC_PG_SUPERUSER_PASSWORD',
      'CC_PG_PORT',
      'CC_PG_MIGRATOR_PASSWORD',
      'CC_PG_APP_PASSWORD',
    ]) {
      expect(keys).toContain(k);
    }
  });
});
