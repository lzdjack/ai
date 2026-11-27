// Talks to the model proxy process over its control Unix socket (apps/llm-proxy control.ts):
// registers the round token before the engine starts and reads the round's usage at the end.
import http from 'node:http';
import type { ModelApi } from '@cloudcraft/core-protocol';

export interface ProxyInfo {
  api: ModelApi;
  model: string;
  port: number;
}
export interface RoundUsage {
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
}

export interface ProxyClient {
  info(): Promise<ProxyInfo>;
  openRound(token: string, maxRequests?: number): Promise<void>;
  closeRound(token: string): Promise<RoundUsage | null>;
}

export function proxyClient(socketPath: string): ProxyClient {
  const call = <T>(method: string, path: string, body?: unknown) =>
    new Promise<T>((resolve, reject) => {
      const req = http.request({ socketPath, method, path }, (res) => {
        let text = '';
        res.on('data', (d: Buffer) => (text += d.toString()));
        res.on('end', () =>
          res.statusCode === 200
            ? resolve(JSON.parse(text) as T)
            : reject(new Error(`model proxy ${path}: ${res.statusCode} ${text}`)),
        );
      });
      req.on('error', (e) => reject(new Error(`model proxy not reachable: ${e.message}`)));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  return {
    info: () => call('GET', '/info'),
    openRound: async (token, maxRequests) => {
      await call('POST', '/rounds/open', { token, max_requests: maxRequests });
    },
    closeRound: (token) => call('POST', '/rounds/close', { token }),
  };
}
