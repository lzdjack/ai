// Host side of one browser repro run (docs/06 §5.2, §5.7): starts the browser container (no network),
// answers every request it makes through DistAssetMatcher, drives the declarative steps and records
// screenshots, the replacement invariants and the page's own errors (redacted).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import readline from 'node:readline';
import type {
  AgentSandbox,
  BrowserLocator,
  BrowserRepro,
  BrowserStep,
  DistReplaceInvariants,
} from '@cloudcraft/core-protocol';
import { locatorError } from '@cloudcraft/core-protocol';
import { INTEGRITY_GUARD, rewriteEntry } from './entry.ts';
import { DistAssetMatcher } from './matcher.ts';

const require = createRequire(import.meta.url);
const PW_DIR = path.dirname(require.resolve('playwright-core/package.json'));
const PW_VERSION = (
  JSON.parse(fs.readFileSync(path.join(PW_DIR, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;
/** Playwright's own image, same version as the driver mounted into it (browsers and CJK fonts). */
export const BROWSER_IMAGE = `mcr.microsoft.com/playwright:v${PW_VERSION}-noble`;
const RUNNER = path.join(import.meta.dirname, 'container', 'runner.mjs');

/** Mounts and command for the browser container; the caller adds network none, limits, labels. */
export const browserContainer = {
  mounts: [
    { host: PW_DIR, container: '/opt/pw/node_modules/playwright-core', readonly: true },
    { host: RUNNER, container: '/opt/pw/runner.mjs', readonly: true },
  ],
  command: 'node /opt/pw/runner.mjs',
};

export interface BrowserRunOptions {
  /** starts the browser container: BROWSER_IMAGE, --network=none, workdir /tmp */
  sandbox: AgentSandbox;
  repro: BrowserRepro;
  distDir: string;
  envUrl: string;
  assetUrlPatterns: string[];
  /** screenshots go here as <prefix>-<name>.png */
  outDir: string;
  prefix: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface BrowserStepResult {
  step: number;
  op: string;
  ok: boolean;
  ms: number;
  error?: string;
  actual?: string | null;
}

export interface BrowserRunResult {
  passed: boolean;
  /** index of the first step that did not hold */
  failed_step: number | null;
  /** the run stopped on an expect_text that did not hold (not on a broken click or a crash) */
  failed_on_assert: boolean;
  steps: BrowserStepResult[];
  screenshots: { name: string; file: string; sha256: string }[];
  invariants: DistReplaceInvariants;
  console_errors: string[];
  network_errors: { url: string; status: number }[];
  /** requests refused because they left the allowed origins */
  denied: string[];
  /** old production chunks the page asked for (STALE_PROD_CHUNK_REQUESTED) */
  stale: string[];
  error?: string;
  ms: number;
}

const SECRET_PARAM = /^(token|access_token|auth|authorization|session|sid|key|api_key|password)$/i;
/** Query values that look like credentials are masked before anything is stored. */
export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const k of [...u.searchParams.keys()])
      if (SECRET_PARAM.test(k)) u.searchParams.set(k, '***');
    return u.href;
  } catch {
    return raw.slice(0, 200);
  }
}
const redactText = (s: string) =>
  s.replace(/(cookie|authorization|token|set-cookie)(["']?\s*[:=]\s*)[^\s,;"']+/gi, '$1$2***');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

type Msg = Record<string, unknown> & { t: string };

export async function runBrowserRepro(o: BrowserRunOptions): Promise<BrowserRunResult> {
  const started = Date.now();
  const m = new DistAssetMatcher({
    distDir: o.distDir,
    envUrl: o.envUrl,
    assetUrlPatterns: o.assetUrlPatterns,
  });
  const entryFiles = new Set(m.entryScripts());
  const served = new Set<string>();
  const res: BrowserRunResult = {
    passed: false,
    failed_step: null,
    failed_on_assert: false,
    steps: [],
    screenshots: [],
    invariants: {
      entry_js_replaced: false,
      stale_prod_chunk_blocked: 0,
      dist_asset_hits: 0,
      page_crash: false,
    },
    console_errors: [],
    network_errors: [],
    denied: [],
    stale: [],
    ms: 0,
  };
  fs.mkdirSync(o.outDir, { recursive: true });

  const proc = o.sandbox.start({
    command: browserContainer.command,
    mounts: browserContainer.mounts,
    env: { HOME: '/home/node', CC_BROWSER_INIT: JSON.stringify({ initScript: INTEGRITY_GUARD }) },
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

  const answer = async (req: Msg) => {
    const url = String(req.url);
    const d = m.decide(url, req.nav === true);
    const reply = (r: Record<string, unknown>) => send({ t: 'res', id: req.id, ...r });
    if (d.kind === 'denied') {
      res.denied.push(redactUrl(url));
      return reply({ abort: true });
    }
    if (d.kind === 'stale') {
      res.invariants.stale_prod_chunk_blocked++;
      res.stale.push(redactUrl(url));
      return reply({ abort: true });
    }
    if (d.kind === 'local') {
      res.invariants.dist_asset_hits++;
      served.add(d.key);
      if (entryFiles.has(d.key)) res.invariants.entry_js_replaced = true;
      const origin = (req.headers as Record<string, string>).origin;
      return reply({
        status: 200,
        headers: {
          'content-type': MIME[path.extname(d.file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
          ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
        },
        body: fs.readFileSync(d.file).toString('base64'),
      });
    }
    try {
      const headers = { ...(req.headers as Record<string, string>) };
      delete headers.host;
      const up = await fetch(url, {
        method: String(req.method),
        headers,
        body: req.body ? Buffer.from(String(req.body), 'base64') : undefined,
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      let body = Buffer.from(await up.arrayBuffer());
      const out: Record<string, string> = {};
      up.headers.forEach((v, k) => {
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(k)) out[k] = v;
      });
      if (up.status >= 400) res.network_errors.push({ url: redactUrl(url), status: up.status });
      if (d.kind === 'entry' && (out['content-type'] ?? '').includes('text/html')) {
        const rw = rewriteEntry(body.toString('utf8'), url, m);
        body = Buffer.from(rw.html);
        out['cache-control'] = 'no-store';
      }
      return reply({ status: up.status, headers: out, body: body.toString('base64') });
    } catch {
      res.network_errors.push({ url: redactUrl(url), status: 0 });
      return reply({ abort: true });
    }
  };

  readline.createInterface({ input: proc.stdout as never }).on('line', (line) => {
    let msg: Msg;
    try {
      msg = JSON.parse(line) as Msg;
    } catch {
      return;
    }
    if (msg.t === 'ready') ready();
    else if (msg.t === 'req') void answer(msg);
    else if (msg.t === 'done') {
      waiting.get(msg.cid as number)?.(msg);
      waiting.delete(msg.cid as number);
    } else if (msg.t === 'console' || msg.t === 'pageerror')
      res.console_errors.push(redactText(String(msg.text)));
    else if (msg.t === 'crash') res.invariants.page_crash = true;
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
  const shot = async (name: string) => {
    const r = await cmd({ op: 'screenshot' });
    if (!r.ok || typeof r.data !== 'string') return;
    const png = Buffer.from(r.data, 'base64');
    const file = path.join(o.outDir, `${o.prefix}-${name}.png`);
    fs.writeFileSync(file, png);
    res.screenshots.push({
      name,
      file,
      sha256: crypto.createHash('sha256').update(png).digest('hex'),
    });
  };

  const timer = setTimeout(() => proc.kill(), o.timeoutMs ?? 3 * 60_000);
  const onAbort = () => proc.kill();
  o.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await Promise.race([
      isReady,
      exited.then(() => {
        throw new Error('browser container exited before it was ready');
      }),
    ]);
    const steps: BrowserStep[] = o.repro.steps;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]! as Record<string, unknown>;
      const t0 = Date.now();
      const op = Object.keys(s).find((k) =>
        ['goto', 'click', 'fill', 'select', 'expect_text', 'screenshot'].includes(k),
      )!;
      const loc = (s.click ?? s.fill ?? s.select ?? s.in) as BrowserLocator | undefined;
      const bad = loc ? locatorError(loc) : null;
      let r: Msg;
      if (bad) r = { t: 'done', ok: false, error: bad };
      else if (op === 'screenshot') {
        await shot(String(s.screenshot));
        r = { t: 'done', ok: true };
      } else if (op === 'goto')
        r = await cmd({ op, url: new URL(String(s.goto).replace(/^\/+/, ''), o.envUrl).href });
      else if (op === 'expect_text')
        r = await cmd({ op, text: s.expect_text, in: s.in, mode: s.mode });
      else r = await cmd({ op, loc, value: s.value });

      const data = r.data as { ok?: boolean; actual?: string | null } | undefined;
      const ok = r.ok === true && (op !== 'expect_text' || data?.ok === true);
      res.steps.push({
        step: i,
        op,
        ok,
        ms: Date.now() - t0,
        ...(r.error ? { error: String(r.error) } : {}),
        ...(op === 'expect_text' && data ? { actual: data.actual ?? null } : {}),
      });
      if (!ok) {
        res.failed_step = i;
        res.failed_on_assert = op === 'expect_text' && r.ok === true && !res.invariants.page_crash;
        await shot('failed');
        break;
      }
    }
    if (res.failed_step === null) {
      res.passed = !res.invariants.page_crash;
      await shot('final');
    }
  } catch (e) {
    res.error = (e as Error).message;
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onAbort);
    await cmd({ op: 'close' });
    proc.stdin.end();
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    if (!gone) proc.kill();
  }
  res.ms = Date.now() - started;
  return res;
}
