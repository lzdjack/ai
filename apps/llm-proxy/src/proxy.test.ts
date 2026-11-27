import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { createLlmProxy } from './proxy.ts';

const listen = (s: http.Server) =>
  new Promise<string>((r) =>
    s.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)),
  );

describe('模型代理', () => {
  const seen: Array<{ url?: string; auth?: string }> = [];
  const upstream = http.createServer((req, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization });
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: {"type":"response.created","response":{"usage":null}}\n\n');
      res.end(
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":120,"output_tokens":7,"input_tokens_details":{"cached_tokens":100}}}}\n\n',
      );
    });
  });
  afterAll(() => upstream.close());

  it('只放行本轮令牌、钉死接口与模型、换成真实密钥、统计用量并按次数封顶', async () => {
    const proxy = createLlmProxy({
      api: 'openai-responses',
      baseUrl: `${await listen(upstream)}/v1/`,
      apiKey: 'real-key',
      model: 'm1',
    });
    const base = await listen(proxy.server);
    proxy.openRound('round-token', { maxRequests: 1 });
    const post = (path: string, token: string | null, model = 'm1') =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model, input: 'hi', stream: true }),
      });

    expect((await post('/llm/responses', null)).status).toBe(401);
    expect((await post('/llm/responses', 'other-token')).status).toBe(401);
    expect((await post('/llm/chat/completions', 'round-token')).status).toBe(404);
    expect((await post('/llm/responses', 'round-token', 'other-model')).status).toBe(400);
    expect(seen).toHaveLength(0);

    const ok = await post('/llm/responses', 'round-token');
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain('response.completed');
    expect(seen).toEqual([{ url: '/v1/responses', auth: 'Bearer real-key' }]);
    expect(proxy.usage('round-token')).toEqual({
      requests: 1,
      input: 120,
      output: 7,
      cacheRead: 100,
    });

    expect((await post('/llm/responses', 'round-token')).status).toBe(429);
    expect(proxy.closeRound('round-token')?.requests).toBe(1);
    expect((await post('/llm/responses', 'round-token')).status).toBe(401);
    proxy.server.close();
  });
});
