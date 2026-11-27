// External side effects that cannot be undone — merging an MR, uploading artifacts, switching a
// release (docs/06 §3.6 item 5, §3.3) — and the lease reaper that notices when a worker died
// halfway through one (06 §2.12, §5.8).
import { and, eq, sql } from 'drizzle-orm';
import { withLeaseTx, type ActorCtx, type Db, type Lease, type Tx } from '../db/client.ts';
import { effects, workItems } from '../db/schema/index.ts';
import { RUN_NODE, pgOrchestrator } from './flow.ts';
import { completeWork, registerEffect } from './queue.ts';

export interface EffectSpec {
  /** idempotency key: the same key means the same outside change (include the version it ships) */
  key: string;
  kind: string;
  request: Record<string, unknown>;
  nodeRunId: string;
}

export interface EffectIo<R> {
  execute(): Promise<R>;
  /** what the outside world says about this change; null when it did not happen */
  readBack(): Promise<R | null>;
}

/**
 * Runs an external change at most once per key. The key is registered (committed) before the call;
 * if an earlier attempt registered it and never recorded an outcome, the outside world is read back
 * first and the call is skipped when the change is already there. `then` commits in the same
 * transaction as the recorded success — typically completeWork() + advance().
 */
export async function runEffect<R extends Record<string, unknown>, T>(
  db: Db,
  lease: Lease,
  spec: EffectSpec,
  io: EffectIo<R>,
  then: (tx: Tx, ctx: ActorCtx, result: R) => Promise<T>,
): Promise<T> {
  const prior = await withLeaseTx(db, lease, async (tx, ctx) => {
    const { effect, created } = await registerEffect(tx, ctx, spec);
    if (created) return { result: null, readBack: false };
    if (effect.status === 'succeeded') return { result: effect.result as R, readBack: false };
    // an earlier attempt never recorded an outcome: claim it for this node run, then read back
    await tx
      .update(effects)
      .set({ status: 'pending', nodeRunId: spec.nodeRunId, updatedAt: sql`now()` })
      .where(eq(effects.id, effect.id));
    return { result: null, readBack: true };
  });

  let result = prior.result;
  let verified = false;
  if (!result && prior.readBack) {
    result = await io.readBack();
    verified = result !== null;
  }
  // a throw leaves the effect pending: its outcome is unknown, the next attempt reads back first
  result ??= await io.execute();

  return withLeaseTx(db, lease, async (tx, ctx) => {
    await tx
      .update(effects)
      .set({
        status: 'succeeded',
        result,
        verifiedAt: verified ? sql`now()` : null,
        updatedAt: sql`now()`,
      })
      .where(eq(effects.effectKey, spec.key));
    return then(tx, ctx, result!);
  });
}

/**
 * lease_reaper: items whose worker stopped renewing. A node run with an external change in flight is
 * marked interrupted and waits for a person (06 §3.6 item 5); anything else goes back to the queue
 * and resumes from its checkpoint. Returns how many items were handled.
 */
export async function reapExpiredLeases(
  db: Db,
  o: { owner: string; limit?: number; leaseSeconds?: number },
): Promise<number> {
  const r = await db.pool.query<{
    workspace_id: string;
    work_item_id: string;
    lease_token: string;
    fence: number;
  }>('select * from sys_claim_expired($1, $2, $3)', [o.limit ?? 20, o.owner, o.leaseSeconds ?? 30]);
  for (const x of r.rows) {
    const lease: Lease = {
      workspaceId: x.workspace_id,
      workItemId: x.work_item_id,
      leaseToken: x.lease_token,
      fence: x.fence,
    };
    await withLeaseTx(db, lease, async (tx, ctx) => {
      const [item] = await tx.select().from(workItems).where(eq(workItems.id, lease.workItemId));
      const p = item!.payload as { flow_instance_id?: string; node_run_id?: string };
      const inFlight =
        item!.kind === RUN_NODE && p.node_run_id
          ? await tx
              .update(effects)
              .set({ status: 'interrupted', updatedAt: sql`now()` })
              .where(and(eq(effects.nodeRunId, p.node_run_id), eq(effects.status, 'pending')))
              .returning({ id: effects.id })
          : [];
      if (inFlight.length > 0) {
        await completeWork(tx, lease, 'failed', 'interrupted');
        await pgOrchestrator.signal(tx, ctx, p.flow_instance_id!, {
          type: 'node_finished',
          nodeRunId: p.node_run_id!,
          outcome: 'interrupted',
        });
        return;
      }
      await tx
        .update(workItems)
        .set({
          status: 'queued',
          leaseToken: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          runAfter: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(eq(workItems.id, lease.workItemId), eq(workItems.leaseToken, lease.leaseToken)));
    });
  }
  return r.rows.length;
}
