// 环境站点（07 §5；06 §5.2）：demo-web 的「测试环境」，单独一个端口，页面和接口同源。
// 部署走 PUT /__sim/envs/:name（主端口）：带上构建产物和接口种子数据，覆盖上一版。
// 接口是 demo 审批中心的后端（和 demo-web 的开发期模拟接口同一套规则），数据只在内存里，每次部署重置。
// 两个环境：test（测试）、prod（正式）。P6 起页面按模拟 Apollo 当前生效的发布来出：发布里写着版本、
// 提交号和产物在模拟 OSS 里的位置，环境站点就从那里取文件；还没有发布过时用 PUT 部署的基线版本。
// GET /__version 返回当前生效的版本和提交号（质检和发布流程核对用）。
import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { Type } from 'typebox';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

interface Approval {
  id: string;
  title: string;
  applicant_id: string;
  applicant_name: string;
  amount: number;
  reason: string;
  status: string;
  submitted_at: string;
  nodes: { name: string; approver_name: string; result: string }[];
}

/** 迷你版不做登录，当前用户固定为张三（和 demo-web 一致） */
const CURRENT_USER = { id: 'u1', name: '张三' };

export const ENV_NAMES = ['test', 'prod'] as const;

/** 当前生效的发布：版本、提交号，以及按相对路径读产物 */
export interface LiveRelease {
  version: string;
  commit: string;
  read(rel: string): Buffer | null;
}

export class EnvSites {
  private approvals = new Map<string, Approval[]>();
  private versions = new Map<string, { deployed_at: string; files: number }>();
  private urls = new Map<string, string>();
  private sites: FastifyInstance[] = [];

  constructor(
    private readonly root: string,
    /** 按环境名查当前生效的发布（模拟 Apollo + OSS）；没有就用基线 */
    private readonly live: (name: string) => LiveRelease | null = () => null,
  ) {
    for (const name of ENV_NAMES) {
      const seed = path.join(root, name, 'api-seed.json');
      if (fs.existsSync(seed))
        this.approvals.set(name, JSON.parse(fs.readFileSync(seed, 'utf8')) as Approval[]);
    }
  }

  dist(name: string) {
    return path.join(this.root, name, 'dist');
  }

  state() {
    return Object.fromEntries(
      ENV_NAMES.map((n) => [
        n,
        {
          url: this.urls.get(n) ?? null,
          deployed: fs.existsSync(path.join(this.dist(n), 'index.html')) || !!this.live(n),
          last_deploy: this.versions.get(n) ?? null,
          live: this.liveInfo(n),
        },
      ]),
    );
  }

  private liveInfo(name: string) {
    const l = this.live(name);
    return l ? { version: l.version, commit: l.commit } : null;
  }

  /** 起环境站点（单独端口，0 = 随机）；随主服务关闭 */
  async listen(name: (typeof ENV_NAMES)[number], port: number) {
    const site = this.site(name);
    await site.listen({ host: '127.0.0.1', port });
    this.sites.push(site);
    const addr = site.server.address();
    this.urls.set(name, `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}/`);
    return this.urls.get(name)!;
  }

