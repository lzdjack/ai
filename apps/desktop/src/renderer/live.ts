// Keeps the screens in step with the server (docs/06 §3.7): one WebSocket per workspace carries
// "this changed" and the screens that show it ask again. What a screen shows is computed for the
// caller (waiting on me, what I may press), so it is re-read rather than patched from the change.
// While the socket is down the screens fall back to asking on a timer.
import type { ChangeData, WsEnvelope } from '@cloudcraft/core-protocol';
import { useEffect, useMemo } from 'react';
import { streamUrl } from './api.ts';

const OFFLINE_MS = 4000;
/** Also asked this often while connected: settings edited elsewhere do not send a change. */
const SAFETY_MS = 60_000;
const RETRY_MAX_MS = 30_000;

export interface Live {
  /** Reads now, and again whenever `wants` matches or changes may have been missed. */
  follow(read: () => Promise<unknown>, wants: (c: ChangeData) => boolean): () => void;
}

/** any ticket of the workspace: the list and its counts */
export const aboutTickets = (c: ChangeData) => c.entity === 'ticket' || c.entity === 'node_run';
/** one ticket: its own row, or a step of one of its flows */
export const aboutTicket = (id: string) => (c: ChangeData) =>
  (c.entity === 'ticket' && c.entity_id === id) ||
  (c.entity === 'node_run' && c.row?.ticket_id === id);

/** One read at a time; whatever arrives during it makes one more, so the last answer is current. */
function oneAtATime(read: () => Promise<unknown>) {
  let busy = false;
  let again = false;
  return async () => {
    again = true;
    if (busy) return;
    busy = true;
    while (again) {
      again = false;
      // a failed read keeps what is on screen; the next change or timer asks again
      await read().catch(() => {});
    }
    busy = false;
  };
}

interface Watcher {
  run: () => unknown;
  wants: (c: ChangeData) => boolean;
}

export function useLive(workspaceId: string): Live {
  const watchers = useMemo(() => new Set<Watcher>(), []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closed = false;
    let online = false;
    let quiet = 0;
    let wait = 1000;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const all = () => {
      quiet = 0;
      for (const w of watchers) void w.run();
    };
    const later = () => {
      if (closed) return;
      retry = setTimeout(() => void open(), wait);
      wait = Math.min(wait * 2, RETRY_MAX_MS);
    };
    const open = async () => {
      try {
        const url = await streamUrl(workspaceId);
        if (closed) return;
        socket = new WebSocket(url);
        socket.onmessage = (e) => {
          const m = JSON.parse(String(e.data)) as WsEnvelope;
          if (m.op === 'change') {
            for (const w of watchers) if (w.wants(m.data)) void w.run();
          } else if (m.op === 'hello') {
            online = true;
            wait = 1000;
            // whatever happened before this connection
            all();
          } else if (m.op === 'resync_required') all();
        };
        socket.onclose = () => {
          online = false;
          later();
        };
      } catch {
        later();
      }
    };
    const timer = setInterval(() => {
      quiet += OFFLINE_MS;
      if (!online || quiet >= SAFETY_MS) all();
    }, OFFLINE_MS);
    void open();
    return () => {
      closed = true;
      clearInterval(timer);
      clearTimeout(retry);
      socket?.close();
    };
  }, [workspaceId, watchers]);

  return useMemo(
    () => ({
      follow(read, wants) {
        const w = { run: oneAtATime(read), wants };
        watchers.add(w);
        void w.run();
        return () => void watchers.delete(w);
      },
    }),
    [watchers],
  );
}
