// Runtime database access (docs/06 §2.3, §2.12, §13.5). Connects as cc_app, which cannot bypass RLS.
// Every unit of work runs in a transaction that first pins the workspace context:
//   withWorkspaceTx: a user acting in a workspace (membership checked by app_enter)
//   withLeaseTx:     a system task holding a committed lease (workspace taken from the work item)
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { ClientSource } from './events.ts';
import * as schema from './schema/index.ts';

export type Orm = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Orm['transaction']>[0]>[0];

export interface Db {
  pool: pg.Pool;
  orm: Orm;
  close(): Promise<void>;
}

/** Short write transactions (06 §13.5): idle-in-transaction 60 s, statements 30 s. */
export function createDb(appUrl: string, opts: { max?: number } = {}): Db {
  const pool = new pg.Pool({
    connectionString: appUrl,
    max: opts.max ?? 10,
    options: '-c idle_in_transaction_session_timeout=60000 -c statement_timeout=30000',
  });
  return {
    pool,
    orm: drizzle({ client: pool, schema, casing: 'snake_case' }),
    close: () => pool.end(),
  };
}

/** Who is acting, carried into every event. */
export interface ActorCtx {
  workspaceId: string;
  /** null for system tasks */
  actorUserId: string | null;
  clientSource: ClientSource;
  requestId?: string;
}

export async function withWorkspaceTx<T>(
  db: Db,
  ctx: { userId: string; workspaceId: string; clientSource?: ClientSource; requestId?: string },
  fn: (tx: Tx, actor: ActorCtx) => Promise<T>,
): Promise<T> {
  return db.orm.transaction(async (tx) => {
    await tx.execute(sql`select app_enter(${ctx.userId}::uuid, ${ctx.workspaceId}::uuid)`);
    return fn(tx, {
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      clientSource: ctx.clientSource ?? 'api',
      requestId: ctx.requestId,
    });
  });
}

export interface Lease {
  workspaceId: string;
  workItemId: string;
  leaseToken: string;
  fence: number;
}

export class LeaseLostError extends Error {
  constructor() {
    super('lease lost');
    this.name = 'LeaseLostError';
  }
}

const isLeaseLost = (e: unknown) =>
  (e as { code?: string; cause?: { code?: string } }).code === 'CC001' ||
  (e as { cause?: { code?: string } }).cause?.code === 'CC001';

export async function withLeaseTx<T>(
  db: Db,
  lease: Lease,
  fn: (tx: Tx, actor: ActorCtx) => Promise<T>,
): Promise<T> {
  try {
    return await db.orm.transaction(async (tx) => {
      await tx.execute(
        sql`select app_enter_lease(${lease.workItemId}::uuid, ${lease.leaseToken}::uuid)`,
      );
      return fn(tx, {
        workspaceId: lease.workspaceId,
        actorUserId: null,
        clientSource: 'system_sync',
      });
    });
  } catch (e) {
    if (isLeaseLost(e)) throw new LeaseLostError();
    throw e;
  }
}
