// GitLab code-source connector (docs/06 §6.1, §10.3): GitLab REST v4 with a personal / project access
// token. Only the base URL tells a real GitLab from the simulator (07 §5.2).
import {
  MergeRefused,
  type CodeSourceConnector,
  type MergeRequestInfo,
  type RemoteRepo,
  type VerifyResult,
} from '@cloudcraft/core-protocol';
import fs from 'node:fs';
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

interface GlMr {
  iid: number;
  state: 'opened' | 'merged' | 'closed' | 'locked';
  sha: string | null;
  merge_commit_sha: string | null;
  web_url?: string;
}

const toMr = (m: GlMr): MergeRequestInfo => ({
  iid: String(m.iid),
  state: m.state === 'merged' ? 'merged' : m.state === 'closed' ? 'closed' : 'open',
  head_sha: m.state === 'opened' ? m.sha : null,
  merge_sha: m.merge_commit_sha,
  web_url: m.web_url ?? null,
});

const project = (remoteId: string) => `/projects/${encodeURIComponent(remoteId)}`;

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
    icon: fs.readFileSync(new URL('./icon.svg', import.meta.url), 'utf8'),
    configSchema: Type.Object({ base_url: Type.String({ pattern: '^https?://' }) }),
    authSchema: Type.Object({ token: Type.String({ minLength: 8 }) }),
    // 合 MR 用本人的个人访问令牌（06 §6.1），和共享连接器同一种格式
    personalAuthSchema: Type.Object({ token: Type.String({ minLength: 8 }) }),
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

  async branchHead(config, credential, remoteId, branch) {
    const res = await api(
      config,
      credential,
    )(
      `/projects/${encodeURIComponent(remoteId)}/repository/branches/${encodeURIComponent(branch)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    return ((await res.json()) as { commit: { id: string } }).commit.id;
  },

  // 依据：Merge requests API —— List / Create / Get single MR
  async openMergeRequest(config, credential, remoteId, mr) {
    const call = api(config, credential);
    const q = new URLSearchParams({
      state: 'opened',
      source_branch: mr.source,
      target_branch: mr.target,
    });
    const list = await call(`${project(remoteId)}/merge_requests?${q}`);
    if (!list.ok) throw new Error(`GitLab ${list.status}`);
    const [open] = (await list.json()) as GlMr[];
    if (open) return toMr(open);
    const res = await call(`${project(remoteId)}/merge_requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source_branch: mr.source,
        target_branch: mr.target,
        title: mr.title,
        description: mr.description,
      }),
    });
    if (!res.ok) throw new Error(`GitLab ${res.status} ${(await res.text()).slice(0, 300)}`);
    return toMr((await res.json()) as GlMr);
  },

  async getMergeRequest(config, credential, remoteId, iid) {
    const res = await api(config, credential)(`${project(remoteId)}/merge_requests/${iid}`);
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    return toMr((await res.json()) as GlMr);
  },

  // 依据：「Merge a merge request」—— 401 无权限、405 不能合、406 有冲突、409 sha 不符
  async mergeMergeRequest(config, credential, remoteId, iid, o) {
    const res = await api(config, credential)(`${project(remoteId)}/merge_requests/${iid}/merge`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sha: o.expected_sha, merge_commit_message: o.message, squash: false }),
    });
    if (res.ok) return toMr((await res.json()) as GlMr);
    const text = (await res.text()).slice(0, 300);
    const reason =
      res.status === 406
        ? 'conflict'
        : res.status === 409
          ? 'head_changed'
          : res.status === 401 || res.status === 403
            ? 'forbidden'
            : res.status === 405
              ? 'not_open'
              : 'other';
    throw new MergeRefused(reason, `GitLab ${res.status} ${text}`);
  },

  // 依据：Repositories API「Merge Base」：a 是 b 的祖先 ⇔ merge_base(a, b) = a
  async isAncestor(config, credential, remoteId, ancestor, descendant) {
    if (ancestor === descendant) return true;
    const q = new URLSearchParams();
    q.append('refs[]', ancestor);
    q.append('refs[]', descendant);
    const res = await api(config, credential)(`${project(remoteId)}/repository/merge_base?${q}`);
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`GitLab ${res.status}`);
    return ((await res.json()) as { id: string }).id === ancestor;
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
