// Drives one AI node run on any engine (docs/06 §5.4, §11.2, §11.4): sends the task, enforces the
// circuit breakers (time, turns, the same tool call failing again and again), asks once more when
// the agent stops without calling a finishing tool, and stops the engine when the lease is lost.
// Only the generic contract is used: no branch on which engine this is.
import type {
  AgentEvent,
  AgentRunEnd,
  AgentRuntimePlugin,
  AgentStartContext,
  AgentStopReason,
} from '@cloudcraft/core-protocol';

export interface DriveLimits {
  timeoutMs: number;
  maxTurns: number;
  /** the same tool call (tool + arguments summary) failing this many times in a row */
  maxConsecutiveToolErrors: number;
}

/** 06 §5.4 defaults; a node's config overrides them */
export const DEFAULT_DRIVE_LIMITS: DriveLimits = {
  timeoutMs: 60 * 60_000,
  maxTurns: 150,
  maxConsecutiveToolErrors: 3,
};

/** after a stop is decided, how long the engine gets to wind down before it is closed */
const WIND_DOWN_MS = 15_000;

export const FOLLOW_UP =
  'You stopped without calling a finishing tool. Finish verifying, then call submit_delivery now. ' +
  'Do not end without calling it.';

export interface DriveResult {
  stop_reason: AgentStopReason;
  turns: number;
  tool_calls: number;
  tool_errors: number;
  follow_up_used: boolean;
  /** what the engine itself reported (the model proxy's count is the one billed) */
  engine_usage: { input: number; output: number; cache_read: number };
  error?: string;
}

export async function driveAgent(o: {
  runtime: AgentRuntimePlugin;
  ctx: AgentStartContext;
  task: string;
  /** true once a finishing tool was accepted by the host */
  finished: () => boolean;
  limits?: Partial<DriveLimits>;
  signal: AbortSignal;
  onEvent?: (e: AgentEvent) => void;
}): Promise<DriveResult> {
  const limits = { ...DEFAULT_DRIVE_LIMITS, ...o.limits };
  const r: DriveResult = {
    stop_reason: 'no_delivery',
    turns: 0,
    tool_calls: 0,
    tool_errors: 0,
    follow_up_used: false,
    engine_usage: { input: 0, output: 0, cache_read: 0 },
  };
  const session = await o.runtime.start(o.ctx);

  // set from event callbacks; read through state so the compiler does not narrow it to null
  const state: { stop: AgentStopReason | null } = { stop: null };
  let stopped!: () => void;
  const stoppedP = new Promise<void>((ok) => (stopped = ok));
  const halt = (reason: AgentStopReason) => {
    if (state.stop) return;
    state.stop = reason;
    stopped();
    void session.abort().catch(() => {});
  };

  const lastStart = new Map<string, string>();
  let failing = { key: '', count: 0 };
  session.on((e) => {
    o.onEvent?.(e);
    if (e.type === 'turn_end' && ++r.turns >= limits.maxTurns) halt('max_turns');
    if (e.type === 'tool_start') lastStart.set(e.tool, `${e.tool} ${e.summary}`);
    if (e.type === 'tool_end') {
      r.tool_calls += 1;
      const key = lastStart.get(e.tool) ?? e.tool;
      if (!e.is_error) failing = { key: '', count: 0 };
      else {
        r.tool_errors += 1;
        failing = { key, count: failing.key === key ? failing.count + 1 : 1 };
        if (failing.count >= limits.maxConsecutiveToolErrors) halt('tool_errors');
      }
    }
    if (e.type === 'usage') {
      r.engine_usage.input += e.input;
      r.engine_usage.output += e.output;
      r.engine_usage.cache_read += e.cache_read;
    }
  });
  const timer = setTimeout(() => halt('timeout'), limits.timeoutMs);
  const onAbort = () => halt('aborted');
  o.signal.addEventListener('abort', onAbort);
  if (o.signal.aborted) halt('aborted');

  // once a stop is decided, a run that does not wind down in time counts as aborted
  const run = (message: string): Promise<AgentRunEnd> =>
    Promise.race([
      session.run(message),
      stoppedP.then(
        () =>
          new Promise<AgentRunEnd>((ok) =>
            setTimeout(() => ok({ reason: 'aborted' }), WIND_DOWN_MS),
          ),
      ),
    ]);

  try {
    let end = state.stop ? null : await run(o.task);
    if (end && !state.stop && end.reason === 'crashed') {
      r.error = end.error;
      halt('engine_crashed');
    }
    if (!state.stop && !o.finished()) {
      r.follow_up_used = true;
      end = await run(FOLLOW_UP);
      if (!state.stop && end.reason === 'crashed') {
        r.error = end.error;
        halt('engine_crashed');
      }
    }
    r.stop_reason = state.stop ?? (o.finished() ? 'delivered' : 'no_delivery');
  } finally {
    clearTimeout(timer);
    o.signal.removeEventListener('abort', onAbort);
    await session.close().catch(() => {});
  }
  // a finishing tool accepted just before a breaker fired still counts
  if (r.stop_reason !== 'aborted' && o.finished()) r.stop_reason = 'delivered';
  return r;
}
