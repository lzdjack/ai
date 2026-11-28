// Secrets of the account system (docs/06 §10.1, §2.9): Argon2id passwords, HMAC-signed short access
// tokens, opaque refresh tokens and tickets stored as sha256, one-time codes stored as a peppered
// HMAC with a per-row salt (no global UNIQUE on it).
import crypto from 'node:crypto';

export interface AuthSecrets {
  authSecret: string;
  otpPepper: string;
}

const b64u = (b: Buffer) => b.toString('base64url');

interface Argon2Params {
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
}

function argon2(message: string, nonce: Buffer, p: Argon2Params): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.argon2('argon2id', { message, nonce, ...p }, (err, key) =>
      err ? reject(err) : resolve(Buffer.from(key)),
    ),
  );
}

const PARAMS: Argon2Params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
// verified against when an account has no hash, so timing does not reveal unknown accounts
const DUMMY = `argon2id$m=19456,t=2,p=1$${b64u(Buffer.alloc(16))}$${b64u(Buffer.alloc(32))}`;

/** Argon2id with OWASP's minimum (19 MiB, 2 passes); the stored string carries its parameters. */
export async function hashPassword(password: string): Promise<string> {
  const nonce = crypto.randomBytes(16);
  const tag = await argon2(password, nonce, PARAMS);
  const p = PARAMS;
  return `argon2id$m=${p.memory},t=${p.passes},p=${p.parallelism}$${b64u(nonce)}$${b64u(tag)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? DUMMY).split('$');
  const [m, t, p] = parts[1]!.split(',').map((x) => Number(x.split('=')[1]));
  const want = Buffer.from(parts[3]!, 'base64url');
  const got = await argon2(password, Buffer.from(parts[2]!, 'base64url'), {
    memory: m!,
    passes: t!,
    parallelism: p!,
    tagLength: want.length,
  });
  return stored !== null && crypto.timingSafeEqual(got, want);
}

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;

/** cc1.<payload>.<sig>: user id and expiry, signed; nothing secret inside. */
export function signAccessToken(s: AuthSecrets, userId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ACCESS_TTL_SECONDS;
  const payload = b64u(Buffer.from(JSON.stringify({ sub: userId, exp })));
  const sig = b64u(crypto.createHmac('sha256', s.authSecret).update(`cc1.${payload}`).digest());
  return `cc1.${payload}.${sig}`;
}

/** The user id, or null when the token is malformed, forged or expired. */
export function verifyAccessToken(s: AuthSecrets, token: string, now = Date.now()): string | null {
  const [v, payload, sig] = token.split('.');
  if (v !== 'cc1' || !payload || !sig) return null;
  const want = crypto.createHmac('sha256', s.authSecret).update(`cc1.${payload}`).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      sub: string;
      exp: number;
    };
    return p.exp * 1000 > now ? p.sub : null;
  } catch {
    return null;
  }
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => b64u(crypto.randomBytes(bytes));

export const normEmail = (e: string) => e.trim().toLowerCase();
export const emailHmac = (s: AuthSecrets, email: string) =>
  crypto.createHmac('sha256', s.otpPepper).update(normEmail(email)).digest('hex');

export const otpHash = (
  s: AuthSecrets,
  purpose: string,
  salt: string,
  eHmac: string,
  code: string,
) =>
  crypto
    .createHmac('sha256', s.otpPepper)
    .update(`${purpose}:${salt}:${eHmac}:${code}`)
    .digest('hex');

export const newOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Base32 without look-alikes (0/O, 1/I/L)
const B32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** #CC-XXXX-XXXX-XXXX#: 12 random symbols, about 59 bits (06 §2.3). */
export function newShortCode(): string {
  const s = Array.from({ length: 12 }, () => B32[crypto.randomInt(0, B32.length)]).join('');
  return `#CC-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}#`;
}

/** A link token or short code, as typed or pasted (with the link around it), to its stored hash. */
export function invitationHash(input: string): string {
  const t = input.trim();
  const code = /CC-?([A-Z0-9]{4})-?([A-Z0-9]{4})-?([A-Z0-9]{4})/i.exec(t);
  if (code && t.length <= 24)
    return sha256(`code:${(code[1]! + code[2]! + code[3]!).toUpperCase()}`);
  const token = /([A-Za-z0-9_-]{32,})\/?$/.exec(t);
  return sha256(`token:${token ? token[1] : t}`);
}
