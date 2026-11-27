// Task queue, outbox and side-effect registry (docs/06 §2.12, §2.13, §3.6).
// All writes happen inside the caller's workspace transaction, so they commit or vanish with it.
import { and, eq, gt, sql } from 'drizzle-orm';
import { LeaseLostError, type ActorCtx, type Db, type Lease, type Tx } from '../db/client.ts';
import { effects, outbox, workItems } from '../db/schema/index.ts';

export interface WorkSpec {
  kind: string;
  /** at most one queued/leased item per key (06 §2.9); e.g. `node_run:<id>` */
  singletonKey?: string;
  payload?: Record<string, unknown>;
  runAfter?: Date;
}

/** Returns null when an active item with the same singleton key already exists. */
export async function enqueueWork(tx: Tx, ctx: ActorCtx, w: WorkSpec) {
  const rows = await tx
    .insert(workItems)
    .values({
      workspaceId: ctx.workspaceId,
      kind: w.kind,
      singletonKey: w.singletonKey ?? null,
      payload: w.payload ?? {},
      runAfter: w.runAfter ?? sql`now()`,
    })
    .onConflictDoNothing({
      target: [workItems.workspaceId, workItems.singletonKey],
      where: sql`status in ('queued', 'leased')`,
    })
    .returning();
  return rows[0] ?? null;
}

/** Claims due items across workspaces in one committed statement (sys_claim_work). */
export async function claimWork(
  db: Db,
  o: { kinds: string[]; limit: number; owner: string; leaseSeconds: number },
): Promise<Lease[]> {
  const r = await db.pool.query<{
    workspace_id: string;
    work_item_id: string;
    lease_token: string;
    fence: number;
  }>('select * from sys_claim_work($1, $2, $3, $4)', [o.kinds, o.limit, o.owner, o.leaseSeconds]);
  return r.rows.map((x) => ({
    workspaceId: x.workspace_id,
    workItemId: x.work_item_id,
    leaseToken: x.lease_token,
    fence: x.fence,
  }));
}

/** false: the lease is gone and the worker must stop. */
export async function renewLease(db: Db, lease: Lease, seconds: number): Promise<boolean> {
  const r = await db.pool.query<{ ok: boolean }>('select sys_renew_lease($1, $2, $3) as ok', [
    lease.workItemId,
    lease.leaseToken,
    seconds,
  ]);
  return r.rows[0]?.ok === true;
}

/** Finish a leased item inside the lease transaction; commits together with advance(). */
export async function completeWork(
  tx: Tx,
  lease: Lease,
  status: 'done' | 'failed' = 'done',
  error?: string,
) {
  const rows = await tx
    .update(workItems)
    .set({ status, lastError: error ?? null, updatedAt: sql`now()` })
    .where(
      and(
        eq(workItems.id, lease.workItemId),
        eq(workItems.leaseToken, lease.leaseToken),
        eq(workItems.status, 'leased'),
        gt(workItems.leaseExpiresAt, sql`now()`),
      ),
    )
    .returning({ id: workItems.id });
  if (rows.length === 0) throw new LeaseLostError();
}

export async function enqueueOutbox(
  tx: Tx,
  ctx: ActorCtx,
  topic: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(outbox).values({ workspaceId: ctx.workspaceId, topic, payload });
}

/**
 * Registers an external side effect under its idempotency key before running it. `created: false`
 * means it was registered earlier: read back its status (and the outside world) instead of redoing it.
 */
export async function registerEffect(
  tx: Tx,
  ctx: ActorCtx,
  e: { key: string; kind: string; request: Record<string, unknown>; nodeRunId?: string },
) {
  const inserted = await tx
    .insert(effects)
    .values({
      workspaceId: ctx.workspaceId,
      effectKey: e.key,
      kind: e.kind,
      request: e.request,
      nodeRunId: e.nodeRunId ?? null,
    })
    .onConflictDoNothing({ target: [effects.workspaceId, effects.effectKey] })
    .returning();
  if (inserted[0]) return { effect: inserted[0], created: true };
  const existing = await tx.select().from(effects).where(eq(effects.effectKey, e.key));
  return { effect: existing[0]!, created: false };
}
