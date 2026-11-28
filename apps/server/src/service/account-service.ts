// Accounts (docs/06 §10.1): e-mail + password, a 6-digit code to register, short access tokens with
// rotating refresh tokens, and the user's workspaces. Registering joins the invitation it came with,
// otherwise creates the personal workspace.
import crypto from 'node:crypto';
import type { Me, OtpRequest, RegisterRequest, TokenPair } from '@cloudcraft/core-protocol';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.ts';
import { refreshTokens, userAuthTokens, users } from '../db/schema/index.ts';
import { createWorkspace } from '../db/write.ts';
import { hitRateLimit, myWorkspaces, takeOtpAttempt } from '../repo/account-repo.ts';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_DAYS,
  emailHmac,
  hashPassword,
  newOtp,
  normEmail,
  otpHash,
  randomToken,
  sha256,
  signAccessToken,
  verifyPassword,
  type AuthSecrets,
} from './auth-crypto.ts';
import { ApiFailure } from './errors.ts';
import { tr } from './i18n.ts';
import type { Mailer } from './mailer.ts';

export interface AccountSettings extends AuthSecrets {
  rateLimitPerHour: number;
  mailer: Mailer;
  /** base of invitation links, e.g. https://cloudcraft.example */
  publicUrl: string;
}

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const PURPOSE = { register: 'register_otp', password_reset: 'self_password_reset_otp' } as const;

/** Throws 429 once any of the keys (IP, e-mail, account …) went over this hour's budget. */
export async function limit(
  db: Db,
  s: AccountSettings,
  action: string,
  keys: (string | undefined)[],
) {
  const hashes = keys.filter(Boolean).map((k) => sha256(`${action}:${k}`));
  if ((await hitRateLimit(db.orm, hashes)) > s.rateLimitPerHour)
    throw new ApiFailure(429, 'auth.rate_limited', undefined, 3600);
}

export async function requestOtp(db: Db, s: AccountSettings, req: OtpRequest, ip: string) {
  const email = normEmail(req.email);
  await limit(db, s, 'otp', [`ip:${ip}`, `email:${email}`]);
  const [existing] = await db.orm
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  // never tell whether an address has an account: same answer, the mail says what applies
  const purpose = PURPOSE[req.purpose];
  const code = newOtp();
  const salt = randomToken(12);
  const eHmac = emailHmac(s, email);
  await db.orm.transaction(async (tx) => {
    await tx
      .update(userAuthTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(userAuthTokens.emailHmac, eHmac),
          eq(userAuthTokens.purpose, purpose),
          isNull(userAuthTokens.usedAt),
        ),
      );
    await tx.insert(userAuthTokens).values({
      userId: existing?.id ?? null,
      purpose,
      salt,
      emailHmac: eHmac,
      tokenHash: otpHash(s, purpose, salt, eHmac, code),
      expiresAt: sql`now() + make_interval(mins => ${OTP_TTL_MINUTES})`,
    });
  });
  const already = req.purpose === 'register' && existing;
  await s.mailer.send({
    to: email,
    subject: tr(already ? 'mail.otp.exists_subject' : 'mail.otp.subject'),
    text: already
      ? tr('mail.otp.exists_body')
      : tr('mail.otp.body', { code, minutes: OTP_TTL_MINUTES }),
  });
}

async function checkOtp(db: Db, s: AccountSettings, email: string, purpose: string, code: string) {
  const eHmac = emailHmac(s, email);
  const row = await takeOtpAttempt(db.orm, eHmac, purpose);
  const ok =
    !!row &&
    row.attempts <= OTP_MAX_ATTEMPTS &&
    crypto.timingSafeEqual(
      Buffer.from(otpHash(s, purpose, row.salt, eHmac, code)),
      Buffer.from(row.token_hash),
    );
  if (!ok) throw new ApiFailure(400, 'auth.code_invalid');
  await db.orm
    .update(userAuthTokens)
    .set({ usedAt: sql`now()` })
    .where(eq(userAuthTokens.id, row.id));
}

