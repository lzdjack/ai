// 故障注入（07 §5.2 第 2 条）：控制接口 /__sim/faults。
// 请求级故障（429 / 401 / 500 / 超时）在 onRequest 统一处理；
// 业务级故障（合并冲突、发布中断、回读不一致）由各模块在对应位置调用 take()。
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type, type Static } from 'typebox';

export const SIM_MODULES = ['gitlab', 'jira', 'tita', 'apollo', 'craft'] as const;
export type SimModule = (typeof SIM_MODULES)[number];

const REQUEST_KINDS = ['rate_limit', 'unauthorized', 'server_error', 'timeout'] as const;
const BUSINESS_KINDS = ['merge_conflict', 'publish_interrupt', 'readback_mismatch'] as const;

export const FaultInput = Type.Object({
  module: Type.Union(SIM_MODULES.map((m) => Type.Literal(m))),
  kind: Type.Union([...REQUEST_KINDS, ...BUSINESS_KINDS].map((k) => Type.Literal(k))),
  /** 只对这个 HTTP 方法生效 */
  method: Type.Optional(Type.String()),
  /** 只对路径包含这段文字的请求生效 */
  path: Type.Optional(Type.String()),
  /** 生效次数，用完自动移除；不填一直生效 */
  times: Type.Optional(Type.Integer({ minimum: 1 })),
  /** rate_limit 的 Retry-After 秒数 */
  retry_after_s: Type.Optional(Type.Integer({ minimum: 0, default: 30 })),
  /** timeout 挂起多久后断开连接 */
  delay_ms: Type.Optional(Type.Integer({ minimum: 0, default: 60_000 })),
});
export type Fault = Static<typeof FaultInput> & { id: number; hits: number };

/** 按路径判断请求属于哪个模块；后续模块加路由时在这里登记前缀 */
function moduleOf(url: string): SimModule | null {
  if (url.startsWith('/__sim') || url === '/' || url.startsWith('/console')) return null;
  if (url.startsWith('/api/v4/') || /^\/[^/]+\/.+\.git\//.test(url)) return 'gitlab';
  if (/^\/(signin|user|apps\/|envs\/)/.test(url)) return 'apollo';
  if (url.startsWith('/oss/')) return 'craft';
  return null;
}

export class Faults {
  private list: Fault[] = [];
  private seq = 0;
  private readonly timers = new Set<NodeJS.Timeout>();

  all(): Fault[] {
    return this.list;
  }

  add(input: Static<typeof FaultInput>): Fault {
    const f = { ...input, id: ++this.seq, hits: 0 };
    this.list.push(f);
    return f;
  }

  remove(id?: number): void {
    this.list = id === undefined ? [] : this.list.filter((f) => f.id !== id);
  }

  /** 找到匹配的故障并记一次命中；用完次数的移除 */
  take(module: SimModule, kinds: readonly string[], method: string, url: string): Fault | null {
    const f = this.list.find(
      (x) =>
        x.module === module &&
        kinds.includes(x.kind) &&
        (!x.method || x.method.toUpperCase() === method) &&
        (!x.path || url.includes(x.path)),
    );
    if (!f) return null;
    f.hits += 1;
    if (f.times !== undefined && f.hits >= f.times) this.remove(f.id);
    return f;
  }

  register(app: FastifyInstance): void {
    app.addHook('onRequest', (req, reply, done) => {
      const module = moduleOf(req.url);
      const f = module && this.take(module, REQUEST_KINDS, req.method, req.url);
      if (!f) return done();
      this.apply(f, req, reply);
    });
    app.addHook('onClose', (_app, done) => {
      for (const t of this.timers) clearTimeout(t);
      done();
    });

    app.get('/__sim/faults', async () => this.list);
    app.post('/__sim/faults', { schema: { body: FaultInput } }, async (req, reply) => {
      reply.code(201);
      return this.add(req.body as Static<typeof FaultInput>);
    });
    app.delete<{ Params: { id: string } }>('/__sim/faults/:id', async (req, reply) => {
      this.remove(Number(req.params.id));
      reply.code(204);
    });
    app.delete('/__sim/faults', async (_req, reply) => {
      this.remove();
      reply.code(204);
    });
  }

  private apply(f: Fault, req: FastifyRequest, reply: FastifyReply): void {
    // 报文按 GitLab 的格式；其他模块接入时按各自系统的格式补分支
    switch (f.kind) {
      case 'rate_limit':
        void reply
          .code(429)
          .header('Retry-After', String(f.retry_after_s ?? 30))
          .send({ message: 'Retry later' });
        return;
      case 'unauthorized':
        void reply.code(401).send({ message: '401 Unauthorized' });
        return;
      case 'server_error':
        void reply.code(500).send({ message: '500 Internal Server Error' });
        return;
      case 'timeout': {
        reply.hijack();
        const t = setTimeout(() => {
          this.timers.delete(t);
          req.raw.socket.destroy();
        }, f.delay_ms ?? 60_000);
        this.timers.add(t);
        return;
      }
    }
  }
}
