// Runs inside the browser container (docs/06 §5.2): headless Chromium with no network at all. Every
// request the page makes is sent to the host over stdout and answered over stdin; the host decides
// (local build / environment / refused). The host also sends the commands, one at a time.
// Protocol, one JSON per line:
//   out {t:'req', id, url, method, headers, body, nav}   in {t:'res', id, status, headers, body} | {t:'res', id, abort:true}
//   in  {t:'cmd', cid, op, ...}                          out {t:'done', cid, ok, data?, error?}
//   out {t:'console', text} | {t:'pageerror', text} | {t:'crash'} | {t:'ready'}
import readline from 'node:readline';
import { chromium } from 'playwright-core';

const ACTION_MS = 5000;
const send = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);
const pending = new Map();
let seq = 0;
const ask = (m) =>
  new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    send({ ...m, id });
  });

const init = JSON.parse(process.env.CC_BROWSER_INIT ?? '{}');
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
const ctx = await browser.newContext({
  serviceWorkers: 'block',
  viewport: { width: 1280, height: 800 },
  locale: init.locale ?? 'zh-CN',
});
if (init.initScript) await ctx.addInitScript(init.initScript);
await ctx.routeWebSocket(/.*/, (ws) => ws.close());
await ctx.route('**/*', async (route) => {
  const req = route.request();
  const r = await ask({
    t: 'req',
    url: req.url(),
    method: req.method(),
    headers: await req.allHeaders(),
    body: req.postDataBuffer()?.toString('base64') ?? null,
    nav: req.isNavigationRequest(),
  });
  if (r.abort) return route.abort('blockedbyclient').catch(() => {});
  return route
    .fulfill({ status: r.status, headers: r.headers, body: Buffer.from(r.body ?? '', 'base64') })
    .catch(() => {});
});
const page = await ctx.newPage();
page.setDefaultTimeout(ACTION_MS);
page.on(
  'console',
  (m) => m.type() === 'error' && send({ t: 'console', text: m.text().slice(0, 500) }),
);
page.on('pageerror', (e) => send({ t: 'pageerror', text: String(e).slice(0, 500) }));
page.on('crash', () => send({ t: 'crash' }));

function locate(l) {
  let x;
  if (l.role) x = page.getByRole(l.role, l.name ? { name: l.name } : {});
  else if (l.text) x = page.getByText(l.text);
  else if (l.label) x = page.getByLabel(l.label);
  else x = page.locator(l.css);
  return l.nth !== undefined ? x.nth(l.nth) : x.first();
}

async function expectText(c) {
  const mode = c.mode ?? 'contains';
  const deadline = Date.now() + ACTION_MS;
  let actual;
  for (;;) {
    actual = c.in
      ? await locate(c.in)
          .innerText({ timeout: 1000 })
          .catch(() => null)
      : await page.locator('body').innerText();
    if (actual !== null) {
      const t = actual.trim();
      const ok =
        mode === 'equals'
          ? t === c.text
          : mode === 'not_contains'
            ? !t.includes(c.text)
            : t.includes(c.text);
      if (ok) return { ok: true, actual: t.slice(0, 300) };
    }
    if (Date.now() > deadline)
      return { ok: false, actual: actual === null ? null : actual.trim().slice(0, 300) };
    await page.waitForTimeout(150);
  }
}

async function run(c) {
  switch (c.op) {
    case 'goto':
      await page.goto(c.url, { waitUntil: 'load', timeout: 15000 });
      return null;
    case 'click':
      await locate(c.loc).click();
      return null;
    case 'fill':
      await locate(c.loc).fill(c.value);
      return null;
    case 'select':
      await locate(c.loc).selectOption(c.value);
      return null;
    case 'expect_text':
      return expectText(c);
    case 'screenshot':
      return (await page.screenshot({ type: 'png' })).toString('base64');
    case 'close':
      await browser.close();
      setImmediate(() => process.exit(0));
      return null;
    default:
      throw new Error(`unknown op ${c.op}`);
  }
}

readline.createInterface({ input: process.stdin }).on('line', (line) => {
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    return;
  }
  if (m.t === 'res') {
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  } else if (m.t === 'cmd') {
    run(m).then(
      (data) => send({ t: 'done', cid: m.cid, ok: true, data }),
      (e) =>
        send({
          t: 'done',
          cid: m.cid,
          ok: false,
          error: String(e?.message ?? e)
            .split('\n')[0]
            .slice(0, 500),
        }),
    );
  }
});
send({ t: 'ready' });
