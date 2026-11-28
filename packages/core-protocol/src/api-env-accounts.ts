// Environment accounts and the onboarding health check (docs/06 §2.4 env_accounts, §10.3; 01 §11 step
// 3–4). An account is who the Bot signs in as on an environment: a password or a browser cookie, with
// the data permission people granted it. The secret itself is sealed (06 §2.10, bot_exec domain) and
// only reaches an executor as an envelope; the Bot's sign-in result is written back to the account.
import { Type, type Static } from 'typebox';

export const ENV_CREDENTIAL_TYPES = ['password', 'cookie'] as const;
export const DATA_PERMISSIONS = ['read_only', 'read_write'] as const;
/**
 * The Bot's last sign-in: ok; failed (password refused, page did not open); expired (the cookie no
 * longer signs in); no_login (the page opened and asked for no sign-in at all); unchecked (never tried).
 */
export const ENV_LOGIN_STATES = ['unchecked', 'ok', 'failed', 'expired', 'no_login'] as const;
export type EnvLoginState = (typeof ENV_LOGIN_STATES)[number];

const CredentialType = Type.Union([Type.Literal('password'), Type.Literal('cookie')]);
const DataPermission = Type.Union([Type.Literal('read_only'), Type.Literal('read_write')]);

export const CreateEnvAccountRequest = Type.Object(
  {
    role_name: Type.String({ minLength: 1, maxLength: 40 }),
    credential_type: CredentialType,
    /** required for a password; a cookie's account is recognised by the Bot */
    account_name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    /** the password, or the cookie as a Cookie header string or a JSON export */
    secret: Type.String({ minLength: 1, maxLength: 16000 }),
    data_permission: DataPermission,
  },
  { additionalProperties: false },
);
export type CreateEnvAccountRequest = Static<typeof CreateEnvAccountRequest>;

export const UpdateEnvAccountRequest = Type.Object(
  {
    role_name: Type.Optional(Type.String({ minLength: 1, maxLength: 40 })),
    account_name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    /** a new secret replaces the old one (the old ciphertext is destroyed); left out keeps it */
    credential_type: Type.Optional(CredentialType),
    secret: Type.Optional(Type.String({ minLength: 1, maxLength: 16000 })),
    data_permission: Type.Optional(DataPermission),
  },
  { additionalProperties: false },
);
export type UpdateEnvAccountRequest = Static<typeof UpdateEnvAccountRequest>;

export interface EnvAccountRow {
  id: string;
  environment_id: string;
  role_name: string;
  account_name: string | null;
  credential_type: (typeof ENV_CREDENTIAL_TYPES)[number];
  data_permission: (typeof DATA_PERMISSIONS)[number];
  /** last characters of the secret for display (•••• 91d0); empty when too short to show any */
  hint: string;
  login: {
    state: EnvLoginState;
    at: string | null;
    error: string | null;
    /** who the Bot found itself signed in as (the cookie's account) */
    identity: string | null;
    /** when the cookie stops working, if it says */
    expires_at: string | null;
  };
}

/** One sign-in the Bot tries (node config of env_login): the secret is fetched as an envelope. */
export const EnvLoginTarget = Type.Object({
  /** the account written back to; absent for a try before saving */
  account_id: Type.Optional(Type.String({ format: 'uuid' })),
  environment_id: Type.String({ format: 'uuid' }),
  entry_url: Type.String(),
  credential_type: CredentialType,
  account_name: Type.Optional(Type.String()),
  credential_ref: Type.String({ format: 'uuid' }),
});
export type EnvLoginTarget = Static<typeof EnvLoginTarget>;

