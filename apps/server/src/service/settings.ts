// Account settings from the unified config (docs/07 §4.5).
import type { Config } from '@cloudcraft/config';
import type { AccountSettings } from './account-service.ts';
import { smtpMailer } from './mailer.ts';

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
