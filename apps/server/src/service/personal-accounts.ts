// A person's own accounts on shared connectors (docs/06 §2.3 Plane B, §2.10 personal_exec; 01
// PC-第一次发布-配账号, 设置 → 我的账号): merging an MR with your own GitLab token, releasing with your
// own Apollo account. Stored as a scope='user' connector under the shared one, readable by nobody
// else, never inherited; only sealed to the release executor's key (release-step-service.ts).
import type { PersonalAccountRow, SavePersonalAccountRequest } from '@cloudcraft/core-protocol';
import { isReleaseProvider } from '@cloudcraft/core-protocol';
import { and, asc, eq, isNull, isNotNull } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.ts';
import { connectors, secretItems } from '../db/schema/index.ts';
import { insertRow, updateRow } from '../db/write.ts';
import { ApiFailure } from './errors.ts';
import { inWorkspace } from './iam-service.ts';
import { connectorOf } from './plugins.ts';
import { openSecret, sealSecret } from './secrets.ts';
import type { SourceSettings } from './source-service.ts';

/** The person's account under a shared connector, or null. */
export async function personalAccountOf(tx: Tx, parentConnectorId: string, userId: string) {
  const [row] = await tx
    .select({ c: connectors, secret: secretItems })
    .from(connectors)
    .innerJoin(secretItems, eq(secretItems.id, connectors.secretId))
    .where(
      and(
        eq(connectors.parentConnectorId, parentConnectorId),
        eq(connectors.ownerUserId, userId),
        eq(connectors.scope, 'user'),
        isNull(connectors.deletedAt),
      ),
    );
  return row && row.secret.ciphertext ? row : null;
}

export async function openPersonal(
  tx: Tx,
  s: SourceSettings,
  parentConnectorId: string,
  userId: string,
) {
  const row = await personalAccountOf(tx, parentConnectorId, userId);
  if (!row) return null;
  return {
    secretId: row.secret.id,
    keyEpoch: row.secret.keyEpoch,
    credential: openSecret(s.masterKey, {
      ciphertext: row.secret.ciphertext!,
      wrappedDek: row.secret.wrappedDek!,
    }),
  };
}

/** Shared connectors whose plugin takes personal accounts, with the caller's account if set up. */
export function listPersonalAccounts(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
): Promise<PersonalAccountRow[]> {
  return inWorkspace(db, userId, ws, async (tx) => {
    const shared = await tx
      .select()
      .from(connectors)
      .where(and(eq(connectors.scope, 'workspace'), isNull(connectors.deletedAt)))
      .orderBy(asc(connectors.createdAt));
    const mine = await tx
      .select({ c: connectors, hint: secretItems.hint })
      .from(connectors)
      .innerJoin(secretItems, eq(secretItems.id, connectors.secretId))
      .where(
        and(
          eq(connectors.ownerUserId, userId),
          isNotNull(connectors.parentConnectorId),
          isNull(connectors.deletedAt),
        ),
      );
    return shared.flatMap((c) => {
      const plugin = s.connectors.get(c.pluginId);
      if (!plugin?.manifest.personalAuthSchema) return [];
      const m = mine.find((x) => x.c.parentConnectorId === c.id);
      return [
        {
          connector_id: c.id,
          connector_name: c.name,
          plugin_id: c.pluginId,
          category: c.category,
          personal_auth_schema: plugin.manifest.personalAuthSchema,
          account: m
            ? {
                identity: (m.c.config as { identity?: string }).identity ?? null,
                hint: m.hint ? `•••• ${m.hint}` : '••••',
                updated_at: m.c.updatedAt.toISOString(),
              }
            : null,
        },
      ];
    });
  });
}

/** Verifies the account against the system first (01: 「登录成功 · 能发布」), then stores it sealed. */
export async function savePersonalAccount(
  db: Db,
  s: SourceSettings,
  userId: string,
  ws: string,
  connectorId: string,
  req: SavePersonalAccountRequest,
) {
  const parent = await inWorkspace(db, userId, ws, async (tx) => {
    const [c] = await tx
      .select()
      .from(connectors)
      .where(
        and(
          eq(connectors.id, connectorId),
          eq(connectors.scope, 'workspace'),
          isNull(connectors.deletedAt),
        ),
      );
    if (!c) throw new ApiFailure(404, 'connector.not_found');
    return c;
  });
  const plugin = connectorOf(s.connectors, parent.pluginId);
  if (!plugin.manifest.personalAuthSchema)
    throw new ApiFailure(400, 'account.not_supported', { plugin_id: plugin.manifest.id });
  const config = parent.config as Record<string, unknown>;
  // network outside any transaction
  const check = isReleaseProvider(plugin)
    ? await plugin.verifyPersonal(config, req.credential)
    : await plugin.verify(config, req.credential);
  if (!check.ok) throw new ApiFailure(400, 'account.verify_failed', { error_raw: check.error_raw });
  return inWorkspace(db, userId, ws, async (tx, ctx) => {
    const sealed = sealSecret(s.masterKey, req.credential);
    const old = await personalAccountOf(tx, connectorId, userId);
    if (old) {
      await updateRow(tx, ctx, secretItems, old.secret.id, {
        ciphertext: sealed.ciphertext,
        wrappedDek: sealed.wrappedDek,
        hint: sealed.hint,
        keyEpoch: old.secret.keyEpoch + 1,
      } as never);
      await updateRow(tx, ctx, connectors, old.c.id, {
        config: { identity: check.identity },
      } as never);
    } else {
      const secret = await insertRow(tx, ctx, secretItems, {
        credentialClass: 'personal_exec',
        ownerUserId: userId,
        ciphertext: sealed.ciphertext,
        wrappedDek: sealed.wrappedDek,
        hint: sealed.hint,
      });
      await insertRow(tx, ctx, connectors, {
        name: parent.name,
        pluginId: parent.pluginId,
        category: parent.category,
        // only who the account is; the base URL stays on the shared connector
        config: { identity: check.identity },
        credentialClass: 'personal_exec',
        scope: 'user',
        ownerUserId: userId,
        parentConnectorId: connectorId,
        secretId: secret.id,
      });
    }
    return { connector_id: connectorId, identity: check.identity, verify: check };
  });
}
