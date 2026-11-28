// 模拟 GitLab（07 §5.1）。依据：GitLab 官方 REST v4 文档 https://docs.gitlab.com/api/rest/
// 只实现连接器会用到的部分；报文字段按官方文档取子集，额外字段不造。
import crypto from 'node:crypto';
import path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';
import type { Faults } from '../faults.ts';
import type { GitlabHook, GitlabMr, GitlabProject, GitlabUser, StateStore } from '../state.ts';
import { GitError, Repo, httpBackend, type Commit } from './git.ts';
import { deliver, type Delivery } from './webhooks.ts';

const now = () => new Date().toISOString();

type Req = FastifyRequest<{
  Params: Record<string, string>;
  Querystring: Record<string, string | undefined>;
  Body: Record<string, unknown> | undefined;
}>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(JSON.stringify(body));
  }
}
const notFound = (what: string) => new HttpError(404, { message: `404 ${what} Not Found` });
const unauthorized = () => new HttpError(401, { message: '401 Unauthorized' });
const forbidden = () => new HttpError(403, { message: '403 Forbidden' });
const missing = (field: string) => new HttpError(400, { error: `${field} is missing` });

export const UserInput = Type.Object({
  username: Type.String({ pattern: '^[a-z0-9][a-z0-9_.-]*$' }),
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  role: Type.Union([Type.Literal('maintainer'), Type.Literal('developer')]),
  push_branch_patterns: Type.Optional(Type.Array(Type.String())),
});

export const ProjectInput = Type.Object({
  path_with_namespace: Type.String({ pattern: '^[a-z0-9][a-z0-9_.-]*(/[a-z0-9][a-z0-9_.-]*)+$' }),
  default_branch: Type.Optional(Type.String({ default: 'main' })),
});

export class GitlabSim {
  readonly deliveries: Delivery[] = [];

  constructor(
    private readonly store: StateStore,
    private readonly reposDir: string,
    private readonly faults: Faults,
  ) {}

  private get s() {
    return this.store.data.gitlab;
  }

  // ── 控制面（种子数据、控制台用；不是 GitLab 接口）────────────────

  addUser(input: Static<typeof UserInput>): GitlabUser {
    if (this.s.users.some((u) => u.username === input.username))
      throw new HttpError(409, { message: 'username has already been taken' });
    const user: GitlabUser = {
      id: this.store.nextId(),
      username: input.username,
      name: input.name ?? input.username,
      email: input.email ?? `${input.username}@sim.local`,
      role: input.role,
      push_branch_patterns: input.push_branch_patterns ?? [],
      token: `simpat-${crypto.randomBytes(16).toString('hex')}`,
    };
    this.s.users.push(user);
    this.store.save();
    return user;
  }

  addProject(input: Static<typeof ProjectInput>): GitlabProject {
    if (this.s.projects.some((p) => p.path_with_namespace === input.path_with_namespace))
      throw new HttpError(409, { message: 'path has already been taken' });
    const branch = input.default_branch ?? 'main';
    Repo.init(this.repoDir(input.path_with_namespace), branch);
    const p: GitlabProject = {
      id: this.store.nextId(),
      path_with_namespace: input.path_with_namespace,
      default_branch: branch,
      protected_branches: [branch],
      created_at: now(),
    };
    this.s.projects.push(p);
    this.store.save();
    return p;
  }

  /** 首次启动时建两个账号：Bot（只能推 fix/*、port/*）和审核人（维护者） */
  seedUsers(): void {
    if (this.s.users.length > 0) return;
    this.addUser({
      username: 'cc-bot',
      name: '云匠 Bot',
      role: 'developer',
      push_branch_patterns: ['fix/*', 'port/*'],
    });
    this.addUser({ username: 'qa-reviewer', name: '质检审核人', role: 'maintainer' });
  }

  // ── 内部工具 ───────────────────────────────────────────────

  private repoDir(pathWithNamespace: string): string {
    return path.join(this.reposDir, `${pathWithNamespace}.git`);
  }

  private repo(p: GitlabProject): Repo {
    return new Repo(this.repoDir(p.path_with_namespace));
  }

