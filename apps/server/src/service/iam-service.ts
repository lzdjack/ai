// Workspaces, roles, invitations and notifications (docs/06 §2.3, §2.8, §3.7, §10.1). Every decision
// is a permission key evaluated over the user's bindings (Deny-Overrides); responses carry ActionGate
// so clients only show what the server would allow. No branch on a role name.
import {
  grants,
  type ActionGate,
  type CreateInvitationRequest,
  type InvitationPreview,
  type Notification,
  type WorkspaceDetail,
} from '@cloudcraft/core-protocol';
import crypto from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { withWorkspaceTx, type ActorCtx, type Db, type Tx } from '../db/client.ts';
import {
  notifications,
  roleBindings,
  roles,
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from '../db/schema/index.ts';
import { createWorkspace, insertRow, recordWritten, updateRow } from '../db/write.ts';
import {
  acceptInvitation as acceptRow,
  previewInvitation as previewRow,
} from '../repo/account-repo.ts';
import { limit, type AccountSettings } from './account-service.ts';
import { invitationHash, newShortCode, randomToken } from './auth-crypto.ts';
import { publish } from './changes.ts';
import { ApiFailure, pgCode } from './errors.ts';
import { tr } from './i18n.ts';

/** A user's transaction in a workspace; not being a member reads as "no such workspace". */
export async function inWorkspace<T>(
  db: Db,
  userId: string,
  workspaceId: string,
  fn: (tx: Tx, ctx: ActorCtx) => Promise<T>,
): Promise<T> {
  try {
    return await withWorkspaceTx(db, { userId, workspaceId, clientSource: 'pc_ui' }, fn);
  } catch (e) {
    if (pgCode(e) === '42501' || pgCode(e) === '22P02')
      throw new ApiFailure(404, 'workspace.not_found');
    throw e;
  }
}

/** Workspace-wide permissions of the acting user: allowed keys minus denied ones. */
export async function permissionsOf(tx: Tx, userId: string): Promise<Set<string>> {
  const rows = await tx
    .select({
      effect: roleBindings.effect,
      key: roleBindings.permissionKey,
      perms: roles.permissions,
    })
    .from(roleBindings)
    .leftJoin(roles, and(eq(roles.id, roleBindings.roleId), isNull(roles.deletedAt)))
    .where(
      and(
        eq(roleBindings.userId, userId),
        eq(roleBindings.scopeType, 'workspace'),
        isNull(roleBindings.deletedAt),
        sql`(${roleBindings.expiresAt} is null or ${roleBindings.expiresAt} > now())`,
      ),
    );
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const r of rows)
    for (const k of r.perms ?? (r.key ? [r.key] : [])) (r.effect === 'deny' ? deny : allow).add(k);
  for (const k of deny) allow.delete(k);
  return allow;
}

export function gate(perms: Set<string>, key: string): ActionGate {
  const allowed = grants(perms, key);
  return { visible: true, allowed, reason_code: allowed ? null : ('RBAC_DENIED' as const) };
}

function require(perms: Set<string>, key: string) {
  if (!grants(perms, key)) throw new ApiFailure(403, 'auth.forbidden', { permission: key });
}

export async function createOrgWorkspace(
  db: Db,
  userId: string,
  w: { name: string; slug: string },
) {
  try {
    return await db.orm.transaction(async (tx) => {
      const ctx = await createWorkspace(tx, userId, { kind: 'organization', ...w }, 'pc_ui');
      return { id: ctx.workspaceId };
    });
  } catch (e) {
    if (pgCode(e) === '23505') throw new ApiFailure(409, 'workspace.slug_taken');
    throw e;
  }
}

export function workspaceDetail(db: Db, userId: string, wsId: string): Promise<WorkspaceDetail> {
  return inWorkspace(db, userId, wsId, async (tx) => {
    const [w] = await tx.select().from(workspaces).where(eq(workspaces.id, wsId));
    const perms = await permissionsOf(tx, userId);
    return {
      id: w!.id,
      kind: w!.kind,
      name: w!.name,
      slug: w!.slug,
      permissions: [...perms].sort(),
      actions: {
        invite_members: gate(perms, 'core:members:invite'),
        manage_members: gate(perms, 'core:members:manage'),
        manage_roles: gate(perms, 'core:roles:manage'),
        create_project: gate(perms, 'core:projects:create'),
      },
    };
  });
}

