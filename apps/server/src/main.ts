// cc-app (HTTP) and cc-sys (background tasks) are one program in two processes (docs/06 §1.2):
// `main.ts app`, `main.ts sys`; without an argument (pnpm dev) both run in this process.
// The database is reached as cc_app, which cannot bypass RLS.
import path from 'node:path';
import { databaseUrls, loadConfig } from '@cloudcraft/config';
import { buildApp } from './app.ts';
import { createDb } from './db/client.ts';
import { accountSettings, sourceSettings } from './service/settings.ts';
import { startSysLoop } from './sys.ts';

const role = process.argv[2] ?? 'all';
const c = loadConfig();
const db = createDb(databaseUrls(c).app);

const sources = await sourceSettings(c);
if (role === 'app' || role === 'all') {
  const app = buildApp({
    db,
    logger: true,
    runner: { leaseSeconds: c.CC_RUNNER_LEASE_SECONDS, pollMs: c.CC_RUNNER_POLL_MS },
    accounts: accountSettings(c),
    sources,
    evidenceDir: path.join(c.CC_DATA_DIR, 'evidence'),
  });
  await app.listen({ host: '127.0.0.1', port: c.CC_APP_PORT });
}
if (role === 'sys' || role === 'all')
  startSysLoop(db, {
    reapIntervalMs: c.CC_SYS_REAP_INTERVAL_MS,
    sources,
    onError: (e) => console.error('cc-sys', e),
  });
