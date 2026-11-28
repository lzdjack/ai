// The client WebSocket (docs/06 §3.7): opened with a 15-second one-time ticket, bound to (user,
// workspace). The relay NOTIFYs `cc_change` with a workspace id after it numbered new changes; each
// connection of that workspace then reads the changes after its last sequence number inside the
// user's own RLS context, so a client only ever receives rows it could have queried. Reconnecting
// with `since` replays the gap; a gap beyond the window asks the client to reload (resync_required).
import type { WsEnvelope } from '@cloudcraft/core-protocol';
import { and, asc, eq, gt, max } from 'drizzle-orm';
import type pg from 'pg';
import { withWorkspaceTx, type Db } from '../db/client.ts';
import { changeStream, wsTickets } from '../db/schema/index.ts';
import { consumeWsTicket } from '../repo/account-repo.ts';
import { randomToken, sha256 } from '../service/auth-crypto.ts';
import { pgCode } from '../service/errors.ts';

export const RESYNC_WINDOW = 1000;
export const TICKET_SECONDS = 15;

interface Socket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'close', fn: () => void): unknown;
}

interface Conn {
  userId: string;
  workspaceId: string;
  last: number;
  socket: Socket;
  pumping: Promise<void>;
}

export interface Hub {
  issueTicket(userId: string, workspaceId: string): Promise<{ ticket: string; expires_in: number }>;
  /** returns false when the ticket is not valid (the caller closes the socket) */
  attach(socket: Socket, ticket: string, since: number | null): Promise<boolean>;
  close(): Promise<void>;
}

const env = (op: WsEnvelope['op'], data: unknown) =>
  JSON.stringify({ v: 1, op, ts: new Date().toISOString(), data });

export async function startHub(db: Db): Promise<Hub> {
  const conns = new Map<string, Set<Conn>>();
  const listener: pg.PoolClient = await db.pool.connect();
  await listener.query('listen cc_change');

  const pump = (c: Conn) => {
    c.pumping = c.pumping.then(async () => {
      try {
        const rows = await withWorkspaceTx(
          db,
          { userId: c.userId, workspaceId: c.workspaceId },
          (tx) =>
            tx
              .select()
              .from(changeStream)
              .where(gt(changeStream.streamSeq, c.last))
              .orderBy(asc(changeStream.streamSeq))
              .limit(500),
        );
        for (const r of rows) {
          c.last = r.streamSeq!;
          c.socket.send(
            env('change', {
              seq: r.streamSeq,
              entity: r.entity,
              entity_id: r.entityId,
              op: r.op,
              rev: r.entityRev,
              row: r.row,
            }),
          );
        }
        if (rows.length === 500) pump(c);
      } catch (e) {
        // no longer a member: cut the connection (06 §3.7 close 4003)
        if (pgCode(e) === '42501') c.socket.close(4003, 'membership ended');
      }
    });
  };

  listener.on('notification', (n) => {
    for (const c of conns.get(n.payload ?? '') ?? []) pump(c);
  });

  return {
    async issueTicket(userId, workspaceId) {
      // membership is checked here too, so a ticket is never issued for a foreign workspace
      await withWorkspaceTx(db, { userId, workspaceId }, async () => {});
      const ticket = randomToken(24);
      await db.orm.insert(wsTickets).values({
        userId,
        workspaceId,
        tokenHash: sha256(ticket),
        expiresAt: new Date(Date.now() + TICKET_SECONDS * 1000),
      });
      return { ticket, expires_in: TICKET_SECONDS };
    },

    async attach(socket, ticket, since) {
      const t = await consumeWsTicket(db.orm, sha256(ticket));
      if (!t) return false;
      const head = await withWorkspaceTx(
        db,
        { userId: t.user_id, workspaceId: t.workspace_id },
        (tx) =>
          tx
            .select({ seq: max(changeStream.streamSeq) })
            .from(changeStream)
            .where(and(eq(changeStream.workspaceId, t.workspace_id))),
      );
      const top = head[0]?.seq ?? 0;
      const c: Conn = {
        userId: t.user_id,
        workspaceId: t.workspace_id,
        last: top,
        socket,
        pumping: Promise.resolve(),
      };
      if (since !== null && top - since <= RESYNC_WINDOW) c.last = since;
      else if (since !== null) socket.send(env('resync_required', { from: since }));
      socket.send(env('hello', { workspace_id: t.workspace_id, seq: c.last }));
      const set = conns.get(c.workspaceId) ?? new Set();
      set.add(c);
      conns.set(c.workspaceId, set);
      socket.on('close', () => set.delete(c));
      if (c.last < top) pump(c);
      return true;
    },

    async close() {
      for (const set of conns.values())
        for (const c of set) c.socket.close(1001, 'server shutting down');
      conns.clear();
      await listener.query('unlisten cc_change').catch(() => {});
      listener.release();
    },
  };
}
