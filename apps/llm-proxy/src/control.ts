// The model proxy as its own process (docs/06 §1.2): model traffic from sandboxes arrives on a
// loopback port (behind the relay on Docker Desktop; a per-round Unix socket on Linux later), and
// executors register round tokens over a control Unix socket that only this OS user can open.
// Control API (JSON): GET /info → {api, model, port}; POST /rounds/open {token, max_requests?};
// POST /rounds/close {token} → usage.
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { createLlmProxy, type LlmUpstream } from './proxy.ts';

export interface ProxyInfo {
  api: LlmUpstream['api'];
  model: string;
  /** loopback port the relay forwards /llm to */
  port: number;
}

export interface RunningProxy {
  info: ProxyInfo;
  close(): Promise<void>;
}

const TOKEN = /^[0-9a-f]{64}$/;

export async function startLlmProxy(o: {
  upstream: LlmUpstream;
  port: number;
  controlSocket: string;
}): Promise<RunningProxy> {
  const proxy = createLlmProxy(o.upstream);
  await new Promise<void>((r) => proxy.server.listen(o.port, '127.0.0.1', r));
  const info: ProxyInfo = {
    api: o.upstream.api,
    model: o.upstream.model,
    port: (proxy.server.address() as AddressInfo).port,
  };

  const control = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d: Buffer) => {
      if (body.length < 4096) body += d.toString();
    });
    req.on('end', () => {
      const json = (status: number, v: unknown) =>
        res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(v));
      if (req.method === 'GET' && req.url === '/info') return json(200, info);
      let p: { token?: unknown; max_requests?: unknown };
      try {
        p = JSON.parse(body) as typeof p;
      } catch {
        return json(400, { error: 'body is not JSON' });
      }
      if (typeof p.token !== 'string' || !TOKEN.test(p.token))
        return json(400, { error: 'bad token' });
      if (req.method === 'POST' && req.url === '/rounds/open') {
        const max = typeof p.max_requests === 'number' ? p.max_requests : undefined;
        proxy.openRound(p.token, max ? { maxRequests: max } : undefined);
        return json(200, { ok: true });
      }
      if (req.method === 'POST' && req.url === '/rounds/close')
        return json(200, proxy.closeRound(p.token) ?? null);
      json(404, { error: 'not found' });
    });
  });
  fs.mkdirSync(path.dirname(o.controlSocket), { recursive: true, mode: 0o700 });
  fs.rmSync(o.controlSocket, { force: true });
  await new Promise<void>((r) => control.listen(o.controlSocket, r));
  fs.chmodSync(o.controlSocket, 0o600);

  return {
    info,
    close: async () => {
      await Promise.all([
        new Promise((r) => proxy.server.close(r)),
        new Promise((r) => control.close(r)),
      ]);
      fs.rmSync(o.controlSocket, { force: true });
    },
  };
}

export const controlSocketPath = (dataDir: string) => path.join(dataDir, 'run', 'llm-proxy.sock');
