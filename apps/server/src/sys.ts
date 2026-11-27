// cc-sys background loop (docs/06 §1.2, §2.12). E1: lease_reaper on a timer. Dispatch, collection,
// outbox delivery and the other system tasks join this loop with their own steps.
import os from 'node:os';
import type { Db } from './db/client.ts';
import { reapExpiredLeases } from './orchestrator/effects.ts';

export interface SysLoop {
  stop(): Promise<void>;
}

export function startSysLoop(
  db: Db,
  o: { reapIntervalMs: number; onError?: (e: unknown) => void },
): SysLoop {
  const owner = `cc-sys:${os.hostname()}:${process.pid}`;
  let running: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    running = running.then(() =>
      reapExpiredLeases(db, { owner }).catch((e: unknown) => o.onError?.(e)),
    );
  }, o.reapIntervalMs);
  return {
    async stop() {
      clearInterval(timer);
      await running;
    },
  };
}
