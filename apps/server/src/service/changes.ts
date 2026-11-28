// Change stream writes (docs/06 §3.7, §2.13): in the same transaction as the business write, a short
// row summary (≤ 2KB) or a tombstone. Sequence numbers are handed out after commit by the relay.
import type { ActorCtx, Tx } from '../db/client.ts';
import { changeStream } from '../db/schema/index.ts';

export interface Change {
  entity: string;
  entityId: string;
  op: 'upsert' | 'tombstone';
  rev: number;
  row?: Record<string, unknown> | null;
  projectId?: string | null;
  /** only this user may receive it (their notifications) */
  recipientUserId?: string | null;
}

export async function publish(tx: Tx, ctx: ActorCtx, c: Change): Promise<void> {
  const row = c.op === 'tombstone' ? null : (c.row ?? null);
  if (row && JSON.stringify(row).length > 2048)
    throw new Error(`change row of ${c.entity} exceeds 2KB; send an address instead`);
  await tx.insert(changeStream).values({
    workspaceId: ctx.workspaceId,
    entity: c.entity,
    entityId: c.entityId,
    op: c.op,
    entityRev: c.rev,
    row,
    projectId: c.projectId ?? null,
    recipientUserId: c.recipientUserId ?? null,
  });
}
