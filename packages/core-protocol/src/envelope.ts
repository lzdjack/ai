// Credential envelopes between the control plane and executors (docs/06 §2.10). Node only: import as
// '@cloudcraft/core-protocol/envelope', never from browser code.
//   DEK → AES-256-GCM under HKDF(X25519(ephemeral, executor bot_exec key)); payload → AES-256-GCM
//   under the DEK. The executor's private key never leaves its host.
import crypto from 'node:crypto';
import type { CredentialEnvelope } from './connectors.ts';

const b64 = (b: Buffer) => b.toString('base64');

function seal(key: Buffer, plain: Buffer): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return b64(Buffer.concat([iv, c.getAuthTag(), ct]));
}

function open(key: Buffer, sealed: string): Buffer {
  const raw = Buffer.from(sealed, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
}

export const aesSeal = seal;
export const aesOpen = open;

const INFO = Buffer.from('cloudcraft-envelope-v1');

/** Seals `payload` to an executor's X25519 public key (base64 SPKI DER). */
export function sealToRunner(
  runnerPublicKey: string,
  fingerprint: string,
  secretId: string,
  payload: Record<string, unknown>,
): CredentialEnvelope {
  const pub = crypto.createPublicKey({
    key: Buffer.from(runnerPublicKey, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const eph = crypto.generateKeyPairSync('x25519');
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: pub });
  const kek = Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.from(secretId), INFO, 32));
  const dek = crypto.randomBytes(32);
  return {
    secret_id: secretId,
    key_fingerprint: fingerprint,
    ephemeral_public_key: b64(eph.publicKey.export({ type: 'spki', format: 'der' })),
    wrapped_key: seal(kek, dek),
    ciphertext: seal(dek, Buffer.from(JSON.stringify(payload))),
  };
}

/** The executor side of sealToRunner. */
export function openFromServer(
  privateKeyPem: string,
  env: CredentialEnvelope,
): Record<string, unknown> {
  const priv = crypto.createPrivateKey(privateKeyPem);
  const eph = crypto.createPublicKey({
    key: Buffer.from(env.ephemeral_public_key, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const shared = crypto.diffieHellman({ privateKey: priv, publicKey: eph });
  const kek = Buffer.from(crypto.hkdfSync('sha256', shared, Buffer.from(env.secret_id), INFO, 32));
  const dek = open(kek, env.wrapped_key);
  return JSON.parse(open(dek, env.ciphertext).toString()) as Record<string, unknown>;
}
