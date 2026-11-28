// Credentials at rest (docs/06 §2.10, standard managed tier): the secret under a fresh data key
// (AES-256-GCM), the data key under the master key (locally ~/.cloudcraft-dev/keys/dev-master.key, a
// KMS key in production). Delivery to executors is @cloudcraft/core-protocol/envelope.
import crypto from 'node:crypto';
import { aesOpen as open, aesSeal as seal } from '@cloudcraft/core-protocol/envelope';

export interface SealedSecret {
  ciphertext: string;
  wrappedDek: string;
  hint: string;
}

/** Encrypts a credential (any JSON) for storage; the hint is the last 4 characters of its first value. */
export function sealSecret(masterKey: Buffer, value: Record<string, unknown>): SealedSecret {
  const dek = crypto.randomBytes(32);
  const first = String(Object.values(value)[0] ?? '');
  return {
    ciphertext: seal(dek, Buffer.from(JSON.stringify(value))),
    wrappedDek: seal(masterKey, dek),
    hint: first.length >= 8 ? first.slice(-4) : '',
  };
}

export function openSecret(masterKey: Buffer, s: { ciphertext: string; wrappedDek: string }) {
  const dek = open(masterKey, s.wrappedDek);
  return JSON.parse(open(dek, s.ciphertext).toString()) as Record<string, unknown>;
}

export { openFromServer, sealToRunner } from '@cloudcraft/core-protocol/envelope';
