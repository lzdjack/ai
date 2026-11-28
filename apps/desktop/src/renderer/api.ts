// Talks to cc-app (docs/06 §1.3, §10.1): Bearer access token, refreshed once on 401 with the stored
// refresh token. In the browser the tokens live in localStorage ("remember me") or sessionStorage;
// U2 moves them to Electron safeStorage through HostPlatformAdapter.secureStorage.
import type {
  ConnectorRow,
  EnvAccountRow,
  HealthCheckResponse,
  RemoteBranch,
  DeliveryView,
  ReleaseList,
  MergeReviewRequest,
  PersonalAccountRow,
  RetestRequest,
  StartTestReleaseRequest,
  EnvironmentRow,
  FlowStatus,
  Me,
  PluginInfo,
  ProjectRow,
  RemoteRepo,
  RepoRow,
  ReviewRequest,
  TicketDetail,
  TicketSummary,
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
    readonly data?: Record<string, unknown>,
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
      (json.data as Record<string, unknown> | undefined) ?? undefined,
    );
  return json as T;
}

/** The change stream of a workspace (06 §3.7), opened with a one-time ticket good for 15 seconds. */
export async function streamUrl(workspaceId: string): Promise<string> {
  const { ticket } = await call<{ ticket: string }>('POST', '/v1/ws-ticket', {
    workspace_id: workspaceId,
  });
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/v1/ws?ticket=${encodeURIComponent(ticket)}`;
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
    updateConnector: (id, body) => call<ConnectorRow>('PATCH', `${w}/connectors/${id}`, body),
    deleteConnector: (id) => call<unknown>('DELETE', `${w}/connectors/${id}`),
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
    branches: (id, q) =>
      call<Page<RemoteBranch>>(
        'GET',
        `${w}/repos/${id}/branches${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      ).then((r) => r.items),
    projects: () => call<Page<ProjectRow>>('GET', `${w}/projects`).then((r) => r.items),
    environments: (id) =>
      call<Page<EnvironmentRow>>('GET', `${w}/projects/${id}/environments`).then((r) => r.items),
    createEnvironment: (id, v) =>
      call<EnvironmentRow>('POST', `${w}/projects/${id}/environments`, v),
    envAccounts: (id) =>
      call<Page<EnvAccountRow>>('GET', `${w}/projects/${id}/env-accounts`).then((r) => r.items),
    createEnvAccount: (id, env, body) =>
      call('POST', `${w}/projects/${id}/environments/${env}/accounts`, body),
    tryEnvAccount: (id, env, body) =>
      call('POST', `${w}/projects/${id}/environments/${env}/accounts/try`, body),
    updateEnvAccount: (id, account, body) =>
      call('PATCH', `${w}/projects/${id}/env-accounts/${account}`, body),
    deleteEnvAccount: (id, account) =>
      call<unknown>('DELETE', `${w}/projects/${id}/env-accounts/${account}`),
    healthCheck: () => call<HealthCheckResponse>('POST', `${w}/onboarding/health-check`),
    trialBuild: (id) => call<{ flow_id: string }>('POST', `${w}/projects/${id}/trial-build`),
    flow: (id) => call<FlowStatus>('GET', `${w}/flows/${id}`),
  };
}

/** The workbench's ticket calls in one workspace (06 §2.5; 05 steps 3–4). */
export function ticketCalls(ws: string) {
  const w = `/v1/workspaces/${ws}`;
  return {
    list: () => call<Page<TicketSummary>>('GET', `${w}/tickets`).then((r) => r.items),
    detail: (id: string) => call<TicketDetail>('GET', `${w}/tickets/${id}`),
    review: (id: string, body: ReviewRequest) =>
      call<TicketDetail>('POST', `${w}/tickets/${id}/review`, body),
    create: (projectId: string, body: { title: string; body: string; priority: string }) =>
      call<TicketSummary>('POST', `${w}/projects/${projectId}/tickets`, body),
    /** an evidence image as an object URL (the request carries the session's token) */
    async evidence(id: string): Promise<string> {
      let r = await raw('GET', `${w}/evidence/${id}`);
      if (r.status === 401 && session && (await refresh()))
        r = await raw('GET', `${w}/evidence/${id}`);
      if (!r.ok) throw new ApiError(r.status, 'evidence.not_found', r.statusText);
      return URL.createObjectURL(await r.blob());
    },
  };
}
export type TicketCalls = ReturnType<typeof ticketCalls>;

/** A ticket's release tab (06 §3.3; 05 steps 5–12) and the caller's own accounts (设置 → 我的账号). */
export function deliveryCalls(ws: string) {
  const w = `/v1/workspaces/${ws}`;
  const d = (id: string) => `${w}/tickets/${id}/delivery`;
  return {
    /** a round's delivery; without a round, the one under way */
    view: (id: string, roundNo?: number) =>
      call<DeliveryView>('GET', roundNo ? `${d(id)}?round_no=${roundNo}` : d(id)),
    /** every ticket's releases the caller can see, for the Dock (docs/02 Dock「发布」定案) */
    releases: () => call<ReleaseList>('GET', `${w}/releases`),
    startTest: (id: string, body: StartTestReleaseRequest) =>
      call<unknown>('POST', `${d(id)}/test`, body),
    reviewMerge: (id: string, body: MergeReviewRequest) =>
      call<unknown>('POST', `${d(id)}/merge-review`, body),
    retest: (id: string, body: RetestRequest) => call<unknown>('POST', `${d(id)}/retest`, body),
    requestMain: (id: string) => call<unknown>('POST', `${d(id)}/main`),
    releaseProd: (id: string) => call<unknown>('POST', `${d(id)}/production`),
    retry: (id: string, node_key: string) => call<unknown>('POST', `${d(id)}/retry`, { node_key }),
    accounts: () => call<Page<PersonalAccountRow>>('GET', `${w}/me/accounts`).then((r) => r.items),
    saveAccount: (connectorId: string, credential: Record<string, string>) =>
      call<unknown>('PUT', `${w}/me/accounts/${connectorId}`, { credential }),
    /** people who can retest; empty when the caller may not list members */
    members: () =>
      call<Page<{ user_id: string; display_name: string }>>('GET', `${w}/members`).then(
        (r) => r.items.map((m) => ({ id: m.user_id, name: m.display_name })),
        () => [] as { id: string; name: string }[],
      ),
  };
}
