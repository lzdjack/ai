// Cross-tenant test generated from the system catalog (docs/06 §13.5, 07 §7.1).
// Every table with a workspace_id is found in pg_catalog — not from a hand-kept list — and for each
// one, acting in workspace A must not read, change, delete or create rows of workspace B; project
// tables must also hide rows of projects the actor cannot see.
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withWorkspaceTx, type Db } from '../../src/db/client.ts';
import { GLOBAL_TABLES, TENANT_TABLES } from '../../src/db/schema/tenant.ts';
import '../../src/db/security.ts';
import { createTestDb, type TestDb } from '../db.ts';
import { seedSpace, type Space } from '../fixtures.ts';

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  generated: boolean;
}

interface CatalogTable {
  name: string;
  wsColumn: string;
  hasProject: boolean;
  rls: boolean;
  force: boolean;
  policies: string[];
  columns: Column[];
  checks: string[];
}

let t: TestDb;
let db: Db;
let su: pg.Client;
let A: Space;
let B: Space;
let tables: CatalogTable[] = [];

async function catalog(): Promise<{ tenant: CatalogTable[]; others: string[] }> {
  const rel = await su.query<{ name: string; rls: boolean; force: boolean; has_ws: boolean }>(`
    select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped) as has_ws
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition`);
  const tenant: CatalogTable[] = [];
  const others: string[] = [];
  for (const r of rel.rows) {
    if (!r.has_ws && r.name !== 'workspaces') {
      others.push(r.name);
      continue;
    }
    const cols = await su.query<Column>(
      `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type, not a.attnotnull as nullable,
              a.atthasdef as "hasDefault", (a.attidentity <> '' or a.attgenerated <> '') as generated
       from pg_attribute a where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped order by a.attnum`,
      [r.name],
    );
    const pol = await su.query<{ policyname: string }>(
      'select policyname from pg_policies where tablename = $1',
      [r.name],
    );
    const chk = await su.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = $1::regclass and contype = 'c'`,
      [r.name],
    );
    tenant.push({
      name: r.name,
      wsColumn: r.name === 'workspaces' ? 'id' : 'workspace_id',
      hasProject: cols.rows.some((c) => c.name === 'project_id'),
      rls: r.rls,
      force: r.force,
      policies: pol.rows.map((p) => p.policyname),
      columns: cols.rows,
      checks: chk.rows.map((c) => c.def),
    });
  }
  return { tenant: tenant.sort((a, b) => a.name.localeCompare(b.name)), others };
}

/** A value satisfying NOT NULL and CHECK (… = ANY (ARRAY['x'::text, …])) for a synthetic row. */
function valueFor(table: CatalogTable, col: Column, space: Space): string | null {
  if (col.name === table.wsColumn) return space.workspaceId;
  if (col.name === 'project_id') return space.projectId;
  const allowed = table.checks
    .find((d) => d.includes(`(${col.name} = ANY`) || d.includes(`((${col.name})::text = ANY`))
    ?.match(/'([^']+)'/)?.[1];
  if (allowed) return allowed;
  if (col.type === 'uuid') return crypto.randomUUID();
  if (col.type.startsWith('timestamp')) return new Date().toISOString();
  if (col.type === 'jsonb' || col.type === 'json') return '{}';
  if (col.type === 'boolean') return 'false';
  if (/int|numeric/.test(col.type)) return '1';
  return 'x';
}

/** Makes sure every tenant table has at least one row in `space`, inserting a synthetic one if needed. */
async function ensureRow(table: CatalogTable, space: Space): Promise<void> {
  const has = await su.query(`select 1 from ${table.name} where ${table.wsColumn} = $1 limit 1`, [
    space.workspaceId,
  ]);
  if (has.rowCount) return;
  const cols = table.columns.filter(
    (c) => !c.generated && (!c.nullable || c.name === 'project_id') && !c.hasDefault,
  );
  const forced = table.columns.filter(
    (c) => c.name === table.wsColumn || (c.name === 'project_id' && c.hasDefault),
  );
  const all = [...new Map([...cols, ...forced].map((c) => [c.name, c])).values()];
  // superuser + replica role: no FK checks and no triggers, just a row to attack
  await su.query('set session_replication_role = replica');
  try {
    await su.query(
      `insert into ${table.name} (${all.map((c) => c.name).join(', ')}) values (${all.map((_, i) => `$${i + 1}`).join(', ')})`,
      all.map((c) => valueFor(table, c, space)),
    );
  } finally {
    await su.query('set session_replication_role = origin');
  }
}

const asA = <T>(fn: Parameters<typeof withWorkspaceTx<T>>[2]) =>
  withWorkspaceTx(db, { userId: A.userId, workspaceId: A.workspaceId }, fn);

async function attempt(fn: () => Promise<unknown>): Promise<{ rows?: number; error?: string }> {
  try {
    const r = (await fn()) as { rowCount?: number | null };
    return { rows: r?.rowCount ?? 0 };
  } catch (e) {
    return { error: String((e as { cause?: Error }).cause?.message ?? (e as Error).message) };
  }
}

beforeAll(async () => {
  t = await createTestDb();
  db = createDb(t.appUrl, { max: 4 });
  su = new pg.Client({ connectionString: t.superUrl });
  await su.connect();
  A = await seedSpace(db, 'tenant-a');
  B = await seedSpace(db, 'tenant-b');
  tables = (await catalog()).tenant;
  for (const table of tables) {
    await ensureRow(table, A);
    await ensureRow(table, B);
  }
}, 60_000);

afterAll(async () => {
  await su?.end();
  await db?.close();
  await t?.drop();
});

describe('越权测试（从系统表自动列出租户表）', () => {
  it('每张表要么是登记过的租户表，要么在全局表名单里；租户表都开了 RLS + FORCE + 策略', async () => {
    const { tenant, others } = await catalog();
    expect(others.filter((n) => !n.startsWith('__drizzle')).sort()).toEqual(
      [...GLOBAL_TABLES].sort(),
    );
    expect(tenant.map((x) => x.name)).toEqual(TENANT_TABLES.map((x) => x.name).sort());
    for (const x of tenant) {
      expect({
        table: x.name,
        rls: x.rls,
        force: x.force,
        policy: x.policies.includes('cc_tenant'),
      }).toEqual({
        table: x.name,
        rls: true,
        force: true,
        policy: true,
      });
    }
  });

  it('在 A 空间里读、改、删 B 的数据都碰不到，插入 B 的数据被拒绝', async () => {
    expect(tables.length).toBeGreaterThanOrEqual(12);
    const problems: string[] = [];
    for (const x of tables) {
      const ws = x.wsColumn;
      const read = await asA((tx) =>
        tx.execute(
          sql.raw(`select count(*)::int as n from ${x.name} where ${ws} = '${B.workspaceId}'`),
        ),
      );
      if ((read.rows[0] as { n: number }).n !== 0) problems.push(`${x.name}: A can read B`);

      const upd = await attempt(() =>
        asA((tx) =>
          tx.execute(
            sql.raw(`update ${x.name} set ${ws} = ${ws} where ${ws} = '${B.workspaceId}'`),
          ),
        ),
      );
      if (upd.rows) problems.push(`${x.name}: A updated ${upd.rows} rows of B`);
      const del = await attempt(() =>
        asA((tx) => tx.execute(sql.raw(`delete from ${x.name} where ${ws} = '${B.workspaceId}'`))),
      );
      if (del.rows) problems.push(`${x.name}: A deleted ${del.rows} rows of B`);

      // copy one of B's rows under a new id and try to insert it while acting in A
      const insertable = x.columns.filter((c) => !c.generated).map((c) => c.name);
      const src = await su.query(
        `select row_to_json(t) as r from ${x.name} t where ${ws} = $1 limit 1`,
        [B.workspaceId],
      );
      const row: Record<string, unknown> = {
        ...(src.rows[0].r as Record<string, unknown>),
        ...(x.columns.some((c) => c.name === 'id') && ws !== 'id'
          ? { id: crypto.randomUUID() }
          : {}),
      };
      if (ws === 'id') row.id = B.workspaceId;
      const ins = await attempt(() =>
        asA((tx) =>
          tx.execute(
            sql.raw(
              `insert into ${x.name} (${insertable.join(', ')}) select ${insertable.join(', ')} from json_populate_record(null::${x.name}, '${JSON.stringify(row).replace(/'/g, "''")}'::json)`,
            ),
          ),
        ),
      );
      if (!ins.error?.includes('row-level security') && !ins.error?.includes('permission denied'))
        problems.push(
          `${x.name}: insert of B's row was not refused by RLS (${ins.error ?? 'inserted'})`,
        );
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it('项目级表：看不到的项目里的行读不到', async () => {
    const projectTables = tables.filter((x) => x.hasProject);
    expect(projectTables.map((x) => x.name)).toEqual(
      expect.arrayContaining(['flow_instances', 'node_runs', 'events']),
    );
    for (const x of projectTables) {
      const count = (hide: boolean) =>
        asA(async (tx) => {
          if (hide) await tx.execute(sql`select set_config('app.visible_project_ids', '{}', true)`);
          const r = await tx.execute(
            sql.raw(`select count(*)::int as n from ${x.name} where project_id = '${A.projectId}'`),
          );
          return (r.rows[0] as { n: number }).n;
        });
      expect({
        table: x.name,
        visible: (await count(false)) > 0,
        hidden: await count(true),
      }).toEqual({
        table: x.name,
        visible: true,
        hidden: 0,
      });
    }
  });

  it('不是成员进不了空间', async () => {
    const r = await attempt(() =>
      withWorkspaceTx(db, { userId: A.userId, workspaceId: B.workspaceId }, async () => null),
    );
    expect(r.error).toContain('not an active member');
  });
});
