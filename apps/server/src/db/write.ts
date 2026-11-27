// The only way business rows are written (docs/06 §2.8, §2.11, §3.5): each write and its event go
// into the same transaction. Redaction happens here and nowhere else. Tables made with the table
// helper carry an audit-probe trigger, so a write that bypasses these functions shows up as a probe
// without an event (findUnmatchedProbes).
import { eq, getTableColumns, getTableName, sql, type InferSelectModel } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { PgColumn, PgInsertValue, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import type { ActorCtx, Tx } from './client.ts';
import { events, type ActionKind, type RevertMode } from './events.ts';
import { workspaceMembers, workspaces } from './schema/index.ts';

export type TenantTable = PgTable & {
  id: PgColumn;
  workspaceId: PgColumn;
  rev: PgColumn;
  updatedAt: PgColumn;
  deletedAt: PgColumn;
};

export class NotFoundError extends Error {
  readonly code = 'common.not_found';
}

/** Someone else changed the row since the client read it (06 §3.5). */
export class RevConflictError extends Error {
  readonly code = 'common.rev_conflict';
  constructor(readonly currentRev: number) {
    super('row was changed by someone else');
  }
}

const SECRET_KEY = /password|secret|token|api_?key|hash|credential|private_?key/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[redacted]' : redact(v)]),
    );
  }
  return value;
}

type Row = Record<string, unknown>;

/** Row as stored: column names (snake_case) instead of property names, secrets redacted. */
function snapshot(table: PgTable, row: Row): Row {
  const out: Row = {};
  for (const [prop, col] of Object.entries(getTableColumns(table)))
    out[col.keyAsName ? toSnakeCase(col.name) : col.name] = row[prop];
  return redact(JSON.parse(JSON.stringify(out))) as Row;
}

const IGNORED_FIELDS = new Set(['rev', 'updated_at']);

export interface EventSpec {
  action: ActionKind;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  display?: string | null;
  before?: Row | null;
  after?: Row | null;
  revertMode?: RevertMode;
  category?: 'workflow' | 'security_audit';
}

export async function recordEvent(tx: Tx, ctx: ActorCtx, e: EventSpec): Promise<void> {
  const before = e.before ? (redact(e.before) as Row) : null;
  const after = e.after ? (redact(e.after) as Row) : null;
  const changed =
    before && after
      ? Object.keys({ ...before, ...after }).filter(
          (k) => !IGNORED_FIELDS.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]),
        )
      : null;
  await tx.insert(events).values({
    workspaceId: ctx.workspaceId,
    eventCategory: e.category ?? 'workflow',
    actionKind: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    entityDisplay: e.display ?? null,
    scopeType: e.projectId ? 'project' : 'workspace',
    scopeId: e.projectId ?? ctx.workspaceId,
    projectId: e.projectId ?? null,
    actorUserId: ctx.actorUserId,
    clientSource: ctx.clientSource,
    beforeSnapshot: before,
    afterSnapshot: after,
    changedFields: changed,
    revertMode: e.revertMode ?? 'non_revertible',
    requestId: ctx.requestId ?? null,
  });
}

const displayOf = (row: Row) =>
  typeof row.name === 'string' ? row.name : typeof row.title === 'string' ? row.title : null;

function eventFor(
  table: PgTable,
  row: Row,
): Pick<EventSpec, 'entityType' | 'entityId' | 'projectId' | 'display'> {
  return {
    entityType: getTableName(table),
    entityId: row.id as string,
    projectId: (row.projectId as string | undefined) ?? null,
    display: displayOf(row),
  };
}

export async function insertRow<T extends TenantTable>(
  tx: Tx,
  ctx: ActorCtx,
  table: T,
  values: Omit<PgInsertValue<T>, 'workspaceId'>,
): Promise<InferSelectModel<T>> {
  const rows = (await tx
    .insert(table)
    .values({ ...values, workspaceId: ctx.workspaceId } as PgInsertValue<T>)
    .returning()) as Row[];
  const row = rows[0]!;
  await recordEvent(tx, ctx, {
    action: 'create',
    ...eventFor(table, row),
    after: snapshot(table, row),
  });
  return row as InferSelectModel<T>;
}

