// The browser container (docs/06 §5.2): Playwright's own image at the driver's version, the driver and
// container/runner.mjs mounted read-only. The caller adds network none, limits and labels.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

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