  /** 主端口上的部署接口和环境列表 */
  register(app: FastifyInstance) {
    app.get('/__sim/envs', async () => this.state());
    app.addHook('onClose', async () => {
      await Promise.all(this.sites.map((s) => s.close()));
    });
    app.put(
      '/__sim/envs/:name',
      {
        bodyLimit: 50 * 1024 * 1024,
        schema: {
          params: Type.Object({ name: Type.Union(ENV_NAMES.map((n) => Type.Literal(n))) }),
          body: Type.Object({
            files: Type.Record(Type.String(), Type.String()),
            api_seed: Type.Optional(Type.Array(Type.Unknown())),
          }),
        },
      },
      async (req) => {
        const { name } = req.params as { name: string };
        const body = req.body as { files: Record<string, string>; api_seed?: Approval[] };
        const dir = path.join(this.root, name);
        const next = path.join(dir, 'dist.next');
        fs.rmSync(next, { recursive: true, force: true });
        for (const [rel, b64] of Object.entries(body.files)) {
          const file = path.resolve(next, rel);
          if (!file.startsWith(next + path.sep))
            throw Object.assign(new Error(`bad path ${rel}`), { statusCode: 400 });
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, Buffer.from(b64, 'base64'));
        }
        fs.rmSync(this.dist(name), { recursive: true, force: true });
        fs.renameSync(next, this.dist(name));
        if (body.api_seed) {
          fs.writeFileSync(path.join(dir, 'api-seed.json'), JSON.stringify(body.api_seed));
          this.approvals.set(name, body.api_seed);
        }
        const v = { deployed_at: new Date().toISOString(), files: Object.keys(body.files).length };
        this.versions.set(name, v);
        return v;
      },
    );
  }

  /** 环境站点本身（单独端口）：静态产物 + 接口 */
  site(name: string): FastifyInstance {
    const app = Fastify({ logger: false });
    const list = () => this.approvals.get(name) ?? [];
    app.get('/api/approvals', async () => list());
    app.get('/api/approvals/:id', async (req, reply) => {
      const a = list().find((x) => x.id === (req.params as { id: string }).id);
      return a ?? reply.code(404).send({ error: 'not_found' });
    });
    app.post('/api/approvals', async (req, reply) => {
      const v = (req.body ?? {}) as Partial<Approval>;
      const errors: Record<string, string> = {};
      const title = v.title?.trim() ?? '';
      if (!title) errors.title = 'form.title.required';
      else if (title.length > 40) errors.title = 'form.title.too_long';
      if (typeof v.amount !== 'number' || Number.isNaN(v.amount))
        errors.amount = 'form.amount.required';
      else if (v.amount <= 0) errors.amount = 'form.amount.positive';
      if (!v.reason?.trim()) errors.reason = 'form.reason.required';
      if (Object.keys(errors).length) return reply.code(400).send({ errors });
      const items = list();
      const created: Approval = {
        id: `A${String(items.length + 1).padStart(3, '0')}`,
        title,
        amount: v.amount!,
        reason: v.reason!,
        applicant_id: CURRENT_USER.id,
        applicant_name: CURRENT_USER.name,
        status: 'pending',
        submitted_at: new Date().toISOString(),
        nodes: [
          { name: '直属主管', approver_name: '周经理', result: 'waiting' },
          { name: '财务', approver_name: '吴会计', result: 'waiting' },
        ],
      };
      items.push(created);
      this.approvals.set(name, items);
      return reply.code(201).send(created);
    });
    app.post('/api/approvals/:id/withdraw', async (req, reply) => {
      const a = list().find((x) => x.id === (req.params as { id: string }).id);
      if (!a) return reply.code(404).send({ error: 'not_found' });
      if (a.applicant_id !== CURRENT_USER.id || a.status !== 'pending')
        return reply.code(403).send({ error: 'forbidden' });
      a.status = 'withdrawn';
      return a;
    });
    app.get('/__version', async () => this.liveInfo(name) ?? { version: 'baseline', commit: null });
    app.get('/*', async (req, reply) => {
      const rel =
        decodeURIComponent((req.url.split('?')[0] ?? '/').replace(/^\/+/, '')) || 'index.html';
      const send = (file: string, data: Buffer) =>
        reply
          .type(MIME[path.extname(file)] ?? 'application/octet-stream')
          .header(
            'cache-control',
            file.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
          )
          .send(data);
      const live = this.live(name);
      if (live) {
        const data = live.read(rel) ?? (path.extname(rel) ? null : live.read('index.html'));
        return data ? send(path.extname(rel) ? rel : 'index.html', data) : reply.code(404).send();
      }
      const dist = this.dist(name);
      let file = path.resolve(dist, rel);
      if (!file.startsWith(dist + path.sep)) return reply.code(404).send();
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        // 前端路由：不是资源的路径回首页；资源 404
        if (path.extname(rel)) return reply.code(404).send();
        file = path.join(dist, 'index.html');
        if (!fs.existsSync(file)) return reply.code(503).type('text/plain').send('not deployed');
      }
      return send(file, fs.readFileSync(file));
    });
    return app;
  }
}
