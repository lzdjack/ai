// 环境站点的登录（P3b-3，06 §2.4 环境账号）：Bot 试登录要有个真登录页可登。默认不要求登录（演练、复现、
// 发布核对照旧）；PUT /__sim/envs/:name/auth {require_login:true} 之后页面没登录就跳 /login，接口回 401。
// 账号固定几个（密码都是 sim-env-pass）；POST /__sim/envs/:name/sessions 直接签一个会话 Cookie（可签过期的），
// 给「粘贴 Cookie」那条路用。登录后页面里带一个隐藏的 data-user-name，Bot 从这里认出是谁。
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from 'typebox';

export const SIM_ENV_PASSWORD = 'sim-env-pass';
export const SIM_ENV_ACCOUNTS = [
  { username: 'emp_test01', name: '张三 · 研发部' },
  { username: 'dept_lead02', name: '李娜 · 研发部' },
  { username: 'qa_prod01', name: '王敏 · 示范科技' },
] as const;

const COOKIE = 'sim_session';
const DAY = 86_400;

interface Session {
  env: string;
  username: string;
  expires: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const page = (next: string, error: boolean) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>登录 · 审批中心</title>
<style>body{font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f4f5f7}
form{background:#fff;padding:28px;border-radius:12px;width:300px;display:grid;gap:12px}
input,button{height:36px;padding:0 10px;font:inherit}.err{color:#c0392b}</style></head>
<body><form method="post" action="/login"><b>登录审批中心</b>
${error ? '<div class="err">账号或密码不对</div>' : ''}
<input name="username" placeholder="账号" autocomplete="username">
<input name="password" type="password" placeholder="密码" autocomplete="current-password">
<input type="hidden" name="next" value="${esc(next)}">
<button type="submit">登录</button></form></body></html>`;

export class EnvLogin {
  private sessions = new Map<string, Session>();
  private required = new Set<string>();

  state(env: string) {
    return { require_login: this.required.has(env) };
  }

  /** 签一个会话，返回 Set-Cookie 那样的串（带 Path 和 Expires） */
  issue(env: string, username: string, ttlSeconds = 7 * DAY) {
    const token = crypto.randomBytes(18).toString('hex');
    const expires = Date.now() + ttlSeconds * 1000;
    this.sessions.set(token, { env, username, expires });
    return `${COOKIE}=${token}; Path=/; Expires=${new Date(expires).toUTCString()}`;
  }

  /** 当前请求登录的是谁；没登录、过期、别的环境的会话都算没有 */
  who(env: string, req: FastifyRequest) {
    const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]+)`).exec(req.headers.cookie ?? '');
    const s = m ? this.sessions.get(m[1]!) : undefined;
    if (!s || s.env !== env || s.expires < Date.now()) return null;
    return SIM_ENV_ACCOUNTS.find((a) => a.username === s.username) ?? null;
  }

  /** 主端口上的控制接口 */
  register(app: FastifyInstance, envNames: readonly string[]) {
    const Params = Type.Object({ name: Type.Union(envNames.map((n) => Type.Literal(n))) });
    app.put(
      '/__sim/envs/:name/auth',
      {
        schema: { params: Params, body: Type.Object({ require_login: Type.Boolean() }) },
      },
      async (req) => {
        const { name } = req.params as { name: string };
        if ((req.body as { require_login: boolean }).require_login) this.required.add(name);
        else this.required.delete(name);
        return this.state(name);
      },
    );
    app.get('/__sim/envs/:name/accounts', { schema: { params: Params } }, async () =>
      SIM_ENV_ACCOUNTS.map((a) => ({ ...a, password: SIM_ENV_PASSWORD })),
    );
    app.post(
      '/__sim/envs/:name/sessions',
      {
        schema: {
          params: Params,
          body: Type.Object({
            username: Type.String(),
            /** 负数签出来就是过期的 */
            ttl_seconds: Type.Optional(Type.Integer()),
          }),
        },
      },
      async (req, reply) => {
        const { name } = req.params as { name: string };
        const b = req.body as { username: string; ttl_seconds?: number };
        if (!SIM_ENV_ACCOUNTS.some((a) => a.username === b.username))
          return reply.code(404).send({ error: 'no_such_account' });
        return { cookie: this.issue(name, b.username, b.ttl_seconds) };
      },
    );
  }

  /** 环境站点上的登录页和守卫 */
  guard(app: FastifyInstance, env: string) {
    app.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string' },
      (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(String(body)))),
    );
    app.get('/login', async (req, reply) => {
      const next = (req.query as { next?: string }).next ?? '/';
      return reply.type('text/html; charset=utf-8').send(page(next, false));
    });
    app.post('/login', async (req, reply: FastifyReply) => {
      const b = (req.body ?? {}) as { username?: string; password?: string; next?: string };
      const next = b.next?.startsWith('/') ? b.next : '/';
      const ok =
        b.password === SIM_ENV_PASSWORD && SIM_ENV_ACCOUNTS.some((a) => a.username === b.username);
      if (!ok) return reply.code(401).type('text/html; charset=utf-8').send(page(next, true));
      return reply.header('set-cookie', this.issue(env, b.username!)).redirect(next, 302);
    });
    app.addHook('onRequest', async (req, reply) => {
      if (!this.required.has(env)) return;
      const p = req.url.split('?')[0] ?? '/';
      if (p === '/login' || p === '/__version' || /\.[a-z0-9]+$/i.test(p)) return;
      if (this.who(env, req)) return;
      if (p.startsWith('/api/')) return reply.code(401).send({ error: 'unauthenticated' });
      return reply.redirect(`/login?next=${encodeURIComponent(req.url)}`, 302);
    });
  }

  /** 登录状态下给页面带上当前用户（隐藏元素），Bot 试登录时从这里认人 */
  mark(env: string, req: FastifyRequest, html: Buffer) {
    const u = this.required.has(env) ? this.who(env, req) : null;
    if (!u) return html;
    return Buffer.from(
      html
        .toString('utf8')
        .replace('</body>', `<span data-user-name hidden>${esc(u.name)}</span></body>`),
    );
  }
}
