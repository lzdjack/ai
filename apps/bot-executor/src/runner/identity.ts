// The executor's identity on this host (docs/06 §2.3, §2.10): a long-term secret it signs in with
// and the bot_exec X25519 key pair. Both are generated here; the server only ever gets the secret's
// hash at enrollment and the public key. Files are readable by this system user only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RUNNER_SECRET_PREFIX } from '@cloudcraft/core-protocol';
import type { RunnerCredentials, RunnerTransport } from './transport.ts';

interface Stored extends RunnerCredentials {
  server: string;
  workspaceId: string;
}

export async function loadOrEnroll(o: {
  dir: string;
  server: string;
  transport: RunnerTransport;
  enrollToken?: string;
}): Promise<RunnerCredentials & { enrolled: boolean }> {
  const credFile = path.join(o.dir, 'credentials.json');
  if (fs.existsSync(credFile)) {
    const c = JSON.parse(fs.readFileSync(credFile, 'utf8')) as Stored;
    if (c.server === o.server && !o.enrollToken) return { ...c, enrolled: false };
  }
  if (!o.enrollToken) throw new Error('not enrolled: pass a one-time enrollment token');

  fs.mkdirSync(o.dir, { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const keyFile = path.join(o.dir, 'bot_exec.key');
  fs.rmSync(keyFile, { force: true });
  fs.writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o400 });
  const secret = RUNNER_SECRET_PREFIX + crypto.randomBytes(32).toString('base64url');
  const r = await o.transport.registerRunner({
    enroll_token: o.enrollToken,
    bot_exec_public_key: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    secret_sha256: crypto.createHash('sha256').update(secret).digest('hex'),
  });
  const stored: Stored = {
    server: o.server,
    runnerId: r.runner_id,
    workspaceId: r.workspace_id,
    secret,
  };
  fs.writeFileSync(credFile, JSON.stringify(stored, null, 2), { mode: 0o600 });
  return { runnerId: r.runner_id, secret, enrolled: true };
}