  /** 依据：官方文档「Authentication」——PRIVATE-TOKEN 头或 Authorization: Bearer */
  private auth(req: FastifyRequest): GitlabUser {
    const h = req.headers;
    const bearer = /^Bearer (.+)$/.exec(h.authorization ?? '')?.[1];
    const token = (h['private-token'] as string | undefined) ?? bearer;
    const user = token ? this.s.users.find((u) => u.token === token) : undefined;
    if (!user) throw unauthorized();
    return user;
  }

  /** 依据：官方文档——:id 可以是数字 ID 或 URL 编码的完整路径 */
  private project(id: string | undefined): GitlabProject {
    const key = decodeURIComponent(id ?? '');
    const p = this.s.projects.find((x) => String(x.id) === key || x.path_with_namespace === key);
    if (!p) throw notFound('Project');
    return p;
  }

  private mr(p: GitlabProject, iid: string | undefined): GitlabMr {
    const m = this.s.merge_requests.find((x) => x.project_id === p.id && String(x.iid) === iid);
    if (!m) throw notFound('Merge Request');
    return m;
  }

  private userDto(u: GitlabUser | undefined, base: string) {
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      state: 'active',
      avatar_url: null,
      web_url: `${base}/${u.username}`,
    };
  }

  private projectDto(p: GitlabProject, base: string) {
    const [ns = ''] = p.path_with_namespace.split(/\/(?=[^/]+$)/);
    const name = p.path_with_namespace.split('/').pop() ?? '';
    return {
      id: p.id,
      name,
      path: name,
      path_with_namespace: p.path_with_namespace,
      name_with_namespace: p.path_with_namespace.replaceAll('/', ' / '),
      namespace: { name: ns, path: ns.split('/').pop(), full_path: ns, kind: 'group' },
      default_branch: p.default_branch,
      visibility: 'private',
      http_url_to_repo: `${base}/${p.path_with_namespace}.git`,
      web_url: `${base}/${p.path_with_namespace}`,
      created_at: p.created_at,
    };
  }

  private commitDto(c: Commit, p: GitlabProject, base: string) {
    return {
      ...c,
      short_id: c.id.slice(0, 8),
      created_at: c.committed_date,
      web_url: `${base}/${p.path_with_namespace}/-/commit/${c.id}`,
    };
  }

  private branchDto(p: GitlabProject, name: string, sha: string, base: string) {
    const repo = this.repo(p);
    const commit = repo.commit(sha);
    const defaultSha = repo.resolve(p.default_branch);
    const isProtected = p.protected_branches.includes(name);
    return {
      name,
      commit: commit && this.commitDto(commit, p, base),
      merged: name !== p.default_branch && !!defaultSha && repo.isAncestor(sha, defaultSha),
      protected: isProtected,
      default: name === p.default_branch,
      developers_can_push: !isProtected,
      developers_can_merge: !isProtected,
      web_url: `${base}/${p.path_with_namespace}/-/tree/${name}`,
    };
  }

  /** 冲突状态现算：源分支和目标分支试合并（假设：只区分 mergeable / conflict / 分支不存在）。
   *  注入的 merge_conflict 故障只作用于合并接口（表现为合并时 406），不改这里 */
  private mergeStatus(p: GitlabMr, project: GitlabProject) {
    if (p.state !== 'opened') return { detailed_merge_status: 'not_open', has_conflicts: false };
    const repo = this.repo(project);
    const src = repo.resolve(p.source_branch);
    const tgt = repo.resolve(p.target_branch);
    if (!src || !tgt) return { detailed_merge_status: 'not_open', has_conflicts: false };
    const conflict = repo.mergeTree(tgt, src) === null;
    return { detailed_merge_status: conflict ? 'conflict' : 'mergeable', has_conflicts: conflict };
  }

  private mrDto(m: GitlabMr, base: string) {
    const project = this.s.projects.find((p) => p.id === m.project_id)!;
    const repo = this.repo(project);
    const byId = (id: number | null) => this.s.users.find((u) => u.id === id);
    return {
      id: m.id,
      iid: m.iid,
      project_id: m.project_id,
      title: m.title,
      description: m.description,
      state: m.state,
      source_branch: m.source_branch,
      target_branch: m.target_branch,
      source_project_id: m.project_id,
      target_project_id: m.project_id,
      author: this.userDto(byId(m.author_id), base),
      merged_by: this.userDto(byId(m.merged_by_id), base),
      merge_user: this.userDto(byId(m.merged_by_id), base),
      sha: m.state === 'opened' ? repo.resolve(m.source_branch) : null,
      merge_commit_sha: m.merge_commit_sha,
      ...this.mergeStatus(m, project),
      created_at: m.created_at,
      updated_at: m.updated_at,
      merged_at: m.merged_at,
      closed_at: m.closed_at,
      references: { full: `${project.path_with_namespace}!${m.iid}` },
      web_url: `${base}/${project.path_with_namespace}/-/merge_requests/${m.iid}`,
    };
  }

  private fire(p: GitlabProject, event: 'push' | 'merge_request', payload: object): void {
    for (const h of this.s.hooks.filter((x) => x.project_id === p.id)) {
      if (event === 'push' ? h.push_events : h.merge_requests_events)
        void deliver(h, event, payload, this.deliveries);
    }
  }

  private mrEvent(m: GitlabMr, action: string, user: GitlabUser, base: string) {
    const project = this.s.projects.find((p) => p.id === m.project_id)!;
    const dto = this.mrDto(m, base);
    this.fire(project, 'merge_request', {
      object_kind: 'merge_request',
      event_type: 'merge_request',
      user: this.userDto(user, base),
      project: this.projectDto(project, base),
      object_attributes: {
        ...dto,
        action,
        url: dto.web_url,
        last_commit: { id: dto.sha ?? m.merge_commit_sha },
      },
    });
  }

  // ── 路由 ───────────────────────────────────────────────────

  register(app: FastifyInstance): void {
    // git 推拉报文原样交给 http-backend，不让 Fastify 解析
    app.addContentTypeParser(/^application\/x-git-/, (_req, _payload, done) => done(null));

    const base = (req: FastifyRequest) => `${req.protocol}://${req.host}`;
    const wrap =
      (fn: (req: Req, reply: FastifyReply) => unknown) => async (req: Req, reply: FastifyReply) => {
        try {
          return await fn(req, reply);
        } catch (e) {
          if (e instanceof HttpError) return reply.code(e.status).send(e.body);
          if (e instanceof GitError) return reply.code(500).send({ message: e.message });
          throw e;
        }
      };
    const api = (
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: string,
      fn: (req: Req, reply: FastifyReply) => unknown,
    ) => app.route({ method, url: `/api/v4${url}`, handler: wrap(fn) });

    // 控制面
    app.get('/__sim/gitlab/users', async () => this.s.users);
    app.post(
      '/__sim/gitlab/users',
      { schema: { body: UserInput } },
      wrap((req, reply) => {
        reply.code(201);
        return this.addUser(req.body as Static<typeof UserInput>);
      }),
    );
    app.post(
      '/__sim/gitlab/projects',
      { schema: { body: ProjectInput } },
      wrap((req, reply) => {
        reply.code(201);
        return this.projectDto(this.addProject(req.body as Static<typeof ProjectInput>), base(req));
      }),
    );

    // 依据：Users API「List current user」
    api('GET', '/user', (req) => ({
      ...this.userDto(this.auth(req), base(req)),
      email: this.auth(req).email,
    }));

    // 依据：Projects API
    api('GET', '/projects', (req, reply) => {
      this.auth(req);
      return paginate(
        req,
        reply,
        this.s.projects.map((p) => this.projectDto(p, base(req))),
      );
    });
    api('GET', '/projects/:id', (req) => {
      this.auth(req);
      return this.projectDto(this.project(req.params.id), base(req));
    });

    // 依据：Branches API
    api('GET', '/projects/:id/repository/branches', (req, reply) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const search = req.query.search;
      const list = [...this.repo(p).branches()]
        .filter(([n]) => !search || n.includes(search))
        .map(([n, sha]) => this.branchDto(p, n, sha, base(req)));
      return paginate(req, reply, list);
    });
    api('GET', '/projects/:id/repository/branches/:branch', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const name = decodeURIComponent(req.params.branch ?? '');
      const sha = this.repo(p).branches().get(name);
      if (!sha) throw notFound('Branch');
      return this.branchDto(p, name, sha, base(req));
    });
    api('POST', '/projects/:id/repository/branches', (req, reply) => {
      const user = this.auth(req);
      const p = this.project(req.params.id);
      const { branch, ref } = { ...req.query, ...req.body } as { branch?: string; ref?: string };
      if (!branch) throw missing('branch');
      if (!ref) throw missing('ref');
      const repo = this.repo(p);
      const sha = repo.resolve(ref);
      if (!sha) throw new HttpError(400, { message: 'Invalid reference name' });
      if (repo.branches().has(branch))
        throw new HttpError(400, { message: 'Branch already exists' });
      if (!branchAllowed(user, branch)) throw forbidden();
      repo.git(['update-ref', `refs/heads/${branch}`, sha]);
      reply.code(201);
      return this.branchDto(p, branch, sha, base(req));
    });

    // 依据：Commits API
    api('GET', '/projects/:id/repository/commits', (req, reply) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const repo = this.repo(p);
      const ref = req.query.ref_name ?? p.default_branch;
      if (!repo.resolve(ref)) return [];
      const { page, perPage } = pageArgs(req);
      const list = repo
        .commits(ref, perPage, (page - 1) * perPage)
        .map((c) => this.commitDto(c, p, base(req)));
      setPageHeaders(reply, page, perPage, null);
      return list;
    });
    api('GET', '/projects/:id/repository/commits/:sha', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const c = this.repo(p).commit(req.params.sha ?? '');
      if (!c) throw notFound('Commit');
      return this.commitDto(c, p, base(req));
    });

    // 依据：Repositories API「Compare branches, tags or commits」
    api('GET', '/projects/:id/repository/compare', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const repo = this.repo(p);
      const from = repo.resolve(req.query.from ?? '');
      const to = repo.resolve(req.query.to ?? '');
      if (!from || !to) throw notFound('Ref');
      const straight = req.query.straight === 'true';
      const commits = repo.commitsBetween(from, to).map((c) => this.commitDto(c, p, base(req)));
      return {
        commit: commits[0] ?? null,
        commits: commits.reverse(),
        diffs: repo.diff(from, to, straight),
        compare_same_ref: from === to,
        web_url: `${base(req)}/${p.path_with_namespace}/-/compare/${from}...${to}`,
      };
    });

    // 依据：Repositories API「Merge Base」——GET .../repository/merge_base?refs[]=a&refs[]=b
    api('GET', '/projects/:id/repository/merge_base', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const repo = this.repo(p);
      const raw = (req.query as Record<string, string | string[] | undefined>)['refs[]'];
      const refs = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((r) => repo.resolve(r));
      if (refs.length !== 2 || refs.some((r) => !r))
        throw new HttpError(400, { message: 'Provide exactly two refs' });
      const sha = repo.mergeBase(refs[0]!, refs[1]!);
      const c = sha ? repo.commit(sha) : null;
      if (!c) throw notFound('Merge Base');
      return this.commitDto(c, p, base(req));
    });

    // 依据：Repository files API「Get raw file」
    api('GET', '/projects/:id/repository/files/:file/raw', (req, reply) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const buf = this.repo(p).rawFile(
        req.query.ref ?? p.default_branch,
        decodeURIComponent(req.params.file ?? ''),
      );
      if (!buf) throw notFound('File');
      return reply.type('text/plain; charset=utf-8').send(buf);
    });

    // 依据：Merge requests API
    api('GET', '/projects/:id/merge_requests', (req, reply) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const { state, source_branch, target_branch } = req.query;
      const list = this.s.merge_requests
        .filter(
          (m) =>
            m.project_id === p.id &&
            (!state || state === 'all' || m.state === state) &&
            (!source_branch || m.source_branch === source_branch) &&
            (!target_branch || m.target_branch === target_branch),
        )
        .sort((a, b) => b.iid - a.iid)
        .map((m) => this.mrDto(m, base(req)));
      return paginate(req, reply, list);
    });
    api('GET', '/projects/:id/merge_requests/:iid', (req) => {
      this.auth(req);
      return this.mrDto(this.mr(this.project(req.params.id), req.params.iid), base(req));
    });
    api('GET', '/projects/:id/merge_requests/:iid/changes', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      const m = this.mr(p, req.params.iid);
      const repo = this.repo(p);
      const src = m.merge_commit_sha ? `${m.merge_commit_sha}^2` : m.source_branch;
      const tgt = m.merge_commit_sha ? `${m.merge_commit_sha}^1` : m.target_branch;
      const a = repo.resolve(tgt);
      const b = repo.resolve(src);
      return { ...this.mrDto(m, base(req)), changes: a && b ? repo.diff(a, b) : [] };
    });
    api('POST', '/projects/:id/merge_requests', (req, reply) => {
      const user = this.auth(req);
      const p = this.project(req.params.id);
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      for (const f of ['source_branch', 'target_branch', 'title'] as const)
        if (!body[f]) throw missing(f);
      const repo = this.repo(p);
      if (!repo.resolve(body.source_branch!) || !repo.resolve(body.target_branch!))
        throw new HttpError(400, { message: ['Source branch or target branch does not exist'] });
      if (
        this.s.merge_requests.some(
          (m) =>
            m.project_id === p.id &&
            m.state === 'opened' &&
            m.source_branch === body.source_branch &&
            m.target_branch === body.target_branch,
        )
      )
        throw new HttpError(409, {
          message: ['Another open merge request already exists for this source branch'],
        });
      const t = now();
      const m: GitlabMr = {
        id: this.store.nextId(),
        iid: this.s.merge_requests.filter((x) => x.project_id === p.id).length + 1,
        project_id: p.id,
        title: body.title!,
        description: body.description ?? '',
        source_branch: body.source_branch!,
        target_branch: body.target_branch!,
        state: 'opened',
        author_id: user.id,
        merged_by_id: null,
        merge_commit_sha: null,
        created_at: t,
        updated_at: t,
        merged_at: null,
        closed_at: null,
      };
      this.s.merge_requests.push(m);
      this.store.save();
      this.mrEvent(m, 'open', user, base(req));
      reply.code(201);
      return this.mrDto(m, base(req));
    });
    api('PUT', '/projects/:id/merge_requests/:iid', (req) => {
      const user = this.auth(req);
      const p = this.project(req.params.id);
      const m = this.mr(p, req.params.iid);
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      if (body.title) m.title = body.title;
      if (body.description !== undefined) m.description = body.description;
      if (body.state_event === 'close' && m.state === 'opened')
        [m.state, m.closed_at] = ['closed', now()];
      if (body.state_event === 'reopen' && m.state === 'closed')
        [m.state, m.closed_at] = ['opened', null];
      m.updated_at = now();
      this.store.save();
      const action =
        body.state_event === 'close'
          ? 'close'
          : body.state_event === 'reopen'
            ? 'reopen'
            : 'update';
      this.mrEvent(m, action, user, base(req));
      return this.mrDto(m, base(req));
    });
    // 依据：「Merge a merge request」——405 不能合、406 有冲突、409 sha 不符、401 无权限
    api('PUT', '/projects/:id/merge_requests/:iid/merge', (req) => {
      const user = this.auth(req);
      const p = this.project(req.params.id);
      const m = this.mr(p, req.params.iid);
      if (m.state !== 'opened') throw new HttpError(405, { message: '405 Method Not Allowed' });
      if (p.protected_branches.includes(m.target_branch) && user.role !== 'maintainer')
        throw unauthorized();
      const repo = this.repo(p);
      const src = repo.resolve(m.source_branch);
      const tgt = repo.resolve(m.target_branch);
      if (!src || !tgt) throw new HttpError(405, { message: '405 Method Not Allowed' });
      const body = (req.body ?? {}) as Record<string, string | undefined>;
      if (body.sha && body.sha !== src)
        throw new HttpError(409, { message: 'SHA does not match HEAD of source branch' });
      const forced = this.faults.take('gitlab', ['merge_conflict'], req.method, req.url);
      const tree = forced ? null : repo.mergeTree(tgt, src);
      if (!tree) throw new HttpError(406, { message: 'Branch cannot be merged' });
      const message =
        body.merge_commit_message ??
        `Merge branch '${m.source_branch}' into '${m.target_branch}'\n\n${m.title}\n\nSee merge request ${p.path_with_namespace}!${m.iid}`;
      const sha = repo.mergeCommit({
        tree,
        targetBranch: m.target_branch,
        targetSha: tgt,
        sourceSha: src,
        message,
        author: { name: user.name, email: user.email },
      });
      const t = now();
      Object.assign(m, {
        state: 'merged',
        merge_commit_sha: sha,
        merged_by_id: user.id,
        merged_at: t,
        updated_at: t,
      });
      if (
        body.should_remove_source_branch === 'true' ||
        (body.should_remove_source_branch as unknown) === true
      )
        repo.git(['update-ref', '-d', `refs/heads/${m.source_branch}`]);
      this.store.save();
      this.mrEvent(m, 'merge', user, base(req));
      this.pushEvent(p, m.target_branch, tgt, sha, user, base(req));
      return this.mrDto(m, base(req));
    });

    // 依据：Protected branches API「Protect repository branches」——只做按名字保护
    api('POST', '/projects/:id/protected_branches', (req, reply) => {
      const user = this.auth(req);
      if (user.role !== 'maintainer') throw forbidden();
      const p = this.project(req.params.id);
      const { name } = { ...req.query, ...req.body } as { name?: string };
      if (!name) throw missing('name');
      if (p.protected_branches.includes(name))
        throw new HttpError(409, { message: 'Protected branch already exists' });
      p.protected_branches.push(name);
      this.store.save();
      reply.code(201);
      return {
        name,
        push_access_levels: [{ access_level: 40 }],
        merge_access_levels: [{ access_level: 40 }],
      };
    });

    // 依据：Project webhooks API
    api('GET', '/projects/:id/hooks', (req) => {
      this.auth(req);
      const p = this.project(req.params.id);
      return this.s.hooks.filter((h) => h.project_id === p.id).map(hookDto);
    });
    api('POST', '/projects/:id/hooks', (req, reply) => {
      const user = this.auth(req);
      if (user.role !== 'maintainer') throw forbidden();
      const p = this.project(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (typeof body.url !== 'string') throw missing('url');
      const h: GitlabHook = {
        id: this.store.nextId(),
        project_id: p.id,
        url: body.url,
        token: typeof body.token === 'string' ? body.token : null,
        push_events: body.push_events !== false,
        merge_requests_events: body.merge_requests_events === true,
        created_at: now(),
      };
      this.s.hooks.push(h);
      this.store.save();
      reply.code(201);
      return hookDto(h);
    });
    api('DELETE', '/projects/:id/hooks/:hook_id', (req, reply) => {
      const user = this.auth(req);
      if (user.role !== 'maintainer') throw forbidden();
      const p = this.project(req.params.id);
      const before = this.s.hooks.length;
      this.s.hooks = this.s.hooks.filter(
        (h) => !(h.project_id === p.id && String(h.id) === req.params.hook_id),
      );
      if (this.s.hooks.length === before) throw notFound('Hook');
      this.store.save();
      return reply.code(204).send();
    });

    // git smart HTTP：/<命名空间>/<项目>.git/(info/refs|git-upload-pack|git-receive-pack)
    // 依据：官方文档——HTTPS 克隆用户名任意、密码填个人访问令牌
    const gitRoute = wrap(async (req, reply) => {
      const m = /^\/(.+?)\.git(\/(?:info\/refs|git-upload-pack|git-receive-pack))(?:\?|$)/.exec(
        req.url,
      );
      if (!m) throw notFound('Project');
      const [, projectPath = '', rest = ''] = m;
      const user = this.basicAuth(req);
      if (!user) {
        reply.header('WWW-Authenticate', 'Basic realm="GitLab"');
        throw unauthorized();
      }
      const p = this.s.projects.find((x) => x.path_with_namespace === projectPath);
      if (!p) throw notFound('Project');
      const isPush = rest === '/git-receive-pack';
      const before = isPush ? this.repo(p).branches() : null;
      await httpBackend(req, reply, {
        projectRoot: this.reposDir,
        pathInfo: `/${projectPath}.git${rest}`,
        user: user.username,
        hookEnv: {
          CC_SIM_ROLE: user.role,
          CC_SIM_PROTECTED: p.protected_branches.join(','),
          CC_SIM_PUSH_PATTERNS: user.push_branch_patterns.join(' '),
        },
      });
      if (before) {
        const after = this.repo(p).branches();
        for (const name of new Set([...before.keys(), ...after.keys()])) {
          const [a, b] = [before.get(name), after.get(name)];
          if (a !== b) this.pushEvent(p, name, a ?? null, b ?? null, user, base(req));
        }
      }
    });
    app.get('/*', gitRoute);
    app.post('/*', gitRoute);
  }

  private basicAuth(req: FastifyRequest): GitlabUser | undefined {
    const m = /^Basic (.+)$/.exec(req.headers.authorization ?? '');
    if (!m?.[1]) return undefined;
    const decoded = Buffer.from(m[1], 'base64').toString();
    const token = decoded.slice(decoded.indexOf(':') + 1);
    return this.s.users.find((u) => u.token === token);
  }

  /** 依据：Webhook events「Push events」 */
  private pushEvent(
    p: GitlabProject,
    branch: string,
    before: string | null,
    after: string | null,
    user: GitlabUser,
    base: string,
  ): void {
    const zero = '0'.repeat(40);
    const repo = this.repo(p);
    const commits = after
      ? before
        ? repo.commitsBetween(before, after)
        : repo.commits(after, 20)
      : [];
    this.fire(p, 'push', {
      object_kind: 'push',
      event_name: 'push',
      before: before ?? zero,
      after: after ?? zero,
      ref: `refs/heads/${branch}`,
      checkout_sha: after,
      user_id: user.id,
      user_name: user.name,
      user_username: user.username,
      project_id: p.id,
      project: this.projectDto(p, base),
      commits: commits.slice(0, 20).map((c) => ({
        id: c.id,
        message: c.message,
        title: c.title,
        timestamp: c.committed_date,
        author: { name: c.author_name, email: c.author_email },
      })),
      total_commits_count: commits.length,
    });
  }
}

