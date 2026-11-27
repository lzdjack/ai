// Account settings from the unified config (docs/07 §4.5).
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '@cloudcraft/config';
import type { AccountSettings } from './account-service.ts';
import { smtpMailer } from './mailer.ts';
import { loadConnectors } from './plugins.ts';
import type { SourceSettings } from './source-service.ts';

export function accountSettings(c: Config, over: Partial<AccountSettings> = {}): AccountSettings {
  return {
    authSecret: c.CC_AUTH_SECRET,
    otpPepper: c.CC_OTP_PEPPER,
    rateLimitPerHour: c.CC_AUTH_RATE_LIMIT_PER_HOUR,
    mailer: smtpMailer({
      host: c.CC_SMTP_HOST,
      port: c.CC_SMTP_PORT,
      from: 'CloudCraft <no-reply@cloudcraft.local>',
    }),
    publicUrl: c.CC_PUBLIC_URL ?? `http://127.0.0.1:${c.CC_APP_PORT}`,
    ...over,
  };
}

/**
 * Master key of the credential store (locally the dev key dev:up creates, 07 §4.5) and the connector
 * plugins named in CC_CONNECTOR_PLUGINS.
 */
export async function sourceSettings(c: Config): Promise<SourceSettings> {
  const keyFile = path.join(c.CC_DATA_DIR, 'keys', 'dev-master.key');
  return {
    masterKey: Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'base64'),
    connectors: await loadConnectors(
      c.CC_CONNECTOR_PLUGINS.split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  };
}
