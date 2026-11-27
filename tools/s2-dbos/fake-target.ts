// 与 apps/server/test/orchestration/fake-target.ts 相同（跨包不能相对引用测试文件）；随 DBOS 对比代码一起删除。
// A stand-in for an outside release system (Apollo-like): it applies a deploy as soon as the request
// arrives and can hold the response, so a test can kill the caller after the change happened but
// before the caller recorded it — the case 06 §3.6 item 5 is about.
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeTarget {
  url: string;
  /** POST /deploy calls received, by key */
  calls: Map<string, number>;
  /** key -> deployed version */
  deployed: Map<string, string>;
  /** the next POST /deploy is applied but never answered; resolves when it arrives */
  holdNext(): Promise<void>;
  close(): Promise<void>;
}

export async function startFakeTarget(): Promise<FakeTarget> {
  const calls = new Map<string, number>();
  const deployed = new Map<string, string>();
  const held: http.ServerResponse[] = [];
  let hold: (() => void) | null = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://x');
    if (req.method === 'GET' && url.pathname.startsWith('/deploy/')) {
      const v = deployed.get(decodeURIComponent(url.pathname.slice('/deploy/'.length)));
      res.writeHead(v ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(v ? { version: v } : {}));
      return;
    }
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      const { key, version } = JSON.parse(body) as { key: string; version: string };
      calls.set(key, (calls.get(key) ?? 0) + 1);
      deployed.set(key, version);
      if (hold) {
        held.push(res);
        hold();
        hold = null;
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ version }));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    deployed,
    holdNext: () => new Promise<void>((r) => (hold = r)),
    close: async () => {
      for (const res of held) res.destroy();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}

/** Client side, used by the workers of both orchestration variants. */
export const targetApi = (base: string) => ({
  async deploy(key: string, version: string): Promise<{ version: string }> {
    const r = await fetch(`${base}/deploy`, {
      method: 'POST',
      body: JSON.stringify({ key, version }),
    });
    if (!r.ok) throw new Error(`deploy failed: ${r.status}`);
    return (await r.json()) as { version: string };
  },
  async readBack(key: string): Promise<{ version: string } | null> {
    const r = await fetch(`${base}/deploy/${encodeURIComponent(key)}`);
    return r.status === 404 ? null : ((await r.json()) as { version: string });
  },
});
