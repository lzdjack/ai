// Ticket numbers (docs/06 §2.3 workspace_counters): one UPDATE … RETURNING, no gaps from races.
import { sql } from 'drizzle-orm';
import type { Tx } from '../db/client.ts';

export async function nextTicketNo(tx: Tx, workspaceId: string): Promise<number> {
  const r = await tx.execute<{ n: number }>(sql`
    insert into workspace_counters (workspace_id, counter_type, next_val)
    values (${workspaceId}::uuid, 'ticket', 2)
    on conflict (workspace_id, counter_type) do update set next_val = workspace_counters.next_val + 1
    returning (next_val - 1)::int as n`);
  return r.rows[0]!.n;
}
