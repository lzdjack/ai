// One browser container session on the host side (docs/06 §5.2): starts the container (no network),
// answers every request the page makes through the caller's `answer`, and sends commands one at a time
// over the line protocol of container/runner.mjs. Used by the browser repro and the environment sign-in.
import readline from 'node:readline';
import type { AgentSandbox } from '@cloudcraft/core-protocol';
import { browserContainer } from './container.ts';

export type Msg = Record<string, unknown> & { t: string };

export interface BrowserSession {
  /** resolves once the browser is up; rejects if the container exits first */
  ready: Promise<void>;
  cmd(c: Record<string, unknown>): Promise<Msg>;
  /** closes the browser and waits a little for the container to exit, then kills it */
  close(): Promise<void>;
  kill(): void;
}

export function openBrowser(o: {
  sandbox: AgentSandbox;
  /** reply with {status, headers, body(base64)} or {abort: true} */
  answer: (req: Msg) => Promise<Record<string, unknown>>;
  /** console / pageerror / crash lines */
  onEvent?: (m: Msg) => void;
  init?: Record<string, unknown>;
}): BrowserSession {
  const proc = o.sandbox.start({
    command: browserContainer.command,
    mounts: browserContainer.mounts,
    env: { HOME: '/home/node', CC_BROWSER_INIT: JSON.stringify(o.init ?? {}) },
  });
  const send = (msg: unknown) => proc.stdin.write(`${JSON.stringify(msg)}\n`);
  const waiting = new Map<number, (m: Msg) => void>();
  let ready: () => void;
  const isReady = new Promise<void>((r) => (ready = r));
  let gone = false;
  const exited = proc.exited.then(() => {
    gone = true;
    for (const w of waiting.values())
      w({ t: 'done', ok: false, error: 'browser container exited' });
  });

  readline.createInterface({ input: proc.stdout as never }).on('line', (line) => {
    let msg: Msg;
    try {
      msg = JSON.parse(line) as Msg;
    } catch {
      return;
    }
    if (msg.t === 'ready') ready();
    else if (msg.t === 'req')
      void o
        .answer(msg)
        .catch(() => ({ abort: true }))
        .then((r) => send({ t: 'res', id: msg.id, ...r }));
    else if (msg.t === 'done') {
      waiting.get(msg.cid as number)?.(msg);
      waiting.delete(msg.cid as number);
    } else o.onEvent?.(msg);
  });

  let cid = 0;
  const cmd = (c: Record<string, unknown>): Promise<Msg> =>
    gone
      ? Promise.resolve({ t: 'done', ok: false, error: 'browser container exited' })
      : new Promise((r) => {
          const id = ++cid;
          waiting.set(id, r);
          send({ t: 'cmd', cid: id, ...c });
        });

  return {
    ready: Promise.race([
      isReady,
      exited.then(() => {
        throw new Error('browser container exited before it was ready');
      }),
    ]),
    cmd,
    async close() {
      await cmd({ op: 'close' });
      proc.stdin.end();
      await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      if (!gone) proc.kill();
    },
    kill: () => proc.kill(),
  };
}

const HOP = ['content-encoding', 'content-length', 'transfer-encoding'];

/**
 * Fetches a request the page made from the host, as the page would (no redirects followed: the
 * browser follows them itself). Set-Cookie lines stay separate (newline-joined, as fulfill takes them).
 */
export async function fetchUpstream(req: Msg, timeoutMs = 15_000) {
  const headers = { ...(req.headers as Record<string, string>) };
  delete headers.host;
  const up = await fetch(String(req.url), {
    method: String(req.method),
    headers,
    body: req.body ? Buffer.from(String(req.body), 'base64') : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const out: Record<string, string> = {};
  up.headers.forEach((v, k) => {
    if (!HOP.includes(k) && k !== 'set-cookie') out[k] = v;
  });
  const cookies = up.headers.getSetCookie();
  if (cookies.length) out['set-cookie'] = cookies.join('\n');
  return { status: up.status, headers: out, body: Buffer.from(await up.arrayBuffer()) };
}