export async function issueTokens(
  db: Db,
  s: AccountSettings,
  userId: string,
  deviceId?: string,
): Promise<TokenPair> {
  const refresh = randomToken(32);
  await db.orm.insert(refreshTokens).values({
    userId,
    deviceId: deviceId ?? null,
    tokenHash: sha256(refresh),
    expiresAt: sql`now() + make_interval(days => ${REFRESH_TTL_DAYS})`,
  });
  return {
    access_token: signAccessToken(s, userId),
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
  };
}

/**
 * Verifies the code, creates the account and its first workspace: the one the invitation points to,
 * or a personal workspace. Joining goes through iam-service, passed in to keep the layers one-way.
 */
export async function register(
  db: Db,
  s: AccountSettings,
  req: RegisterRequest,
  ip: string,
  join: (userId: string, invitation: string) => Promise<string>,
): Promise<{ tokens: TokenPair; user_id: string; workspace_id: string }> {
  const email = normEmail(req.email);
  await limit(db, s, 'register', [`ip:${ip}`, `email:${email}`]);
  await checkOtp(db, s, email, PURPOSE.register, req.code);
  const passwordHash = await hashPassword(req.password);
  const [user] = await db.orm
    .insert(users)
    .values({
      email,
      displayName: req.display_name.trim(),
      passwordHash,
      emailVerifiedAt: sql`now()`,
    })
    .onConflictDoNothing()
    .returning();
  if (!user) throw new ApiFailure(409, 'auth.account_exists');
  const workspaceId = req.invitation
    ? await join(user.id, req.invitation)
    : await db.orm.transaction(async (tx) => {
        const ctx = await createWorkspace(tx, user.id, {
          kind: 'personal',
          slug: `u-${randomToken(6)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '0')}`,
          name: tr('workspace.personal_name', { name: user.displayName }),
        });
        return ctx.workspaceId;
      });
  return { tokens: await issueTokens(db, s, user.id), user_id: user.id, workspace_id: workspaceId };
}

export async function login(
  db: Db,
  s: AccountSettings,
  req: { email: string; password: string; device_id?: string },
  ip: string,
): Promise<TokenPair> {
  const email = normEmail(req.email);
  await limit(db, s, 'login', [`ip:${ip}`, `email:${email}`]);
  const [user] = await db.orm
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`);
  const ok = await verifyPassword(req.password, user?.passwordHash ?? null);
  if (!ok || !user || user.status !== 'active') throw new ApiFailure(401, 'auth.login_failed');
  return issueTokens(db, s, user.id, req.device_id);
}

/** Rotates: the old refresh token is spent; reusing a spent one revokes the user's other sessions. */
export async function refresh(db: Db, s: AccountSettings, token: string): Promise<TokenPair> {
  const hash = sha256(token);
  const [row] = await db.orm.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hash));
  if (!row || row.expiresAt < new Date()) throw new ApiFailure(401, 'auth.session_expired');
  if (row.revokedAt) {
    await db.orm
      .update(refreshTokens)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    throw new ApiFailure(401, 'auth.session_expired');
  }
  const spent = await db.orm
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
    .returning();
  if (!spent.length) throw new ApiFailure(401, 'auth.session_expired');
  return issueTokens(db, s, row.userId, row.deviceId ?? undefined);
}

export async function logout(db: Db, token: string) {
  await db.orm
    .update(refreshTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(refreshTokens.tokenHash, sha256(token)), isNull(refreshTokens.revokedAt)));
}

export async function me(db: Db, userId: string): Promise<Me> {
  const [u] = await db.orm.select().from(users).where(eq(users.id, userId));
  if (!u || u.status !== 'active') throw new ApiFailure(401, 'auth.unauthenticated');
  const ws = await myWorkspaces(db.orm, userId);
  return {
    id: u.id,
    email: u.email,
    display_name: u.displayName,
    locale: u.locale,
    workspaces: ws.map((w) => ({
      id: w.id,
      kind: w.kind as 'personal' | 'organization',
      name: w.name,
      slug: w.slug,
      unread_notifications: w.unread,
    })),
  };
}
