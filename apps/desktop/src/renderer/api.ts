// Talks to cc-app (docs/06 §1.3, §10.1): Bearer access token, refreshed once on 401 with the stored
// refresh token. In the browser the tokens live in localStorage ("remember me") or sessionStorage;
// U2 moves them to Electron safeStorage through HostPlatformAdapter.secureStorage.
import type { Me, TokenPair } from '@cloudcraft/core-protocol';

const KEY = 'cc.session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Stored {
  access: string;
  refresh: string;
  remember: boolean;
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function save(s: Stored | null) {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    if (s) (s.remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked: the session lasts as long as this page
  }
}

let session: Stored | null = load();

async function raw(method: string, path: string, body?: unknown, auth = true): Promise<Response> {
  return fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(auth && session ? { authorization: `Bearer ${session.access}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function refresh(): Promise<boolean> {
  if (!session) return false;
  const r = await raw('POST', '/v1/auth/refresh', { refresh_token: session.refresh }, false);
  if (!r.ok) {
    save((session = null));
    return false;
  }
  const t = (await r.json()) as TokenPair;
  save(
    (session = { access: t.access_token, refresh: t.refresh_token, remember: session.remember }),
  );
  return true;
}

export async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let r = await raw(method, path, body);
  if (r.status === 401 && session && (await refresh())) r = await raw(method, path, body);
  const text = await r.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!r.ok)
    throw new ApiError(
      r.status,
      String(json.code ?? 'common.internal'),
      String(json.message ?? r.statusText),
    );
  return json as T;
}

export const api = {
  hasSession: () => !!session,
  async login(email: string, password: string, remember: boolean) {
    const t = await call<TokenPair>('POST', '/v1/auth/login', { email, password });
    save((session = { access: t.access_token, refresh: t.refresh_token, remember }));
  },
  requestCode: (email: string) =>
    call<unknown>('POST', '/v1/auth/otp', { email, purpose: 'register' }).then(() => undefined),
  async register(v: {
    email: string;
    code: string;
    displayName: string;
    password: string;
    workspaceName: string;
  }) {
    const r = await call<{ tokens: TokenPair }>('POST', '/v1/auth/register', {
      email: v.email,
      code: v.code,
      password: v.password,
      display_name: v.displayName,
      ...(v.workspaceName.trim() ? { workspace_name: v.workspaceName.trim() } : {}),
    });
    save(
      (session = {
        access: r.tokens.access_token,
        refresh: r.tokens.refresh_token,
        remember: true,
      }),
    );
  },
  me: () => call<Me>('GET', '/v1/me'),
  async logout() {
    if (session)
      await raw('POST', '/v1/auth/logout', { refresh_token: session.refresh }, false).catch(
        () => {},
      );
    save((session = null));
  },
};