/** 令牌不回传（官方接口同样不返回） */
function hookDto(h: GitlabHook) {
  return Object.fromEntries(Object.entries(h).filter(([k]) => k !== 'token'));
}

/** 依据：官方文档「Protected branches / wildcard」——通配符 * 匹配任意字符（含 /），和推送钩子一致 */
function branchAllowed(user: GitlabUser, branch: string): boolean {
  if (user.push_branch_patterns.length === 0) return true;
  return user.push_branch_patterns.some((p) =>
    new RegExp(
      `^${p
        .split('*')
        .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    ).test(branch),
  );
}

// 依据：官方文档「Pagination」——page / per_page，X-Total 等响应头
function pageArgs(req: Req): { page: number; perPage: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 20));
  return { page, perPage };
}

function setPageHeaders(
  reply: FastifyReply,
  page: number,
  perPage: number,
  total: number | null,
): void {
  reply.header('X-Page', String(page)).header('X-Per-Page', String(perPage));
  if (total === null) return;
  const pages = Math.max(1, Math.ceil(total / perPage));
  reply
    .header('X-Total', String(total))
    .header('X-Total-Pages', String(pages))
    .header('X-Next-Page', page < pages ? String(page + 1) : '');
}

function paginate<T>(req: Req, reply: FastifyReply, list: T[]): T[] {
  const { page, perPage } = pageArgs(req);
  setPageHeaders(reply, page, perPage, list.length);
  return list.slice((page - 1) * perPage, page * perPage);
}
