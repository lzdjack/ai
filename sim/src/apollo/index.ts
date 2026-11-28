// 模拟 Apollo 配置中心（07 §5.1；06 §7.4「个人账号三段写回」）。
// 依据：apollo-portal 的 Portal 接口（ItemController、ReleaseController、NamespaceController），
//   https://github.com/apolloconfig/apollo/tree/master/apollo-portal 。只做发布用到的子集：
//   读命名空间配置、改一个配置项、发布、读当前生效的发布。
// 假设：登录方式（06 §15 第 4 项未实测）——按 Portal 默认的表单登录 POST /signin 拿 Cookie；
//   报文字段取官方结构的子集。权限只按「用户 × 应用 × 环境」区分。
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';
import type { Faults } from '../faults.ts';
import type { StateStore } from '../state.ts';

export interface ApolloUser {
  username: string;
  password: string;
  name: string;
  /** 能改配置、能发布的 应用:环境，如 demo-web:TEST；* 表示全部 */
  grants: string[];
}

export interface ApolloRelease {
  id: number;
  app_id: string;
  env: string;
  cluster: string;
  namespace: string;
  name: string;
  comment: string;
  configurations: Record<string, string>;
  released_by: string;
  released_at: string;
}

export interface ApolloState {
  users: ApolloUser[];
  /** 草稿配置：应用/环境/集群/命名空间 → 键 → 值 */
  items: Record<string, Record<string, string>>;
  releases: ApolloRelease[];
}

export const emptyApollo = (): ApolloState => ({ users: [], items: {}, releases: [] });

export const ApolloUserInput = Type.Object({
  username: Type.String({ pattern: '^[a-z0-9][a-z0-9_.-]*$' }),
  password: Type.String({ minLength: 6 }),
  name: Type.Optional(Type.String()),
  grants: Type.Optional(Type.Array(Type.String())),
});

const nsKey = (app: string, env: string, cluster: string, ns: string) =>
  `${app}/${env.toUpperCase()}/${cluster}/${ns}`;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(JSON.stringify(body));
  }
}

interface NsParams {
  appId: string;
  env: string;
  cluster: string;
  ns: string;
}

type Req = FastifyRequest<{ Params: Record<string, string>; Body: Record<string, unknown> }>;

export class ApolloSim {
  /** 登录会话：Cookie 值 → 用户名（重启即失效，和真实会话一样要重新登录） */
  private readonly sessions = new Map<string, string>();

  constructor(
    private readonly store: StateStore,
    private readonly faults: Faults,
  ) {}

  private get s(): ApolloState {
    this.store.data.apollo ??= emptyApollo();
    return this.store.data.apollo;
  }

  addUser(input: Static<typeof ApolloUserInput>): ApolloUser {
    if (this.s.users.some((u) => u.username === input.username))
      throw new HttpError(409, { message: 'user exists' });
    const u = {
      username: input.username,
      password: input.password,
      name: input.name ?? input.username,
      grants: input.grants ?? ['*'],
    };
    this.s.users.push(u);
    this.store.save();
    return u;
  }

  /** 首次启动时建一个发布账号（所有应用、所有环境都能发） */
  seedUsers(): void {
    if (this.s.users.length > 0) return;
    this.addUser({ username: 'qa-releaser', password: 'sim-apollo-pass', name: '质检发布人' });
  }

  /** 某环境某命名空间当前生效的发布；环境站点按它决定显示哪个版本 */
  active(app: string, env: string, cluster: string, ns: string): ApolloRelease | null {
    const k = nsKey(app, env, cluster, ns);
    const list = this.s.releases.filter(
      (r) => nsKey(r.app_id, r.env, r.cluster, r.namespace) === k,
    );
    return list.at(-1) ?? null;
  }

  private user(req: FastifyRequest): ApolloUser {
    const sid = /(?:^|;\s*)JSESSIONID=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const name = sid ? this.sessions.get(sid) : undefined;
    const u = name ? this.s.users.find((x) => x.username === name) : undefined;
    if (!u) throw new HttpError(401, { status: 401, message: 'Unauthorized' });
    return u;
  }

  private allowed(u: ApolloUser, app: string, env: string) {
    if (!u.grants.some((g) => g === '*' || g === `${app}:${env.toUpperCase()}`))
      throw new HttpError(403, { status: 403, message: 'no permission' });
  }

  register(app: FastifyInstance): void {
    const wrap =
      (fn: (req: Req, reply: FastifyReply) => unknown) => async (req: Req, reply: FastifyReply) => {
        try {
          return await fn(req, reply);
        } catch (e) {
          if (e instanceof HttpError) return reply.code(e.status).send(e.body);
          throw e;
        }
      };

    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
    );

    // 控制面
    app.get('/__sim/apollo', async () => ({
      users: this.s.users.map((u) => ({ ...u, password: undefined })),
      releases: this.s.releases.slice(-50),
    }));
    app.post(
      '/__sim/apollo/users',
      { schema: { body: ApolloUserInput } },
      wrap((req, reply) => {
        reply.code(201);
        const u = this.addUser(req.body as Static<typeof ApolloUserInput>);
        return { ...u, password: undefined };
      }),
    );

