// Accounts, sessions, roles, invitations and notifications (docs/06 §2.3, §2.8, §2.9, §10.1).
// Class A (global, authorised by user id): user_auth_tokens, refresh_tokens, ws_tickets,
// auth_rate_limits. Class B/C (workspace, FORCE RLS): roles, role_bindings, workspace_invitations,
// notifications.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { enumCheck, users, workspaceTable } from './tenant.ts';

const ts = () => timestamp({ withTimezone: true });

/** One-time codes by e-mail (06 §2.9): never stored in clear, at most 5 tries. */
export const userAuthTokens = pgTable(
  'user_auth_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** null for register codes: the account does not exist yet */
    userId: uuid().references(() => users.id),
    purpose: text().notNull(),
    salt: text().notNull(),
    emailHmac: text().notNull(),
    tokenHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: ts().notNull(),
    usedAt: ts(),
    revokedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [
    index('user_auth_tokens_lookup_idx').on(t.emailHmac, t.purpose, t.createdAt),
    enumCheck('user_auth_tokens_purpose_check', 'purpose', [
      'register_otp',
      'self_password_reset_otp',
      'admin_reset_link',
    ]),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    deviceId: text(),
    tokenHash: text().notNull().unique(),
    expiresAt: ts().notNull(),
    revokedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

/** 15-second one-time ticket for opening the WebSocket (06 §3.7); long tokens never go in URLs. */
export const wsTickets = pgTable('ws_tickets', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id),
  workspaceId: uuid().notNull(),
  channel: text().notNull().default('client'),
  tokenHash: text().notNull().unique(),
  expiresAt: ts().notNull(),
  usedAt: ts(),
});

/** Per hour and per key (IP, e-mail, account): login, codes, invitation codes (06 §2.9). */
export const authRateLimits = pgTable(
  'auth_rate_limits',
  {
    keyHash: text().notNull(),
    windowStart: ts().notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.keyHash, t.windowStart] })],
);

export const roles = workspaceTable(
  'roles',
  {
    /** built-in key (ws_owner …) or a custom key */
    key: text().notNull(),
    name: text(),
    isBuiltin: boolean().notNull().default(false),
    isOwner: boolean().notNull().default(false),
    permissions: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    uniqueIndex('roles_key')
      .on(t.workspaceId, t.key)
      .where(sql`deleted_at is null`),
  ],
  { definerAccess: true },
);

export const roleBindings = workspaceTable(
  'role_bindings',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    roleId: uuid(),
    permissionKey: text(),
    scopeType: text().notNull().default('workspace'),
    scopeId: uuid(),
    effect: text().notNull().default('allow'),
    expiresAt: ts(),
  },
  (t) => [
    index('role_bindings_user_idx').on(t.workspaceId, t.userId),
    enumCheck('role_bindings_scope_check', 'scope_type', [
      'workspace',
      'org_unit',
      'project',
      'ticket',
    ]),
    enumCheck('role_bindings_effect_check', 'effect', ['allow', 'deny']),
    sqlCheck('role_bindings_role_xor_key', '(role_id is null) <> (permission_key is null)'),
  ],
  { definerAccess: true },
);

export const workspaceInvitations = workspaceTable(
  'workspace_invitations',
  {
    invitedEmail: text(),
    tokenHash: text().notNull(),
    shortCodeHash: text().notNull(),
    presetRoleId: uuid().notNull(),
    presetProjectIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    expiresAt: ts().notNull(),
    acceptedAt: ts(),
    acceptedBy: uuid(),
    revokedAt: ts(),
  },
  (t) => [
    unique('workspace_invitations_token_key').on(t.tokenHash),
    unique('workspace_invitations_code_key').on(t.shortCodeHash),
    uniqueIndex('workspace_invitations_pending_email_key')
      .on(t.workspaceId, sql`lower(${t.invitedEmail})`)
      .where(sql`accepted_at is null and revoked_at is null and invited_email is not null`),
  ],
  { definerAccess: true },
);

export const notifications = workspaceTable(
  'notifications',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    eventType: text().notNull(),
    refType: text(),
    refId: uuid(),
    dedupeKey: text().notNull(),
    title: text().notNull(),
    body: text().notNull().default(''),
    link: text(),
    /** core: always pushed; plugin rules register their own */
    rule: text().notNull().default('core'),
    readAt: ts(),
  },
  (t) => [
    unique('notifications_dedupe_key').on(t.workspaceId, t.userId, t.dedupeKey),
    index('notifications_unread_idx')
      .on(t.workspaceId, t.userId)
      .where(sql`read_at is null`),
  ],
  { ownerColumn: 'user_id', definerAccess: true },
);

function sqlCheck(name: string, expr: string) {
  return check(name, sql.raw(expr));
}
