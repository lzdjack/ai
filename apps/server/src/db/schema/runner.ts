// Executors and their keys (docs/06 §2.3, §2.10, §5.3a). M1 builds both tables in full; the one
// built-in executor enrolls with a one-time token and gets a long-term secret. Key rotation,
// revocation and remote runners come with M3 and only add logic.
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { enumCheck, users, workspaceTable } from './tenant.ts';

const ts = () => timestamp({ withTimezone: true });

export const RUNNER_ROLES = ['bot', 'release'] as const;

export const runners = workspaceTable(
  'runners',
  {
    name: text().notNull(),
    /** required for personal runners (M3) */
    ownerUserId: uuid().references(() => users.id),
    scope: text().notNull().default('team'),
    networkZone: text(),
    networkProfileId: uuid(),
    /** which work it takes: bot (code sandbox) / release (release executor) */
    runnerRoles: text()
      .array()
      .notNull()
      .default(sql`'{bot}'::text[]`),
    priority: integer().notNull().default(0),
    /** finish what is running, take nothing new (06 §13.5 upgrades) */
    drainMode: boolean().notNull().default(false),
    /** pending: token issued, not enrolled yet. Online / offline is read from last_heartbeat_at */
    status: text().notNull().default('pending'),
    lastHeartbeatAt: ts(),
    /** sha256 of the one-time enrollment token (cc_run_live_*), valid 15 minutes */
    enrollTokenHash: text(),
    enrollExpiresAt: ts(),
    /** sha256 of the long-term secret the runner signs in with after enrolling */
    authTokenHash: text(),
  },
  () => [
    uniqueIndex('runners_enroll_token_key')
      .on(sql`enroll_token_hash`)
      .where(sql`enroll_token_hash is not null`),
    enumCheck('runners_scope_check', 'scope', ['personal', 'team', 'cloud']),
    enumCheck('runners_status_check', 'status', ['pending', 'online', 'revoked']),
  ],
  // the heartbeat column changes every few seconds, so no leak probe; enrolling and revoking still
  // go through updateRow and leave events
  { definerAccess: true, audit: false },
);

/** X25519 public keys; the private halves never leave the executor host (06 §2.10). */
export const runnerKeys = workspaceTable(
  'runner_keys',
  {
    runnerId: uuid().notNull(),
    keyRole: text().notNull(),
    publicKey: text().notNull(),
    keyFingerprint: text().notNull(),
    epoch: integer().notNull().default(1),
    status: text().notNull().default('active'),
    revokedAt: ts(),
    revokedReason: text(),
  },
  (t) => [
    foreignKey({
      name: 'runner_keys_runner_fk',
      columns: [t.workspaceId, t.runnerId],
      foreignColumns: [runners.workspaceId, runners.id],
    }),
    uniqueIndex('runner_keys_active_key')
      .on(t.runnerId, t.keyRole)
      .where(sql`status = 'active'`),
    enumCheck('runner_keys_role_check', 'key_role', ['bot_exec', 'release_exec']),
    enumCheck('runner_keys_status_check', 'status', ['active', 'draining', 'revoked']),
  ],
  { definerAccess: true },
);