    // 假设：Portal 表单登录，成功 302 + Set-Cookie，失败 302 到 /signin?#/error（这里直接 401）
    app.post(
      '/signin',
      wrap((req, reply) => {
        const b = (req.body ?? {}) as Record<string, string>;
        const u = this.s.users.find((x) => x.username === b.username && x.password === b.password);
        if (!u) throw new HttpError(401, { status: 401, message: 'Bad credentials' });
        const sid = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sid, u.username);
        return reply
          .code(302)
          .header('set-cookie', `JSESSIONID=${sid}; Path=/; HttpOnly`)
          .header('location', '/')
          .send();
      }),
    );
    // 依据：UserInfoController GET /user —— 当前登录人
    app.get(
      '/user',
      wrap((req) => {
        const u = this.user(req);
        return { userId: u.username, name: u.name };
      }),
    );

    const P = '/apps/:appId/envs/:env/clusters/:cluster/namespaces/:ns';
    // 依据：NamespaceController GET —— 命名空间与配置项（草稿）
    app.get(
      P,
      wrap((req) => {
        const { appId, env, cluster, ns } = req.params as unknown as NsParams;
        this.user(req);
        const items = this.s.items[nsKey(appId, env, cluster, ns)] ?? {};
        return {
          baseInfo: { appId, clusterName: cluster, namespaceName: ns },
          items: Object.entries(items).map(([key, value]) => ({ item: { key, value } })),
        };
      }),
    );
    // 依据：ItemController PUT .../item —— 改一个配置项（不存在就建）
    app.put(
      `${P}/item`,
      wrap((req) => {
        const { appId, env, cluster, ns } = req.params as unknown as NsParams;
        const u = this.user(req);
        this.allowed(u, appId, env);
        const b = (req.body ?? {}) as { key?: string; value?: string };
        if (!b.key || typeof b.value !== 'string')
          throw new HttpError(400, { status: 400, message: 'key and value are required' });
        const k = nsKey(appId, env, cluster, ns);
        this.s.items[k] = { ...this.s.items[k], [b.key]: b.value };
        this.store.save();
        return { key: b.key, value: b.value, dataChangeLastModifiedBy: u.username };
      }),
    );
    // 依据：ReleaseController POST .../releases —— 把当前草稿发布成新版本
    app.post(
      `${P}/releases`,
      wrap((req, reply) => {
        const { appId, env, cluster, ns } = req.params as unknown as NsParams;
        const u = this.user(req);
        this.allowed(u, appId, env);
        const b = (req.body ?? {}) as { releaseTitle?: string; releaseComment?: string };
        const r: ApolloRelease = {
          id: this.store.nextId(),
          app_id: appId,
          env: env.toUpperCase(),
          cluster,
          namespace: ns,
          name: b.releaseTitle ?? '',
          comment: b.releaseComment ?? '',
          configurations: { ...this.s.items[nsKey(appId, env, cluster, ns)] },
          released_by: u.username,
          released_at: new Date().toISOString(),
        };
        this.s.releases.push(r);
        this.store.save();
        // 故障「发布做到一半中断」：发布已经生效，但调用方收不到结果（07 §5.2）
        if (this.faults.take('apollo', ['publish_interrupt'], req.method, req.url)) {
          reply.hijack();
          req.raw.socket.destroy();
          return;
        }
        return this.releaseDto(r);
      }),
    );
    // 依据：ReleaseController GET /envs/{env}/apps/{appId}/clusters/{c}/namespaces/{ns}/releases/active
    app.get(
      '/envs/:env/apps/:appId/clusters/:cluster/namespaces/:ns/releases/active',
      wrap((req) => {
        const { appId, env, cluster, ns } = req.params as unknown as NsParams;
        this.user(req);
        const r = this.active(appId, env, cluster, ns);
        if (!r) return [];
        const dto = this.releaseDto(r);
        // 故障「回读不一致」：这次回读返回的配置里提交号被改掉
        if (this.faults.take('apollo', ['readback_mismatch'], req.method, req.url)) {
          const conf = JSON.parse(dto.configurations) as Record<string, string>;
          for (const k of Object.keys(conf))
            conf[k] = conf[k]!.replace(/[0-9a-f]{40}/g, '0'.repeat(40));
          dto.configurations = JSON.stringify(conf);
        }
        return [dto];
      }),
    );
  }

  private releaseDto(r: ApolloRelease) {
    return {
      id: r.id,
      appId: r.app_id,
      clusterName: r.cluster,
      namespaceName: r.namespace,
      name: r.name,
      comment: r.comment,
      configurations: JSON.stringify(r.configurations),
      dataChangeCreatedBy: r.released_by,
      dataChangeCreatedTime: r.released_at,
    };
  }
}
