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

/** The runner's long-term secret did not match (or the runner was revoked). */
export class RunnerAuthError extends Error {
  readonly code = 'runner.unauthorized';
  constructor() {
    super('runner not recognised');
    this.name = 'RunnerAuthError';
  }
}

const isAuthFailure = (e: unknown) =>
  (e as { code?: string }).code === '28000' ||
  (e as { cause?: { code?: string } }).cause?.code === '28000';

/** Runner request: the secret decides the workspace (app_enter_runner, 06 §2.3). */
export async function withRunnerTx<T>(
  db: Db,
  runner: { runnerId: string; secret: string },
  fn: (tx: Tx, actor: ActorCtx) => Promise<T>,
): Promise<T> {
  try {
    return await db.orm.transaction(async (tx) => {
      const r = await tx.execute<{ ws: string }>(
        sql`select app_enter_runner(${runner.runnerId}::uuid, ${runner.secret}) as ws`,
      );
      return fn(tx, { workspaceId: r.rows[0]!.ws, actorUserId: null, clientSource: 'system_sync' });
    });
  } catch (e) {
    if (isAuthFailure(e)) throw new RunnerAuthError();
    throw e;
  }
}

/** Enrollment: a valid one-time token enters the runner's workspace (app_enroll_runner). */
export async function withEnrollTx<T>(
  db: Db,
  enrollToken: string,
  fn: (tx: Tx, actor: ActorCtx, runnerId: string) => Promise<T>,
): Promise<T> {
  try {
    return await db.orm.transaction(async (tx) => {
      const r = await tx.execute<{ id: string }>(
        sql`select app_enroll_runner(${enrollToken}) as id`,
      );
      const ws = await tx.execute<{ ws: string }>(
        sql`select current_setting('app.current_workspace_id') as ws`,
      );
      return fn(
        tx,
        { workspaceId: ws.rows[0]!.ws, actorUserId: null, clientSource: 'system_sync' },
        r.rows[0]!.id,
      );
    });
  } catch (e) {
    if (isAuthFailure(e)) throw new RunnerAuthError();
    throw e;
  }
}