export const EnvLoginResult = Type.Object({
  credential_ref: Type.String({ format: 'uuid' }),
  account_id: Type.Optional(Type.String({ format: 'uuid' })),
  state: Type.Union([
    Type.Literal('ok'),
    Type.Literal('failed'),
    Type.Literal('expired'),
    Type.Literal('no_login'),
  ]),
  /** the entry page answered at all */
  opened: Type.Boolean(),
  identity: Type.Optional(Type.String({ maxLength: 120 })),
  expires_at: Type.Optional(Type.String()),
  error: Type.Optional(Type.String({ maxLength: 500 })),
  ms: Type.Integer({ minimum: 0 }),
});
export type EnvLoginResult = Static<typeof EnvLoginResult>;

/** What the onboarding check knows without running anything, and the runs it started. */
export interface HealthCheckResponse {
  started_at: string;
  facts: {
    connectors: { name: string; enabled: boolean }[];
    repos: { read_write: number; read_only: number; not_probed: string[] };
    environments: { id: string; name: string; tier: string; accounts: number }[];
  };
  /** one flow per project: env_login (if it has accounts) then trial_build (if it has repos) */
  flows: { project_id: string; flow_id: string }[];
}

export interface ParsedCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  /** seconds since the epoch */
  expires?: number;
}

const COOKIE_ATTRS = new Set([
  'path',
  'expires',
  'max-age',
  'domain',
  'secure',
  'httponly',
  'samesite',
]);

/**
 * A cookie as people paste it (01 PC-步骤器-3-添加账号: "Header 原始串或 JSON"): a Cookie / Set-Cookie
 * header string, or a JSON export (an array of {name, value, domain?, path?, expires? | expirationDate?},
 * or {cookies: [...]}). expires_at is the earliest expiry any cookie states.
 */
export function parseCookieInput(
  raw: string,
  now = Date.now(),
): { cookies: ParsedCookie[]; expires_at: string | null } {
  const text = raw.trim();
  let cookies: ParsedCookie[] = [];
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const j = JSON.parse(text) as unknown;
      const list = (Array.isArray(j) ? j : (j as { cookies?: unknown }).cookies) as unknown;
      if (Array.isArray(list))
        cookies = list.flatMap((x) => {
          const c = x as Record<string, unknown>;
          if (typeof c.name !== 'string' || typeof c.value !== 'string' || !c.name) return [];
          const exp = Number(c.expires ?? c.expirationDate);
          return [
            {
              name: c.name,
              value: c.value,
              ...(typeof c.domain === 'string' && c.domain ? { domain: c.domain } : {}),
              ...(typeof c.path === 'string' && c.path ? { path: c.path } : {}),
              ...(Number.isFinite(exp) && exp > 0 ? { expires: Math.floor(exp) } : {}),
            },
          ];
        });
    } catch {
      cookies = [];
    }
  } else {
    let expires: number | undefined;
    let pathAttr: string | undefined;
    for (const part of text.replace(/^(set-)?cookie:\s*/i, '').split(/;\s*/)) {
      const i = part.indexOf('=');
      const k = (i < 0 ? part : part.slice(0, i)).trim();
      const v = i < 0 ? '' : part.slice(i + 1).trim();
      if (!k) continue;
      const attr = k.toLowerCase();
      if (COOKIE_ATTRS.has(attr)) {
        if (attr === 'expires' && !Number.isNaN(Date.parse(v)))
          expires = Math.floor(Date.parse(v) / 1000);
        if (attr === 'max-age' && /^-?\d+$/.test(v)) expires = Math.floor(now / 1000) + Number(v);
        if (attr === 'path') pathAttr = v;
        continue;
      }
      if (i < 0) continue;
      cookies.push({ name: k, value: v });
    }
    cookies = cookies.map((c) => ({
      ...c,
      ...(pathAttr ? { path: pathAttr } : {}),
      ...(expires !== undefined ? { expires } : {}),
    }));
  }
  const exps = cookies.map((c) => c.expires).filter((x): x is number => x !== undefined);
  return {
    cookies,
    expires_at: exps.length ? new Date(Math.min(...exps) * 1000).toISOString() : null,
  };
}
