// The Bot's sign-in to an environment (docs/06 §2.4 env_accounts; 01 §11 step 3 「Bot 实测」): the
// browser container (no network, every request answered by the host) opens the entry page with the
// account's cookie, or fills the page's own login form with the account's password, and checks that the
// page no longer asks for a password. No site-specific script: a visible password field is the sign of
// a login page. The secret only goes to the container over stdin and is masked in anything returned.
import type { AgentSandbox, EnvLoginResult } from '@cloudcraft/core-protocol';
import { parseCookieInput } from '@cloudcraft/core-protocol';
import { fetchUpstream, openBrowser, type Msg } from './session.ts';

export interface BrowserLoginOptions {
  sandbox: AgentSandbox;
  entryUrl: string;
  credentialType: 'password' | 'cookie';
  accountName?: string;
  secret: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type BrowserLoginResult = Omit<EnvLoginResult, 'credential_ref' | 'account_id'>;

export async function runBrowserLogin(o: BrowserLoginOptions): Promise<BrowserLoginResult> {
  const started = Date.now();
  const mask = (s: string) => (o.secret ? s.split(o.secret).join('***') : s).slice(0, 500);
  const done = (r: Omit<BrowserLoginResult, 'ms'>): BrowserLoginResult => ({
    ...r,
    ...(r.error ? { error: mask(r.error) } : {}),
    ms: Date.now() - started,
  });
  let entry: URL;
  try {
    entry = new URL(o.entryUrl);
  } catch {
    return done({ state: 'failed', opened: false, error: 'bad entry url' });
  }
  const parsed = o.credentialType === 'cookie' ? parseCookieInput(o.secret) : null;
  if (parsed && !parsed.cookies.length)
    return done({ state: 'failed', opened: false, error: 'no cookie in the input' });
  const expires = parsed?.expires_at ? { expires_at: parsed.expires_at } : {};

  // the page may go through a single sign-on host: any http(s) origin is fetched for it
  const answer = async (req: Msg): Promise<Record<string, unknown>> => {
    if (!/^https?:/.test(String(req.url))) return { abort: true };
    const up = await fetchUpstream(req);
    return { status: up.status, headers: up.headers, body: up.body.toString('base64') };
  };
  const session = openBrowser({ sandbox: o.sandbox, answer });
  const timer = setTimeout(() => session.kill(), o.timeoutMs ?? 90_000);
  const onAbort = () => session.kill();
  o.signal?.addEventListener('abort', onAbort, { once: true });
  const step = async (c: Record<string, unknown>) => {
    const r = await session.cmd(c);
    if (!r.ok) throw new Error(String(r.error ?? `${String(c.op)} failed`));
    return r.data as Record<string, unknown> | null;
  };
  const probe = async () =>
    (await step({ op: 'probe' })) as {
      login_form: boolean;
      identity: string | null;
    };
  try {
    await session.ready;
    if (parsed)
      await step({
        op: 'add_cookies',
        cookies: parsed.cookies.map((c) => ({
          name: c.name,
          value: c.value,
          ...(c.domain ? { domain: c.domain, path: c.path ?? '/' } : { url: entry.origin }),
          ...(c.expires ? { expires: c.expires } : {}),
        })),
      });
    let opened: { status: number };
    try {
      opened = (await step({ op: 'goto', url: entry.href })) as { status: number };
    } catch (e) {
      return done({ state: 'failed', opened: false, error: (e as Error).message });
    }
    if (opened.status >= 500 || opened.status === 0)
      return done({
        state: 'failed',
        opened: false,
        error: `entry page answered ${opened.status}`,
      });
    const first = await probe();
    const who = (p: { identity: string | null }) => (p.identity ? { identity: p.identity } : {});
    if (o.credentialType === 'cookie')
      return first.login_form
        ? done({ state: 'expired', opened: true, ...expires, error: 'the page asks to sign in' })
        : done({ state: 'ok', opened: true, ...who(first), ...expires });
    if (!first.login_form) return done({ state: 'no_login', opened: true, ...who(first) });
    await step({ op: 'login', user: o.accountName ?? '', pass: o.secret });
    // back to the entry page: a login that worked does not show the form again
    await step({ op: 'goto', url: entry.href });
    const after = await probe();
    return after.login_form
      ? done({ state: 'failed', opened: true, error: 'the password was not accepted' })
      : done({ state: 'ok', opened: true, ...who(after) });
  } catch (e) {
    return done({ state: 'failed', opened: false, error: (e as Error).message });
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onAbort);
    await session.close();
  }
}
