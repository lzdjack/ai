// cc-sys background loop (docs/06 §1.2, §2.12). E1: lease_reaper on a timer; P2: the change-stream
// relay (numbers committed changes per workspace, then NOTIFYs cc_change for the WebSocket hubs);
// P4: round deliveries (fact check against the code platform, then the delivery card); P6: the
// delivery segment's cc-sys steps (open MRs, notify) and interrupted release steps.
// Dispatch, collection, outbox delivery and the other system tasks join this loop with their own steps.
import os from 'node:os';
import type { Db } from './db/client.ts';
import { reapExpiredLeases } from './orchestrator/effects.ts';
import { assignStreamSeq } from './repo/account-repo.ts';
import type { SourceSettings } from './service/source-service.ts';
import { runDeliveryNodes } from './service/delivery-service.ts';
import { deliveryStepInterrupted } from './service/release-step-service.ts';
import { deliverRounds } from './service/ticket-service.ts';

export interface SysLoop {
  stop(): Promise<void>;
}

export function startSysLoop(
  db: Db,
  o: {
    reapIntervalMs: number;
    streamIntervalMs?: number;
    /** needed to check deliveries against the code platforms (round_deliver) */
    sources?: SourceSettings;
    onError?: (e: unknown) => void;
  },
): SysLoop {
  const owner = `cc-sys:${os.hostname()}:${process.pid}`;
  let running: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    running = running.then(() =>
      reapExpiredLeases(db, { owner, onInterrupted: deliveryStepInterrupted }).catch((e: unknown) =>
        o.onError?.(e),
      ),
    );
  }, o.reapIntervalMs);
  // deliveries waiting for their fact check (06 §5.7): often, they are what a reviewer waits for
  let delivering: Promise<unknown> = Promise.resolve();
  const deliver = o.sources
    ? setInterval(() => {
        delivering = delivering.then(async () => {
          await deliverRounds(db, o.sources!, owner).catch((e: unknown) => o.onError?.(e));
          // delivery segment steps cc-sys runs: opening MRs, notifications (06 §3.3)
          await runDeliveryNodes(db, o.sources!, owner).catch((e: unknown) => o.onError?.(e));
        });
      }, 1000)
    : null;
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
      if (deliver) clearInterval(deliver);
      await running;
      await relaying;
      await delivering;
    },
  };
}
