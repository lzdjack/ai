// Connectors, secrets and repositories (docs/06 §2.3 secret tables, §2.4, §2.10, §10.3).
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { runnerKeys, runners } from './runner.ts';
import { enumCheck, projectTable, users, workspaceTable } from './tenant.ts';

const ts = () => timestamp({ withTimezone: true });

/**
 * One secret, encrypted with its own data key; the data key is wrapped by the deployment's master key
 * (standard managed tier, 06 §2.10). `ciphertext` is cleared when the secret is revoked and purged.
 */
export const secretItems = workspaceTable(
  'secret_items',
  {
    credentialClass: text().notNull(),
    ownerUserId: uuid().references(() => users.id),
    ciphertext: text(),
    wrappedDek: text(),
    keyEpoch: integer().notNull().default(1),
    rotationState: text().notNull().default('clean'),
    /** last characters for display (•••• 91d0); never enough to use */
    hint: text().notNull().default(''),
  },
  () => [
    enumCheck('secret_items_class_check', 'credential_class', [
      'shared_readonly',
      'workspace_secret',
      'personal_exec',
      'llm_gateway',
    ]),
    enumCheck('secret_items_rotation_check', 'rotation_state', [
      'clean',
      'pending_dek_rotation',
      'exposed_needs_reissue',
      'revoked_purged',
    ]),
  ],
);

/** A secret sealed to one executor key; personal_exec can never be sealed to a bot_exec key. */
export const credentialEnvelopes = workspaceTable(
  'credential_envelopes',
  {
    secretId: uuid().notNull(),
    runnerKeyId: uuid().notNull(),
    secretClassSnap: text().notNull(),
    targetKeyRole: text().notNull(),
    envelope: jsonb().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'credential_envelopes_secret_fk',
      columns: [t.workspaceId, t.secretId],
      foreignColumns: [secretItems.workspaceId, secretItems.id],
    }),
    foreignKey({
      name: 'credential_envelopes_key_fk',
      columns: [t.workspaceId, t.runnerKeyId],
      foreignColumns: [runnerKeys.workspaceId, runnerKeys.id],
    }),
    unique('credential_envelopes_key').on(t.workspaceId, t.secretId, t.runnerKeyId),
    checkNot(
      'credential_envelopes_no_personal_to_bot',
      "secret_class_snap = 'personal_exec' and target_key_role = 'bot_exec'",
    ),
  ],
  { audit: false },
);

/** Every executor that ever received a secret (06 §2.10): what to re-issue when one is stolen. */
export const secretDeliveries = workspaceTable(
  'secret_deliveries',
  {
    secretId: uuid().notNull(),
    runnerId: uuid().notNull(),
    keyEpoch: integer().notNull(),
    lastDeliveredAt: ts().notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'secret_deliveries_runner_fk',
      columns: [t.workspaceId, t.runnerId],
      foreignColumns: [runners.workspaceId, runners.id],
    }),
    unique('secret_deliveries_key').on(t.workspaceId, t.secretId, t.runnerId),
  ],
  { audit: false },
);

export const connectors = workspaceTable(
  'connectors',
  {
    name: text().notNull(),
    pluginId: text().notNull(),
    category: text().notNull(),
    /** non-secret settings (base URL …), validated against the plugin's configSchema */
    config: jsonb().notNull().default({}),
    credentialClass: text().notNull().default('shared_readonly'),
    scope: text().notNull().default('workspace'),
    ownerUserId: uuid().references(() => users.id),
    status: text().notNull().default('enabled'),
    healthState: text().notNull().default('ok'),
    secretId: uuid(),
  },
  (t) => [
    foreignKey({
      name: 'connectors_secret_fk',
      columns: [t.workspaceId, t.secretId],
      foreignColumns: [secretItems.workspaceId, secretItems.id],
    }),
    enumCheck('connectors_scope_check', 'scope', ['workspace', 'user']),
    enumCheck('connectors_status_check', 'status', ['enabled', 'disabled']),
    checkNot(
      'connectors_personal_only_user',
      "credential_class = 'personal_exec' and scope <> 'user'",
    ),
  ],
);

export const repos = workspaceTable(
  'repos',
  {
    sourceType: text().notNull().default('connector'),
    connectorId: uuid(),
    remoteRepoId: text(),
    localPath: text(),
    /** group/name as the platform shows it */
    path: text().notNull(),
    cloneUrl: text().notNull(),
    accessMode: text().notNull().default('read_only'),
    defaultBranch: text().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'repos_connector_fk',
      columns: [t.workspaceId, t.connectorId],
      foreignColumns: [connectors.workspaceId, connectors.id],
    }),
    uniqueIndex('repos_remote_key')
      .on(t.workspaceId, t.connectorId, t.remoteRepoId)
      .where(sql`connector_id is not null and deleted_at is null`),
    enumCheck('repos_source_check', 'source_type', ['connector', 'local']),
    enumCheck('repos_access_check', 'access_mode', ['read_write', 'read_only']),
  ],
);

/**
 * A buildable target of a repository inside a project (06 §2.4). The probe's guess lives in
 * auto_detected_meta; values a person set live in manual_overrides (field → value) and win; the
 * effective settings are merged on read, never stored twice.
 */
export const repoTargets = projectTable(
  'repo_targets',
  {
    repoId: uuid().notNull(),
    packageDir: text().notNull().default('.'),
    autoDetectedMeta: jsonb(),
    manualOverrides: jsonb().notNull().default({}),
    probeState: text().notNull().default('pending'),
    probedAt: ts(),
    probeNotes: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
  },
  (t) => [
    foreignKey({
      name: 'repo_targets_repo_fk',
      columns: [t.workspaceId, t.repoId],
      foreignColumns: [repos.workspaceId, repos.id],
    }),
    uniqueIndex('repo_targets_key')
      .on(t.projectId, t.repoId, t.packageDir)
      .where(sql`deleted_at is null`),
    index('repo_targets_repo_idx').on(t.repoId),
    enumCheck('repo_targets_probe_check', 'probe_state', ['pending', 'done', 'failed']),
  ],
);

function checkNot(name: string, forbidden: string) {
  return check(name, sql.raw(`not (${forbidden})`));
}
