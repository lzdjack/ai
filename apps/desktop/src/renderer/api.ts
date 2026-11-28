// Talks to cc-app (docs/06 §1.3, §10.1): Bearer access token, refreshed once on 401 with the stored
// refresh token. In the browser the tokens live in localStorage ("remember me") or sessionStorage;
// U2 moves them to Electron safeStorage through HostPlatformAdapter.secureStorage.
import type {
  ConnectorRow,
  EnvironmentRow,
  FlowStatus,
  Me,
  PluginInfo,
  ProjectRow,
  RemoteRepo,
  RepoRow,
  TokenPair,
  VerifyResult,
} from '@cloudcraft/core-protocol';
import type { OnboardingCalls } from '@cloudcraft/workbench-ui';

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

interface Page<T> {
  items: T[];
  has_more: boolean;
}

/** The first-run wizard's calls in one workspace (06 §10.3; all paths under /v1/workspaces/:ws). */
export function onboardingCalls(ws: string): OnboardingCalls {
  const w = `/v1/workspaces/${ws}`;
  return {
    plugins: () => call<Page<PluginInfo>>('GET', '/v1/plugins').then((r) => r.items),
    connectors: () => call<Page<ConnectorRow>>('GET', `${w}/connectors`).then((r) => r.items),
    verify: (v) => call<VerifyResult>('POST', `${w}/connectors/verify`, v),
    createConnector: (v) => call<ConnectorRow>('POST', `${w}/connectors`, v),
    remoteRepos: (id, q) =>
      call<Page<RemoteRepo>>(
        'GET',
        `${w}/connectors/${id}/remote-repos${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ),
    attach: (connector_id, remote_ids) =>
      call<Page<RepoRow>>('POST', `${w}/repos/batch-attach`, { connector_id, remote_ids }).then(
        (r) => r.items,
      ),
    repos: () => call<Page<RepoRow>>('GET', `${w}/repos`).then((r) => r.items),
    updateRepo: (id, body) => call<RepoRow>('PATCH', `${w}/repos/${id}`, body),
    projects: () => call<Page<ProjectRow>>('GET', `${w}/projects`).then((r) => r.items),
    environments: (id) =>
      call<Page<EnvironmentRow>>('GET', `${w}/projects/${id}/environments`).then((r) => r.items),
    createEnvironment: (id, v) =>
      call<EnvironmentRow>('POST', `${w}/projects/${id}/environments`, v),
    trialBuild: (id) => call<{ flow_id: string }>('POST', `${w}/projects/${id}/trial-build`),
    flow: (id) => call<FlowStatus>('GET', `${w}/flows/${id}`),
  };
}
