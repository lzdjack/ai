// The executor's main loop (docs/06 §2.12, §5.3a, §5.8): heartbeat → renew held leases, take new
// steps for free slots → run each step → write back with lease token and fence. A lease reported
// lost aborts its step (its containers are killed); a refused write-back is dropped — another runner
// owns that step now.
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
  log?: (msg: string) => void;
}): RunnerLoop {
  const log = o.log ?? (() => {});
  const active = new Map<
    string,
    { step: StepAssignment; abort: AbortController; done: Promise<void> }
  >();
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let ticking: Promise<void> = Promise.resolve();

  async function run(step: StepAssignment, abort: AbortController) {
    const handler = o.handlerFor(step);
    let result: StepResult;
    try {
      result = handler
        ? await handler(step, abort.signal)
        : { outcome: 'failed', output: {}, error: `no handler for ${step.node_kind}` };
    } catch (e) {
      result = { outcome: 'failed', output: {}, error: (e as Error).message.slice(0, 4000) };
    }
    if (abort.signal.aborted) return;
    try {
      await o.transport.completeRoundStep(o.creds, {
        work_item_id: step.work_item_id,
        lease_token: step.lease_token,
        fence: step.fence,
        ...result,
      });
      log(`step ${step.node_key}#${step.attempt_no} ${result.outcome}`);
    } catch (e) {
      if (e instanceof RunnerApiError && e.code === 'runner.lease_lost')
        log(`step ${step.node_key}#${step.attempt_no} result refused: lease lost`);
      else
        log(`step ${step.node_key}#${step.attempt_no} write-back failed: ${(e as Error).message}`);
    }
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
    }
    for (const step of r.assigned) {
      log(`took ${step.node_key}#${step.attempt_no} (fence ${step.fence})`);
      const abort = new AbortController();
      const done = run(step, abort).finally(() => active.delete(step.work_item_id));
      active.set(step.work_item_id, { step, abort, done });
    }
    return r.poll_ms;
  }

  // after stop() keep heartbeating (with no free slots) until running steps finish: drain mode
  const schedule = (ms: number) => {
    if (!stopped || active.size > 0) timer = setTimeout(loop, ms);
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
      await Promise.all([...active.values()].map((a) => a.done));
      clearTimeout(timer);
      await ticking;
    },
  };
}
