// Minimal client for `pi --mode rpc` over a child's stdio (JSONL; split on LF only, as the Pi
// docs require, because U+2028/U+2029 may appear inside JSON strings).
import type { Readable, Writable } from 'node:stream';

export interface PiEvent {
  type: string;
  [k: string]: unknown;
}

export interface PiResponse extends PiEvent {
  type: 'response';
  id?: string;
  command: string;
  success: boolean;
  error?: string;
  data?: unknown;
}

export class PiRpc {
  private buf = '';
  private seq = 0;
  private pending = new Map<string, (r: PiResponse) => void>();
  private listeners = new Set<(e: PiEvent) => void>();

  constructor(private io: { stdin: Writable; stdout: Readable }) {
    io.stdout.on('data', (chunk: Buffer) => this.feed(chunk.toString()));
  }

  private feed(text: string): void {
    this.buf += text;
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, nl).replace(/\r$/, '');
      this.buf = this.buf.slice(nl + 1);
      if (!line.trim()) continue;
      let rec: PiEvent;
      try {
        rec = JSON.parse(line) as PiEvent;
      } catch {
        continue;
      }
      const id = (rec as PiResponse).id;
      if (rec.type === 'response' && id && this.pending.has(id)) {
        this.pending.get(id)!(rec as PiResponse);
        this.pending.delete(id);
      }
      for (const l of this.listeners) l(rec);
    }
  }

  send(command: { type: string; [k: string]: unknown }): Promise<PiResponse> {
    const id = `cc-${++this.seq}`;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.io.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
    });
  }

  on(fn: (e: PiEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Resolves with the first record matching `pred`, or rejects after `timeoutMs`. */
  waitFor(pred: (e: PiEvent) => boolean, timeoutMs: number): Promise<PiEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      const off = this.on((e) => {
        if (!pred(e)) return;
        clearTimeout(timer);
        off();
        resolve(e);
      });
    });
  }

  /** Orderly shutdown: Pi exits after pending work once stdin closes. */
  close(): void {
    this.io.stdin.end();
  }
}