export interface UpdateOptions {
  /** optimistic concurrency: fail with RevConflictError if the row moved on */
  expectedRev?: number;
  action?: ActionKind;
  revertMode?: RevertMode;
}

export async function updateRow<T extends TenantTable>(
  tx: Tx,
  ctx: ActorCtx,
  table: T,
  id: string,
  patch: Omit<PgUpdateSetSource<T>, 'id' | 'workspaceId' | 'rev'>,
  opts: UpdateOptions = {},
): Promise<InferSelectModel<T>> {
  const found = (await tx
    .select()
    .from(table as PgTable)
    .where(eq(table.id, id))
    .for('update')) as Row[];
  const before = found[0];
  if (!before) throw new NotFoundError(`${getTableName(table)} ${id} not found`);
  if (opts.expectedRev !== undefined && before.rev !== opts.expectedRev)
    throw new RevConflictError(before.rev as number);
  const rows = (await tx
    .update(table)
    .set({ ...patch, rev: sql`${table.rev} + 1`, updatedAt: sql`now()` } as never)
    .where(eq(table.id, id))
    .returning()) as Row[];
  const after = rows[0]!;
  await recordEvent(tx, ctx, {
    action: opts.action ?? 'update',
    ...eventFor(table, after),
    before: snapshot(table, before),
    after: snapshot(table, after),
    revertMode: opts.revertMode ?? 'restore_before',
  });
  return after as InferSelectModel<T>;
}

export function softDelete<T extends TenantTable>(
  tx: Tx,
  ctx: ActorCtx,
  table: T,
  id: string,
  expectedRev?: number,
) {
  return updateRow(tx, ctx, table, id, { deletedAt: sql`now()` } as never, {
    expectedRev,
    action: 'soft_delete',
    revertMode: 'soft_undelete',
  });
}

export function restore<T extends TenantTable>(
  tx: Tx,
  ctx: ActorCtx,
  table: T,
  id: string,
  expectedRev?: number,
) {
  return updateRow(tx, ctx, table, id, { deletedAt: null } as never, {
    expectedRev,
    action: 'restore',
    revertMode: 'soft_undelete',
  });
}

/** Probes in this database without a matching event (same row, same transaction). */
export async function findUnmatchedProbes(
  tx: Tx,
): Promise<Array<{ table_name: string; row_id: string }>> {
  const r = await tx.execute<{ table_name: string; row_id: string }>(sql`
    select p.table_name, p.row_id from audit_probe p
    where not exists (select 1 from events e where e.entity_id = p.row_id and e.txid = p.txid)`);
  return r.rows;
}

/**
 * Creates a workspace with `userId` as its first member (app_create_workspace, which also enters it)
 * and records both rows. Returns the actor context for the rest of the transaction.
 */
export async function createWorkspace(
  tx: Tx,
  userId: string,
  w: { kind: 'personal' | 'organization'; slug: string; name: string },
  clientSource: ActorCtx['clientSource'] = 'api',
): Promise<ActorCtx> {
  const r = await tx.execute<{ id: string }>(
    sql`select app_create_workspace(${userId}::uuid, ${w.kind}, ${w.slug}, ${w.name}) as id`,
  );
  const ctx: ActorCtx = { workspaceId: r.rows[0]!.id, actorUserId: userId, clientSource };
  const [ws] = (await tx
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspaceId))) as Row[];
  const [member] = (await tx
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ctx.workspaceId))) as Row[];
  await recordEvent(tx, ctx, {
    action: 'create',
    ...eventFor(workspaces, ws!),
    after: snapshot(workspaces, ws!),
  });
  await recordEvent(tx, ctx, {
    action: 'create',
    ...eventFor(workspaceMembers, member!),
    after: snapshot(workspaceMembers, member!),
  });
  return ctx;
}
