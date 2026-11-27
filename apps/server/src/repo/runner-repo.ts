// SQL for executors and their leases (docs/06 §2.12, §5.3a). Every function runs inside a runner
// transaction (withRunnerTx / withEnrollTx), so RLS keeps it to the runner's workspace.
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Tx } from '../db/client.ts';
import { flowInstances, nodeRuns, runners, workItems } from '../db/schema/index.ts';

export const leaseOwner = (runnerId: string) => `runner:${runnerId}`;

export async function getRunner(tx: Tx, runnerId: string) {
  const [r] = await tx.select().from(runners).where(eq(runners.id, runnerId));
  return r!;
}

/** Heartbeat: not an event-worthy change (runners has no leak probe). */
export async function touchRunner(tx: Tx, runnerId: string) {
  await tx
    .update(runners)
    .set({ lastHeartbeatAt: sql`now()` })
    .where(eq(runners.id, runnerId));
}

/** Extends the given leases held by this runner; returns the ids that were extended. */
export async function renewLeases(
  tx: Tx,
  runnerId: string,
  leases: { work_item_id: string; lease_token: string }[],
  seconds: number,
): Promise<Set<string>> {
  const renewed = new Set<string>();
  for (const l of leases) {
    const rows = await tx
      .update(workItems)
      .set({
        leaseExpiresAt: sql`now() + make_interval(secs => ${seconds})`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(workItems.id, l.work_item_id),
          eq(workItems.leaseToken, l.lease_token),
          eq(workItems.leaseOwner, leaseOwner(runnerId)),
          eq(workItems.status, 'leased'),
          sql`${workItems.leaseExpiresAt} > now()`,
        ),
      )
      .returning({ id: workItems.id });
    if (rows[0]) renewed.add(rows[0].id);
  }
  return renewed;
}

/** Leases due items of one kind to this runner; committed when the request's transaction ends. */
export async function claimForRunner(
  tx: Tx,
  o: { runnerId: string; kind: string; limit: number; seconds: number },
) {
  if (o.limit <= 0) return [];
  const r = await tx.execute<{ id: string }>(sql`
    with due as (
      select id from work_items
      where status = 'queued' and run_after <= now() and kind = ${o.kind}
      order by run_after
      limit ${o.limit}
      for update skip locked
    )
    update work_items w
    set status = 'leased', lease_token = gen_random_uuid(), lease_owner = ${leaseOwner(o.runnerId)},
        lease_expires_at = now() + make_interval(secs => ${o.seconds}),
        fence = w.fence + 1, attempts = w.attempts + 1, updated_at = now()
    from due where w.id = due.id
    returning w.id`);
  if (r.rows.length === 0) return [];
  return tx
    .select()
    .from(workItems)
    .where(
      inArray(
        workItems.id,
        r.rows.map((x) => x.id),
      ),
    );
}

export async function getNodeRunWithFlow(tx: Tx, nodeRunId: string) {
  const [row] = await tx
    .select({ run: nodeRuns, flow: flowInstances })
    .from(nodeRuns)
    .innerJoin(flowInstances, eq(flowInstances.id, nodeRuns.flowInstanceId))
    .where(eq(nodeRuns.id, nodeRunId));
  return row!;
}

/** The work item behind a write-back, locked; null unless this runner still holds that lease. */
export async function lockHeldLease(
  tx: Tx,
  runnerId: string,
  l: { work_item_id: string; lease_token: string; fence: number },
) {
  const [w] = await tx
    .select({ item: workItems, live: sql<boolean>`${workItems.leaseExpiresAt} > now()` })
    .from(workItems)
    .where(eq(workItems.id, l.work_item_id))
    .for('update');
  const ok =
    w &&
    w.live &&
    w.item.status === 'leased' &&
    w.item.leaseToken === l.lease_token &&
    w.item.leaseOwner === leaseOwner(runnerId) &&
    w.item.fence === l.fence;
  return ok ? w.item : null;
}
