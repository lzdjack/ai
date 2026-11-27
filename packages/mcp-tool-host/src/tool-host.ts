// The host tool server for one round (docs/06 §5.4, §11.4): POST /tools/<name> with the round token.
// Reached from the container only through the relay (or a per-round Unix socket on Linux).
import crypto from 'node:crypto';
import http from 'node:http';
import type { HostToolDecl } from '@cloudcraft/core-protocol';
import Value from 'typebox/value';
import { HOST_TOOLS, type ToolRound } from './tools.ts';

const MAX_BODY = 256 * 1024;

export interface ToolCallRecord {
  tool: string;
  ok: boolean;
  status: number;
  /** what the tool accepted (only for ok calls) */
  record?: unknown;
}

export interface ToolHost {
  server: http.Server;
  /** declarations of the tools this node allows, for the engine */
  decls: HostToolDecl[];
  /** accepted results by tool name (the first accepted call of a once-only tool) */
  results: Map<string, unknown>;
  calls: ToolCallRecord[];
}

/**
 * @param allowed the node's allowed_tools (unknown names are ignored)
 * @param token the round token every call must carry
 */
export function createToolHost(o: {
  round: ToolRound;
  allowed: string[];
  token: string;
}): ToolHost {
  const tools = o.allowed.flatMap((n) => (HOST_TOOLS[n] ? [[n, HOST_TOOLS[n]] as const] : []));
  const byName = new Map(tools);
  const results = new Map<string, unknown>();
  const calls: ToolCallRecord[] = [];
  const expected = Buffer.from(o.token);

  const server = http.createServer((req, res) => {
    const reply = (status: number, text: string, tool = '', record?: unknown) => {
      if (tool) calls.push({ tool, ok: status === 200, status, ...(record ? { record } : {}) });
      res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' }).end(text);
    };
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (d: Buffer) => {
      size += d.length;
      if (size <= MAX_BODY) chunks.push(d);
    });
    req.on('end', () => {
      const auth = Buffer.from(/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '');
      if (auth.length !== expected.length || !crypto.timingSafeEqual(auth, expected))
        return reply(401, 'unauthorized');
      const name = /^\/tools\/([a-z_]+)$/.exec(req.url ?? '')?.[1] ?? '';
      const tool = byName.get(name);
      if (req.method !== 'POST' || !tool) return reply(404, `tool not available: ${name}`, name);
      if (size > MAX_BODY) return reply(413, 'parameters too large', name);
      if (tool.once && results.has(name))
        return reply(409, `${name} was already called for this round`, name);
      let params: unknown;
      try {
        params = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return reply(400, 'body is not JSON', name);
      }
      if (!Value.Check(tool.decl.parameters, params)) {
        const errs = [...Value.Errors(tool.decl.parameters, params)].map(
          (e) => `${e.instancePath || '/'} ${e.message}`,
        );
        return reply(400, `invalid parameters: ${errs.join('; ')}`, name);
      }
      const r = tool.handle(params as never, o.round);
      if (!r.ok) return reply(400, r.text, name);
      if (r.record !== undefined) results.set(name, r.record);
      reply(200, r.text, name, r.record);
    });
  });
  return { server, decls: tools.map(([, t]) => t.decl), results, calls };
}
