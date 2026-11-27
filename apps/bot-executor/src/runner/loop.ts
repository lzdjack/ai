// The executor's main loop (docs/06 §2.12, §5.3a, §5.8): heartbeat → renew held leases, take new
// steps for free slots → run each step → write back with lease token and fence. A write-back may hand
// over the flow's next sandbox step, which runs in the same slot (a segment stays on one runner and
// its workspace); when the segment ends, onSegmentEnd lets the executor drop the workspace. A lease
// reported lost aborts its step (its containers are killed); a refused write-back is dropped —
// another runner owns that step now.
import type { StepAssignment } from '@cloudcraft/core-protocol';
import { RunnerApiError, type RunnerCredentials, type RunnerTransport } from './transport.ts';

export interface StepResult {
  outcome: 'done' | 'failed';
  output: Record<string, unknown>;
  error?: string;
}

export type StepHandler = (step: StepAssignment, signal: AbortSignal) => Promise<StepResult>;

export interface RunnerLoop {
  /** resolves when the loop stopped and running steps settled */
  stop(): Promise<void>;
}

export function startRunnerLoop(o: {
  transport: RunnerTransport;
  creds: RunnerCredentials;
  slots: number;
  /** picks the handler for a step (by node kind and config); null fails the step */
  handlerFor: (step: StepAssignment) => StepHandler | null;
  /** the flow's segment left this runner (finished, failed over, or the lease was lost) */
  onSegmentEnd?: (step: StepAssignment) => void;
  log?: (msg: string) => void;
}): RunnerLoop {
  const log = o.log ?? (() => {});
  const active = new Map<string, { step: StepAssignment; abort: AbortController }>();
  /** running segments by their abort controller; a segment's entry in `active` moves step to step */
  const segments = new Map<AbortController, Promise<void>>();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let ticking: Promise<void> = Promise.resolve();

  /** Runs one step and writes it back; returns the next step of the segment, if one was handed over. */
  async function runOne(step: StepAssignment, abort: AbortController) {
    const handler = o.handlerFor(step);
    let result: StepResult;
    try {
      result = handler
        ? await handler(step, abort.signal)
        : { outcome: 'failed', output: {}, error: `no handler for ${step.node_kind}` };
    } catch (e) {
      result = { outcome: 'failed', output: {}, error: (e as Error).message.slice(0, 4000) };
    }
    if (abort.signal.aborted) return null;
    try {
      const r = await o.transport.completeRoundStep(o.creds, {
        work_item_id: step.work_item_id,
        lease_token: step.lease_token,
        fence: step.fence,
        ...result,
        take_next: !stopped,
      });
      log(`step ${step.node_key}#${step.attempt_no} ${result.outcome}`);
      return r.next ?? null;
    } catch (e) {
      if (e instanceof RunnerApiError && e.code === 'runner.lease_lost')
        log(`step ${step.node_key}#${step.attempt_no} result refused: lease lost`);
      else
        log(`step ${step.node_key}#${step.attempt_no} write-back failed: ${(e as Error).message}`);
      return null;
    }
  }

  /** A slot works through a segment: the first step, then each step the write-back hands over. */
  async function run(first: StepAssignment, abort: AbortController) {
    let step: StepAssignment | null = first;
    let last = first;
    while (step) {
      last = step;
      const next: StepAssignment | null = await runOne(step, abort);
      // the slot passes to the next step before the finished one leaves (no free slot in between)
      if (next) {
        log(`continuing with ${next.node_key}#${next.attempt_no} (fence ${next.fence})`);
        active.set(next.work_item_id, { step: next, abort });
      }
      active.delete(step.work_item_id);
      step = next;
    }
    o.onSegmentEnd?.(last);
  }

  async function tick(): Promise<number> {
    const r = await o.transport.heartbeatAndPoll(o.creds, {
      free_slots: stopped ? 0 : Math.max(0, o.slots - active.size),
      leases: [...active.values()].map((a) => ({
        work_item_id: a.step.work_item_id,
        lease_token: a.step.lease_token,
      })),
    });
    for (const id of r.lost) {
      const a = active.get(id);
      if (!a) continue;
      log(`lease lost for ${a.step.node_key}#${a.step.attempt_no}, stopping it`);
      a.abort.abort();
      active.delete(id);
      segments.delete(a.abort); // stopping does not wait for work that is no longer ours
    }
    for (const step of r.assigned) {
      log(`took ${step.node_key}#${step.attempt_no} (fence ${step.fence})`);
      const abort = new AbortController();
      active.set(step.work_item_id, { step, abort });
      segments.set(
        abort,
        run(step, abort).finally(() => segments.delete(abort)),
      );
    }
    return r.poll_ms;
  }

  // after stop() keep heartbeating (with no free slots) until running steps finish: drain mode
  const schedule = (ms: number) => {
    if (!stopped || segments.size > 0) timer = setTimeout(loop, ms);
  };
  function loop() {
    ticking = tick().then(schedule, (e: unknown) => {
      log(`heartbeat failed: ${(e as Error).message}`);
      schedule(5000);
    });
  }
  loop();

  return {
    async stop() {
      stopped = true;
      await Promise.all([...segments.values()]);
      clearTimeout(timer);
      await ticking;
    },
  };
}
