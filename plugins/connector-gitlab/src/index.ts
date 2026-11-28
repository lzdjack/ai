// GitLab code-source connector (docs/06 §6.1, §10.3): GitLab REST v4 with a personal / project access
// token. Only the base URL tells a real GitLab from the simulator (07 §5.2).
import type { CodeSourceConnector, RemoteRepo, VerifyResult } from '@cloudcraft/core-protocol';
import { Type } from 'typebox';

interface Config {
  base_url: string;
}
interface Cred {
  token: string;
}

interface GlProject {
  id: number;
  name: string;
  path_with_namespace: string;
  description?: string | null;
  default_branch: string;
  http_url_to_repo: string;
  web_url?: string;
  permissions?: {
    project_access?: { access_level: number } | null;
    group_access?: { access_level: number } | null;
  };
}

const MAINTAINER = 40;

function api(config: Record<string, unknown>, credential: Record<string, unknown>) {
  const base = String((config as unknown as Config).base_url).replace(/\/$/, '');
  const token = String((credential as unknown as Cred).token);
  return async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${base}/api/v4${path}`, {
      ...init,
      headers: { 'PRIVATE-TOKEN': token, ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
    return res;
  };
}

const toRepo = (p: GlProject): RemoteRepo => ({
  remote_id: String(p.id),
  path: p.path_with_namespace,
  name: p.name,
  description: p.description ?? null,
  default_branch: p.default_branch,
  clone_url: p.http_url_to_repo,
  web_url: p.web_url ?? null,
});

const connector: CodeSourceConnector = {
  manifest: {
    id: 'connector-gitlab',
    name: 'GitLab',
    category: 'code_source',
    configSchema: Type.Object({ base_url: Type.String({ pattern: '^https?://' }) }),
    authSchema: Type.Object({ token: Type.String({ minLength: 8 }) }),
  },

  async verify(config, credential): Promise<VerifyResult> {
    const t0 = Date.now();
    const call = api(config, credential);
    try {
      const me = await call('/user');
      if (!me.ok)
        return {
          ok: false,
          latency_ms: Date.now() - t0,
          identity: null,
          scopes: [],
          has_merge_perm: null,
          visible_repo_count: null,
          error_raw: `${me.status} ${(await me.text()).slice(0, 300)}`,
        };
      const user = (await me.json()) as { username: string; name?: string };
      const projects = await call('/projects?membership=true&per_page=100&simple=false');
      const list = projects.ok ? ((await projects.json()) as GlProject[]) : [];
      const total = Number(projects.headers.get('x-total') ?? list.length);
      const levels = list
        .map((p) =>
          Math.max(
            p.permissions?.project_access?.access_level ?? 0,
            p.permissions?.group_access?.access_level ?? 0,
          ),
        )
        .filter((l) => l > 0);
      return {
        ok: true,
        latency_ms: Date.now() - t0,
        identity: user.name ? `${user.name} (@${user.username})` : `@${user.username}`,
        scopes: ['api'],
        has_merge_perm: levels.length ? levels.some((l) => l >= MAINTAINER) : null,
        visible_repo_count: total,
      };
    } catch (e) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        identity: null,
        scopes: [],
        has_merge_perm: null,
        visible_repo_count: null,
        error_raw: (e as Error).message,
      };
    }
  },

  async listRepos(config, credential, q) {
    const call = api(config, credential);
    const params = new URLSearchParams({
      membership: 'true',
      page: String(q.page),
      per_page: String(q.perPage),
      order_by: 'last_activity_at',
      ...(q.search ? { search: q.search } : {}),
    });
    const res = await call(`/projects?${params}`);
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    let items = ((await res.json()) as GlProject[]).map(toRepo);
    // servers that ignore `search` still get filtered
    if (q.search) {
      const s = q.search.toLowerCase();
      items = items.filter((r) => `${r.path} ${r.description ?? ''}`.toLowerCase().includes(s));
    }
    const next = res.headers.get('x-next-page');
    return { items, has_more: !!next };
  },

  async getRepo(config, credential, remoteId) {
    const res = await api(config, credential)(`/projects/${encodeURIComponent(remoteId)}`);
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    return toRepo((await res.json()) as GlProject);
  },

  async readFile(config, credential, remoteId, path, ref) {
    const res = await api(
      config,
      credential,
    )(
      `/projects/${encodeURIComponent(remoteId)}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    return res.text();
  },

  gitAuth(credential) {
    // GitLab accepts a token as HTTP basic password with any user name
    const token = String((credential as unknown as Cred).token);
    return {
      header: 'Authorization',
      value: `Basic ${Buffer.from(`oauth2:${token}`).toString('base64')}`,
    };
  },
};

export default connector;
