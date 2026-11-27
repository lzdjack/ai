// The PC client's renderer, developed in the browser first (docs/07 §3; Electron comes with U2).
// Port: CC_WEB_PORT from the environment or ~/.cloudcraft-dev/.env (only that key is read), default
// 4300. Vite loads this file with Node's type stripping, so it does not import @cloudcraft/config.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const envFile = path.join(
  process.env.CC_DATA_DIR || path.join(os.homedir(), '.cloudcraft-dev'),
  '.env',
);
const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
const port = Number(process.env.CC_WEB_PORT || fileEnv.CC_WEB_PORT || 4300);
const appPort = Number(process.env.CC_APP_PORT || fileEnv.CC_APP_PORT || 4100);

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  // /v1 (and its WebSocket) goes to cc-app, so the page and the API share one origin in development
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
    proxy: { '/v1': { target: `http://127.0.0.1:${appPort}`, ws: true } },
  },
  build: { outDir: '../../dist', emptyOutDir: true },
});
