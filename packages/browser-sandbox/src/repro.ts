// Host side of one browser repro run (docs/06 §5.2, §5.7): starts the browser container (no network),
// answers every request it makes through DistAssetMatcher, drives the declarative steps and records
// screenshots, the replacement invariants and the page's own errors (redacted).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
import { fetchUpstream, openBrowser, type Msg } from './session.ts';

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

  const answer = async (req: Msg): Promise<Record<string, unknown>> => {
    const url = String(req.url);
    const d = m.decide(url, req.nav === true);
    if (d.kind === 'denied') {
      res.denied.push(redactUrl(url));
      return { abort: true };
    }
    if (d.kind === 'stale') {
      res.invariants.stale_prod_chunk_blocked++;
      res.stale.push(redactUrl(url));
      return { abort: true };
    }
    if (d.kind === 'local') {
      res.invariants.dist_asset_hits++;
      served.add(d.key);
      if (entryFiles.has(d.key)) res.invariants.entry_js_replaced = true;
      const origin = (req.headers as Record<string, string>).origin;
      return {
        status: 200,
        headers: {
          'content-type': MIME[path.extname(d.file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
          ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
        },
        body: fs.readFileSync(d.file).toString('base64'),
      };
    }
    try {
      const up = await fetchUpstream(req);
      let body = up.body;
      const out = up.headers;
      if (up.status >= 400) res.network_errors.push({ url: redactUrl(url), status: up.status });
      if (d.kind === 'entry' && (out['content-type'] ?? '').includes('text/html')) {
        const rw = rewriteEntry(body.toString('utf8'), url, m);
        body = Buffer.from(rw.html);
        out['cache-control'] = 'no-store';
      }
      return { status: up.status, headers: out, body: body.toString('base64') };
    } catch {
      res.network_errors.push({ url: redactUrl(url), status: 0 });
      return { abort: true };
    }
  };

  const session = openBrowser({
    sandbox: o.sandbox,
    answer,
    init: { initScript: INTEGRITY_GUARD },
    onEvent: (msg) => {
      if (msg.t === 'console' || msg.t === 'pageerror')
        res.console_errors.push(redactText(String(msg.text)));
      else if (msg.t === 'crash') res.invariants.page_crash = true;
    },
  });
  const cmd = session.cmd;
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

  const timer = setTimeout(() => session.kill(), o.timeoutMs ?? 3 * 60_000);
  const onAbort = () => session.kill();
  o.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await session.ready;
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
    await session.close();
  }
  res.ms = Date.now() - started;
  return res;
}
