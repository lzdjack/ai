// Table helper (docs/06 §2.1, §2.3, §13.4 step 1). Every tenant table is created through
// workspaceTable() / projectTable(), which add in one go:
//   id, workspace_id (+ project_id), rev, created_at, updated_at, deleted_at,
//   UNIQUE(workspace_id, id) as the target of composite foreign keys,
//   FK workspace_id → workspaces, composite FK (workspace_id, project_id) → projects,
// and register the table in TENANT_TABLES, from which the RLS policies, FORCE RLS, grants and
// audit probes are generated (security.ts). Tables not made here must be listed in GLOBAL_TABLES.
import { sql, type BuildExtraConfigColumns } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type PgColumnBuilderBase,
  type PgTableExtraConfigValue,
} from 'drizzle-orm/pg-core';

/**
 * workspace: rows belong to one workspace.
 * project:   rows also belong to one project; visible only if the project is visible.
 * mixed:     project_id is optional; rows with a project follow project visibility.
 */
export type TenantScope = 'workspace' | 'project' | 'mixed';

export interface TenantTableMeta {
  name: string;
  scope: TenantScope;
  /** column holding the workspace id (only `workspaces` itself differs: `id`) */
  workspaceColumn: string;
  /** business table: writes go through write.ts and must leave an event (audit probe trigger) */
  audit: boolean;
  /** the SECURITY DEFINER functions (owned by cc_migrator) need to read/write it across workspaces */
  definerAccess: boolean;
  /** append-only for the runtime account */
  appendOnly: boolean;
}

export const TENANT_TABLES: TenantTableMeta[] = [];

/** Tables without workspace_id, checked by the tenancy test so nothing slips through unlisted. */
export const GLOBAL_TABLES = ['users'] as const;

export interface TenantOptions {
  audit?: boolean;
  definerAccess?: boolean;
  appendOnly?: boolean;
}

const ts = () => timestamp({ withTimezone: true });
const enumCheck = (name: string, column: string, values: readonly string[]) =>
  check(name, sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(', ')})`));
export { enumCheck };

export function registerTenantTable(
  name: string,
  scope: TenantScope,
  o: TenantOptions,
  workspaceColumn = 'workspace_id',
) {
  TENANT_TABLES.push({
    name,
    scope,
    workspaceColumn,
    audit: o.audit ?? true,
    definerAccess: o.definerAccess ?? false,
    appendOnly: o.appendOnly ?? false,
  });
}

// Column builders are mutable, so every table gets fresh ones.
const audited = () => ({
  rev: integer().notNull().default(0),
  createdAt: ts().notNull().defaultNow(),
  updatedAt: ts().notNull().defaultNow(),
});

// ---------- global and root tables ----------

/** A global account (class A in 06 §2.3): no workspace, authorised by user id. P2 adds auth fields. */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    displayName: text().notNull(),
    status: text().notNull().default('active'),
    locale: varchar({ length: 16 }).notNull().default('zh-CN'),
    timezone: text().notNull().default('Asia/Shanghai'),
    isInstanceAdmin: boolean().notNull().default(false),
    ...audited(),
  },
  (t) => [
    uniqueIndex('users_email_lower_key').on(sql`lower(${t.email})`),
    enumCheck('users_status_check', 'status', ['active', 'disabled']),
  ],
);

/** The isolation boundary itself; its own id is the workspace id. */
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text().notNull(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    timezone: text().notNull().default('Asia/Shanghai'),
    organizationId: uuid(),
    ...audited(),
  },
  () => [enumCheck('workspaces_kind_check', 'kind', ['personal', 'organization'])],
);
registerTenantTable('workspaces', 'workspace', { definerAccess: true }, 'id');

// ---------- helper ----------

const tail = () => ({ ...audited(), deletedAt: ts() });
const wsBase = () => ({
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .references(() => workspaces.id),
});
const projectBase = () => ({ ...wsBase(), projectId: uuid().notNull() });
type Cols<B extends () => object, C> = ReturnType<B> & C & ReturnType<typeof tail>;
type ExtraFn<N extends string, C extends Record<string, PgColumnBuilderBase>> = (
  t: BuildExtraConfigColumns<N, C, 'pg'>,
) => PgTableExtraConfigValue[];

export function workspaceTable<
  TName extends string,
  TCols extends Record<string, PgColumnBuilderBase>,
>(
  name: TName,
  columns: TCols,
  extra: ExtraFn<TName, Cols<typeof wsBase, TCols>> = () => [],
  o: TenantOptions & { mixedProject?: boolean } = {},
) {
  registerTenantTable(name, o.mixedProject ? 'mixed' : 'workspace', o);
  const cols = { ...wsBase(), ...columns, ...tail() } as Cols<typeof wsBase, TCols>;
  return pgTable(name, cols, (t) => [
    unique(`${name}_ws_id_key`).on(t.workspaceId, t.id),
    ...extra(t),
  ]);
}

export const projects = workspaceTable(
  'projects',
  {
    name: text().notNull(),
    slug: text().notNull(),
    status: text().notNull().default('active'),
    defaultLocale: varchar({ length: 16 }).notNull().default('zh-CN'),
    riskRules: jsonb().notNull().default({}),
  },
  (t) => [
    uniqueIndex('projects_slug_key')
      .on(t.workspaceId, t.slug)
      .where(sql`deleted_at is null`),
    enumCheck('projects_status_check', 'status', ['active', 'archived']),
  ],
  { definerAccess: true },
);

export function projectTable<
  TName extends string,
  TCols extends Record<string, PgColumnBuilderBase>,
>(
  name: TName,
  columns: TCols,
  extra: ExtraFn<TName, Cols<typeof projectBase, TCols>> = () => [],
  o: TenantOptions = {},
) {
  registerTenantTable(name, 'project', o);
  const cols = { ...projectBase(), ...columns, ...tail() } as Cols<typeof projectBase, TCols>;
  return pgTable(name, cols, (t) => [
    unique(`${name}_ws_id_key`).on(t.workspaceId, t.id),
    foreignKey({
      name: `${name}_project_fk`,
      columns: [t.workspaceId, t.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
    }),
    ...extra(t),
  ]);
}
