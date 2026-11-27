// Model egress proxy (docs/06 §1.2, §5.3, §11.1).
// - Only accepts requests carrying a registered round token; the real API key is injected here.
// - Pins the upstream base URL, the completion endpoint of the configured protocol, and the model.
// - Streams responses through unchanged while reading token usage; caps requests per round.
// Listening (Unix socket on Linux, loopback port behind the relay on Docker Desktop) is the caller's choice.
import http from 'node:http';
import { Readable } from 'node:stream';

export type LlmApi = 'openai-completions' | 'openai-responses' | 'anthropic-messages';

export interface LlmUpstream {
  api: LlmApi;
  /** e.g. https://example.com/v1 for OpenAI-compatible, https://example.com for Anthropic */
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface Usage {
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
}

export interface RoundLimits {
  /** model requests allowed in one round before the proxy answers 429 */
  maxRequests: number;
}

export const DEFAULT_ROUND_LIMITS: RoundLimits = { maxRequests: 200 };

/** Path (after the /llm prefix) of the one completion endpoint each protocol may call. */
const ENDPOINT: Record<LlmApi, string> = {
  'openai-completions': '/chat/completions',
  'openai-responses': '/responses',
  'anthropic-messages': '/v1/messages',
};

const FORWARD_HEADERS = ['content-type', 'accept', 'anthropic-version', 'anthropic-beta'];
const MAX_BODY = 32 * 1024 * 1024;

interface Round {
  limits: RoundLimits;
  usage: Usage;
}

export interface LlmProxy {
  server: http.Server;
  openRound(token: string, limits?: Partial<RoundLimits>): void;
  closeRound(token: string): Usage | undefined;
  usage(token: string): Usage | undefined;
}

export function createLlmProxy(upstream: LlmUpstream): LlmProxy {
  const rounds = new Map<string, Round>();
  const base = upstream.baseUrl.replace(/\/+$/, '');

  const server = http.createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const token =
      /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ??
      (req.headers['x-api-key'] as string | undefined);
    const round = token ? rounds.get(token) : undefined;
    if (!round) return void res.writeHead(401).end();
    if (req.method !== 'POST' || req.url !== `/llm${ENDPOINT[upstream.api]}`)
      return void res.writeHead(404).end();
    if (round.usage.requests >= round.limits.maxRequests)
      return void res
        .writeHead(429, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: { message: 'round request limit reached' } }));

    const body = await readBody(req);
    let model: unknown;
    try {
      model = (JSON.parse(body.toString()) as { model?: unknown }).model;
    } catch {
      model = undefined;
    }
    if (model !== upstream.model) return void res.writeHead(400).end('model not allowed');
    round.usage.requests += 1;

    const headers: Record<string, string> = {};
    for (const h of FORWARD_HEADERS) {
      const v = req.headers[h];
      if (typeof v === 'string') headers[h] = v;
    }
    if (upstream.api === 'anthropic-messages') headers['x-api-key'] = upstream.apiKey;
    else headers.authorization = `Bearer ${upstream.apiKey}`;

    const up = await fetch(`${base}${ENDPOINT[upstream.api]}`, {
      method: 'POST',
      headers,
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    const outHeaders: Record<string, string> = {};
    const ct = up.headers.get('content-type');
    if (ct) outHeaders['content-type'] = ct;
    res.writeHead(up.status, outHeaders);
    if (!up.body) return void res.end();

    const meter = usageMeter();
    const stream = Readable.fromWeb(up.body as import('node:stream/web').ReadableStream);
    stream.on('data', (chunk: Buffer) => meter.push(chunk));
    stream.on('end', () => addUsage(round.usage, meter.finish()));
    stream.pipe(res);
  }

  return {
    server,
    openRound(token, limits) {
      rounds.set(token, {
        limits: { ...DEFAULT_ROUND_LIMITS, ...limits },
        usage: { requests: 0, input: 0, output: 0, cacheRead: 0 },
      });
    },
    closeRound(token) {
      const r = rounds.get(token);
      rounds.delete(token);
      return r?.usage;
    },
    usage: (token) => rounds.get(token)?.usage,
  };
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function addUsage(total: Usage, u: Omit<Usage, 'requests'>): void {
  total.input += u.input;
  total.output += u.output;
  total.cacheRead += u.cacheRead;
}

type Json = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Json) : undefined);

/**
 * Reads token usage from a streamed (SSE) or plain JSON response of any of the three protocols:
 * - responses:   response.completed → response.usage {input_tokens, output_tokens, input_tokens_details.cached_tokens}
 * - completions: last chunk usage {prompt_tokens, completion_tokens, prompt_tokens_details.cached_tokens}
 * - anthropic:   message_start.message.usage.input_tokens (+ cache_read_input_tokens), message_delta.usage.output_tokens
 */
export function usageMeter() {
  let text = '';
  const u = { input: 0, output: 0, cacheRead: 0 };
  const take = (j: Json) => {
    const resp = obj(j.response);
    const usage = obj(resp?.usage) ?? obj(j.usage) ?? obj(obj(j.message)?.usage);
    if (!usage) return;
    if (resp) {
      u.input = num(usage.input_tokens);
      u.output = num(usage.output_tokens);
      u.cacheRead = num(obj(usage.input_tokens_details)?.cached_tokens);
    } else if ('prompt_tokens' in usage) {
      u.input = num(usage.prompt_tokens);
      u.output = num(usage.completion_tokens);
      u.cacheRead = num(obj(usage.prompt_tokens_details)?.cached_tokens);
    } else {
      // anthropic: input arrives in message_start, output in message_delta
      if (num(usage.input_tokens)) u.input = num(usage.input_tokens);
      if ('cache_read_input_tokens' in usage) u.cacheRead = num(usage.cache_read_input_tokens);
      if (num(usage.output_tokens)) u.output = num(usage.output_tokens);
    }
  };
  const parse = (s: string) => {
    try {
      const j = obj(JSON.parse(s));
      if (j) take(j);
    } catch {
      // not JSON (e.g. [DONE]); ignore
    }
  };
  return {
    push(chunk: Buffer) {
      text += chunk.toString();
      if (text.length > 4 * 1024 * 1024) text = text.slice(-1024 * 1024);
    },
    finish() {
      const lines = text.split('\n').filter((l) => l.startsWith('data:'));
      if (lines.length === 0) parse(text);
      for (const l of lines) parse(l.slice(5).trim());
      return u;
    },
  };
}
