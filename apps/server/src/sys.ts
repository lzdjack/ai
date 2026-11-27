// cc-sys background loop (docs/06 §1.2, §2.12). E1: lease_reaper on a timer; P2: the change-stream
// relay (numbers committed changes per workspace, then NOTIFYs cc_change for the WebSocket hubs).
// Dispatch, collection, outbox delivery and the other system tasks join this loop with their own steps.
import os from 'node:os';
import type { Db } from './db/client.ts';
import { reapExpiredLeases } from './orchestrator/effects.ts';
import { assignStreamSeq } from './repo/account-repo.ts';

export interface SysLoop {
  stop(): Promise<void>;
}

export function startSysLoop(
  db: Db,
  o: { reapIntervalMs: number; streamIntervalMs?: number; onError?: (e: unknown) => void },
): SysLoop {
  const owner = `cc-sys:${os.hostname()}:${process.pid}`;
  let running: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    running = running.then(() =>
      reapExpiredLeases(db, { owner }).catch((e: unknown) => o.onError?.(e)),
    );
  }, o.reapIntervalMs);
  let relaying: Promise<unknown> = Promise.resolve();
  const relay = setInterval(() => {
    relaying = relaying.then(async () => {
      try {
        for (const ws of await assignStreamSeq(db.orm))
          await db.pool.query('select pg_notify($1, $2)', ['cc_change', ws]);
      } catch (e) {
        o.onError?.(e);
      }
    });
  }, o.streamIntervalMs ?? 200);
  return {
    async stop() {
      clearInterval(timer);
      clearInterval(relay);
      await running;
      await relaying;
    },
  };
}
