// events: the immutable operation ledger (docs/06 §2.8, §2.11).
// Partitioned by month, so it is created by a hand-written migration (drizzle/0001_events.sql;
// drizzle-kit cannot create partitioned tables). This Drizzle definition is only for typed reads and writes and is kept out of
// the drizzle-kit schema. The runtime account may only INSERT and SELECT (security.ts).
import { sql } from 'drizzle-orm';
import {
  bigint,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { registerTenantTable } from './schema/tenant.ts';

const xid8 = customType<{ data: string }>({ dataType: () => 'xid8' });

export const EVENT_CATEGORIES = ['workflow', 'security_audit'] as const;
export const ACTION_KINDS = [
  'create',
  'update',
  'soft_delete',
  'restore',
  'version_switch',
  'revert_patch',
  'reorder',
  'bind_change',
] as const;
export const SCOPE_TYPES = ['workspace', 'project', 'org_unit', 'user'] as const;
export const CLIENT_SOURCES = [
  'pc_ui',
  'mobile_ui',
  'global_ai',
  'ticket_ai',
  'api',
  'system_sync',
] as const;
export const REVERT_MODES = [
  'soft_undelete',
  'version_pointer',
  'restore_before',
  'non_revertible',
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];
export type ClientSource = (typeof CLIENT_SOURCES)[number];
export type RevertMode = (typeof REVERT_MODES)[number];

export const events = pgTable('events', {
  id: uuid().notNull().defaultRandom(),
  seq: bigint({ mode: 'number' }).generatedAlwaysAsIdentity(),
  workspaceId: uuid().notNull(),
  eventCategory: text().notNull().default('workflow'),
  actionKind: text().notNull(),
  entityType: varchar({ length: 64 }).notNull(),
  entityId: uuid().notNull(),
  entityDisplay: text(),
  scopeType: text().notNull(),
  scopeId: uuid(),
  projectId: uuid(),
  ownerUserId: uuid(),
  actorUserId: uuid(),
  clientSource: text().notNull(),
  sensitivity: text().notNull().default('normal'),
  schemaVersion: integer().notNull().default(1),
  beforeSnapshot: jsonb(),
  afterSnapshot: jsonb(),
  changedFields: text().array(),
  revertMode: text().notNull().default('non_revertible'),
  revertBlockReason: text(),
  revertOfEventId: uuid(),
  batchOpId: uuid(),
  requestId: text(),
  txid: xid8()
    .notNull()
    .default(sql`pg_current_xact_id()`),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

registerTenantTable('events', 'mixed', { audit: false, appendOnly: true });