export function listMembers(db: Db, userId: string, wsId: string) {
  return inWorkspace(db, userId, wsId, async (tx) => {
    require(await permissionsOf(tx, userId), 'core:members:view');
    const ms = await tx
      .select({
        m: workspaceMembers,
        u: { id: users.id, name: users.displayName, email: users.email },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(and(eq(workspaceMembers.status, 'active'), isNull(workspaceMembers.deletedAt)));
    const bs = await tx
      .select({ userId: roleBindings.userId, key: roles.key })
      .from(roleBindings)
      .innerJoin(roles, eq(roles.id, roleBindings.roleId))
      .where(and(isNull(roleBindings.deletedAt), eq(roleBindings.scopeType, 'workspace')));
    return ms.map(({ m, u }) => ({
      user_id: u.id,
      display_name: u.name,
      email: u.email,
      roles: bs.filter((b) => b.userId === u.id).map((b) => b.key),
      joined_at: m.createdAt.toISOString(),
    }));
  });
}

// ---------- invitations ----------

export function createInvitation(
  db: Db,
  s: AccountSettings,
  userId: string,
  wsId: string,
  req: CreateInvitationRequest,
) {
  return inWorkspace(db, userId, wsId, async (tx, ctx) => {
    const perms = await permissionsOf(tx, userId);
    require(perms, 'core:members:invite');
    const [role] = await tx
      .select()
      .from(roles)
      .where(and(eq(roles.key, req.role_key), isNull(roles.deletedAt)));
    if (!role) throw new ApiFailure(400, 'invitation.role_unknown');
    // no escalation (06 §2.3): never the owner role, never more than the inviter holds
    if (role.isOwner || role.permissions.some((k) => !grants(perms, k)))
      throw new ApiFailure(403, 'invitation.role_too_high');
    const visible = (
      await tx.execute<{ ids: string }>(
        sql`select current_setting('app.visible_project_ids', true) as ids`,
      )
    ).rows[0]!.ids;
    const projectIds = req.project_ids ?? [];
    if (projectIds.some((p) => !visible.includes(p)))
      throw new ApiFailure(403, 'invitation.project_not_visible');
    const token = randomToken(32);
    const code = newShortCode();
    const ttl = req.ttl_hours ?? 24;
    if (req.email)
      // a resend replaces the pending invitation for the same address
      await tx
        .update(workspaceInvitations)
        .set({ revokedAt: sql`now()`, rev: sql`${workspaceInvitations.rev} + 1` })
        .where(
          and(
            sql`lower(${workspaceInvitations.invitedEmail}) = lower(${req.email})`,
            isNull(workspaceInvitations.acceptedAt),
            isNull(workspaceInvitations.revokedAt),
          ),
        );
    const row = await insertRow(tx, ctx, workspaceInvitations, {
      invitedEmail: req.email ?? null,
      tokenHash: invitationHash(token),
      shortCodeHash: invitationHash(code),
      presetRoleId: role.id,
      presetProjectIds: projectIds,
      createdBy: userId,
      expiresAt: sql`now() + make_interval(hours => ${ttl})` as never,
    });
    return {
      id: row.id,
      token,
      short_code: code,
      link: `${s.publicUrl.replace(/\/$/, '')}/join/${token}`,
      expires_at: row.expiresAt.toISOString(),
    };
  });
}

export function listInvitations(db: Db, userId: string, wsId: string) {
  return inWorkspace(db, userId, wsId, async (tx) => {
    require(await permissionsOf(tx, userId), 'core:members:invite');
    const rows = await tx
      .select({ i: workspaceInvitations, role: roles.key, by: users.displayName })
      .from(workspaceInvitations)
      .innerJoin(roles, eq(roles.id, workspaceInvitations.presetRoleId))
      .innerJoin(users, eq(users.id, workspaceInvitations.createdBy))
      .where(
        and(
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(workspaceInvitations.createdAt));
    return rows.map(({ i, role, by }) => ({
      id: i.id,
      invited_email: i.invitedEmail,
      role_key: role,
      created_by: by,
      expires_at: i.expiresAt.toISOString(),
      rev: i.rev,
    }));
  });
}

export function revokeInvitation(db: Db, userId: string, wsId: string, id: string, rev?: number) {
  return inWorkspace(db, userId, wsId, async (tx, ctx) => {
    require(await permissionsOf(tx, userId), 'core:members:invite');
    await updateRow(tx, ctx, workspaceInvitations, id, { revokedAt: sql`now()` } as never, {
      expectedRev: rev,
    });
  });
}

export async function previewInvitation(
  db: Db,
  s: AccountSettings,
  input: string,
  ip: string,
): Promise<InvitationPreview> {
  await limit(db, s, 'invite', [`ip:${ip}`]);
  const r = await previewRow(db.orm, invitationHash(input));
  if (!r) throw new ApiFailure(404, 'invitation.not_found');
  return {
    workspace_name: r.workspace_name,
    workspace_kind: r.workspace_kind,
    owner_name: r.owner_name ?? '',
    inviter_name: r.inviter_name,
    role_key: r.role_key,
    expires_at: new Date(r.expires_at).toISOString(),
  };
}

/**
 * Joins the invitation's workspace with its preset role and projects, records what the definer
 * function wrote, and tells the members who manage members.
 */
export async function acceptInvitation(
  db: Db,
  s: AccountSettings,
  userId: string,
  input: string,
  ip: string,
) {
  await limit(db, s, 'invite', [`ip:${ip}`, `user:${userId}`]);
  try {
    return await db.orm.transaction(async (tx) => {
      const wsId = await acceptRow(tx, userId, invitationHash(input));
      const ctx: ActorCtx = { workspaceId: wsId, actorUserId: userId, clientSource: 'pc_ui' };
      const [member] = await tx
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, userId));
      await recordWritten(tx, ctx, workspaceMembers, member!);
      for (const b of await tx
        .select()
        .from(roleBindings)
        .where(and(eq(roleBindings.userId, userId), sql`${roleBindings.createdAt} = now()`)))
        await recordWritten(tx, ctx, roleBindings, b);
      const [inv] = await tx
        .select()
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.acceptedBy, userId),
            sql`${workspaceInvitations.acceptedAt} = now()`,
          ),
        );
      await recordWritten(tx, ctx, workspaceInvitations, inv!, 'update');
      const [me] = await tx.select().from(users).where(eq(users.id, userId));
      await publish(tx, ctx, {
        entity: 'member',
        entityId: userId,
        op: 'upsert',
        rev: member!.rev,
        row: { user_id: userId, display_name: me!.displayName },
      });
      for (const admin of await managers(tx, userId))
        await notify(tx, ctx, admin, {
          eventType: 'member_joined',
          dedupeKey: `member_joined:${userId}`,
          refType: 'user',
          refId: userId,
          title: tr('notify.member_joined.title', { name: me!.displayName }),
          body: tr('notify.member_joined.body', { name: me!.displayName }),
        });
      return wsId;
    });
  } catch (e) {
    if (pgCode(e) === 'P0002') throw new ApiFailure(404, 'invitation.not_found');
    if (pgCode(e) === '42501') throw new ApiFailure(403, 'invitation.email_mismatch');
    throw e;
  }
}

