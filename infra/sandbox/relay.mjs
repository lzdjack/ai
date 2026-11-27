// 中继（docs/06 §5.3 第 3 条，macOS / Windows Docker Desktop 用）。
// 跑在单独的容器里，一只脚在本轮的 --internal 内部网络（代码容器只能连到它），一只脚在能到宿主机的网络。
// 只做两件事：逐个请求校验本轮令牌；按路径前缀转发到固定的宿主机上游。其他请求一律拒绝。
//   RELAY_TOKEN   本轮随机令牌（Authorization: Bearer / x-api-key 任一携带）
//   RELAY_ROUTES  前缀=上游，逗号分隔，例如 /llm=http://host.docker.internal:5001,/tools=http://host.docker.internal:5002
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const token = Buffer.from(process.env.RELAY_TOKEN ?? '');
const routes = (process.env.RELAY_ROUTES ?? '')
  .split(',')
  .filter(Boolean)
  .map((r) => {
    const [prefix, upstream] = r.split('=');
    return { prefix, upstream: new URL(upstream) };
  });
if (token.length < 32 || routes.length === 0) {
  console.error('relay: RELAY_TOKEN and RELAY_ROUTES are required');
  process.exit(1);
}

function authorized(req) {
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  const given = Buffer.from(bearer ?? req.headers['x-api-key'] ?? '');
  return given.length === token.length && timingSafeEqual(given, token);
}

http
  .createServer((req, res) => {
    const route = routes.find((r) => req.url === r.prefix || req.url.startsWith(`${r.prefix}/`));
    if (!route || !authorized(req)) {
      res.writeHead(route ? 401 : 404).end();
      return;
    }
    const upstream = http.request(
      {
        host: route.upstream.hostname,
        port: route.upstream.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: route.upstream.host },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  })
  .listen(8080, () => console.log('relay listening on 8080'));
