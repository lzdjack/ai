// Raw SQL of the account system (docs/06 §2.9, §10.1). Global (class A) tables need no workspace;
// the definer functions cross workspaces on the user's behalf.
import { sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.ts';

type Exec = Db['orm'] | Tx;

/** Counts one hit per key in this hour's window; returns the highest count among the keys. */
export async function hitRateLimit(db: Exec, keyHashes: string[]): Promise<number> {
  let max = 0;
  for (const k of keyHashes) {
    const r = await db.execute<{ count: number }>(sql`
      insert into auth_rate_limits (key_hash, window_start, count)
      values (${k}, date_trunc('hour', now()), 1)
      on conflict (key_hash, window_start) do update set count = auth_rate_limits.count + 1
      returning count`);
    max = Math.max(max, r.rows[0]!.count);
  }
  return max;
}

/**
 * Locks the newest live code for (email, purpose) and counts the try whatever the outcome, in one
 * statement (06 §2.9). The caller compares the hash and marks it used.
 */
export async function takeOtpAttempt(db: Exec, eHmac: string, purpose: string) {
  const r = await db.execute<{
    id: string;
    salt: string;
    token_hash: string;
    attempts: number;
  }>(sql`
    with t as (
      select id from user_auth_tokens
      where email_hmac = ${eHmac} and purpose = ${purpose}
        and used_at is null and revoked_at is null and expires_at > now()
      order by created_at desc limit 1 for update
    )
    update user_auth_tokens x set attempts = x.attempts + 1 from t where x.id = t.id
    returning x.id, x.salt, x.token_hash, x.attempts`);
  return r.rows[0] ?? null;
}

export async function myWorkspaces(db: Exec, userId: string) {
  const r = await db.execute<{
    id: string;
    kind: string;
    name: string;
    slug: string;
    unread: number;
  }>(sql`select * from app_my_workspaces(${userId}::uuid)`);
  return r.rows;
}

export async function previewInvitation(db: Exec, hash: string) {
  const r = await db.execute<{
    workspace_name: string;
    workspace_kind: string;
    owner_name: string | null;
    inviter_name: string;
    role_key: string;
    expires_at: Date;
  }>(sql`select * from app_preview_invitation(${hash})`);
  return r.rows[0] ?? null;
}

/** Joins the workspace of a live invitation and enters it; the caller records the events. */
export async function acceptInvitation(tx: Tx, userId: string, hash: string): Promise<string> {
  const r = await tx.execute<{ ws: string }>(
    sql`select app_accept_invitation(${userId}::uuid, ${hash}) as ws`,
  );
  return r.rows[0]!.ws;
}

/** One-time WebSocket ticket: valid once, for 15 seconds. */
export async function consumeWsTicket(db: Exec, tokenHash: string) {
  const r = await db.execute<{ user_id: string; workspace_id: string }>(sql`
    update ws_tickets set used_at = now()
    where token_hash = ${tokenHash} and used_at is null and expires_at > now()
    returning user_id, workspace_id`);
  return r.rows[0] ?? null;
}

/** Hands out sequence numbers to committed changes; returns the workspaces that got some. */
export async function assignStreamSeq(db: Exec, limit = 100): Promise<string[]> {
  const r = await db.execute<{ ws: string }>(sql`select sys_assign_stream_seq(${limit}) as ws`);
  return r.rows.map((x) => x.ws);
}