/** Members (other than `except`) whose workspace roles let them manage members. */
async function managers(tx: Tx, except: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ userId: roleBindings.userId })
    .from(roleBindings)
    .innerJoin(roles, eq(roles.id, roleBindings.roleId))
    .where(
      and(
        eq(roleBindings.scopeType, 'workspace'),
        eq(roleBindings.effect, 'allow'),
        isNull(roleBindings.deletedAt),
        sql`${roles.permissions} && array['core:*', 'core:members:manage']`,
      ),
    );
  return rows.map((r) => r.userId).filter((u) => u !== except);
}

// ---------- notifications ----------

const toWire = (n: typeof notifications.$inferSelect): Notification => ({
  id: n.id,
  event_type: n.eventType,
  title: n.title,
  body: n.body,
  link: n.link,
  read_at: n.readAt?.toISOString() ?? null,
  created_at: n.createdAt.toISOString(),
  rev: n.rev,
});

/** One notification per (user, dedupe key); pushed to that user only. */
export async function notify(
  tx: Tx,
  ctx: ActorCtx,
  userId: string,
  n: {
    eventType: string;
    dedupeKey: string;
    title: string;
    body?: string;
    link?: string;
    refType?: string;
    refId?: string;
  },
) {
  // the row may belong to someone else, whom RLS lets us write to but not read back: no RETURNING
  const row = {
    id: crypto.randomUUID(),
    workspaceId: ctx.workspaceId,
    userId,
    eventType: n.eventType,
    dedupeKey: n.dedupeKey,
    title: n.title,
    body: n.body ?? '',
    link: n.link ?? null,
    refType: n.refType ?? null,
    refId: n.refId ?? null,
    rule: 'core',
    readAt: null,
    rev: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const r = await tx.insert(notifications).values(row).onConflictDoNothing();
  if (!r.rowCount) return;
  await recordWritten(tx, ctx, notifications, row);
  await publish(tx, ctx, {
    entity: 'notification',
    entityId: row.id,
    op: 'upsert',
    rev: row.rev,
    row: toWire(row) as unknown as Record<string, unknown>,
    recipientUserId: userId,
  });
}

export function listNotifications(db: Db, userId: string, wsId: string) {
  return inWorkspace(db, userId, wsId, async (tx) => {
    const rows = await tx
      .select()
      .from(notifications)
      .where(isNull(notifications.deletedAt))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return { items: rows.map(toWire), next_cursor: null, has_more: false };
  });
}

/** Read on one device: every other device of the user gets the change and drops its unread mark. */
export function markNotificationRead(db: Db, userId: string, wsId: string, id: string) {
  return inWorkspace(db, userId, wsId, async (tx, ctx) => {
    const [n] = await tx.select().from(notifications).where(eq(notifications.id, id));
    if (!n) throw new ApiFailure(404, 'notification.not_found');
    if (n.readAt) return toWire(n);
    const row = await updateRow(tx, ctx, notifications, id, { readAt: sql`now()` } as never);
    await publish(tx, ctx, {
      entity: 'notification',
      entityId: id,
      op: 'upsert',
      rev: row.rev,
      row: toWire(row) as unknown as Record<string, unknown>,
      recipientUserId: userId,
    });
    return toWire(row);
  });
}
