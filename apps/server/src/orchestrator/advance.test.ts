import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  PLAN_SCHEMA_VERSION,
  advance,
  isActive,
  type Command,
  type FlowView,
  type Plan,
  type Signal,
} from './advance.ts';

/** Applies commands in memory exactly as flow.ts does in the database. */
function apply(flow: FlowView, commands: Command[], nextId: () => string): FlowView {
  const runs = flow.nodeRuns.map((r) => ({ ...r }));
  let status = flow.status;
  for (const c of commands) {
    if (c.type === 'open_node')
      runs.push({ id: nextId(), nodeKey: c.nodeKey, attemptNo: c.attemptNo, status: c.status });
    if (c.type === 'close_node') runs.find((r) => r.id === c.nodeRunId)!.status = c.status;
    if (c.type === 'finish_flow') status = c.status;
  }
  return { ...flow, status, nodeRuns: runs };
}

const planArb = fc
  .array(fc.constantFrom('auto' as const, 'human' as const), { minLength: 1, maxLength: 6 })
  .map((kinds): Plan => ({
    plan_schema_version: PLAN_SCHEMA_VERSION,
    nodes: kinds.map((kind, i) => ({ key: `n${i}`, kind })),
  }));

/** Signals refer to runs by index into the runs that exist at that moment (or to a bogus id). */
const stepArb = fc.oneof(
  fc.constant({ type: 'start' as const }),
  fc.constant({ type: 'cancel' as const }),
  fc.record({
    type: fc.constant('finish' as const),
    pick: fc.nat(10),
    outcome: fc.constantFrom('done' as const, 'failed' as const),
  }),
);

type Step = typeof stepArb extends fc.Arbitrary<infer S> ? S : never;

function toSignal(step: Step, flow: FlowView): Signal {
  if (step.type !== 'finish') return step;
  const run = flow.nodeRuns[step.pick];
  return { type: 'node_finished', nodeRunId: run?.id ?? 'bogus', outcome: step.outcome };
}

describe('advance() 推进函数', () => {
  it('任意计划、任意信号序列下不变式都成立', () => {
    fc.assert(
      fc.property(planArb, fc.array(stepArb, { maxLength: 25 }), (plan, steps) => {
        let n = 0;
        const nextId = () => `r${++n}`;
        let flow: FlowView = { status: 'running', plan, nodeRuns: [] };
        for (const step of steps) {
          const signal = toSignal(step, flow);
          const commands = advance(flow, signal);
          const terminalBefore = flow.status !== 'running';
          flow = apply(flow, commands, nextId);

          // finished flows ignore every signal
          if (terminalBefore) expect(commands).toEqual([]);
          // at most one active node; none once the flow is over
          const active = flow.nodeRuns.filter(isActive);
          expect(active.length).toBeLessThanOrEqual(1);
          if (flow.status !== 'running') expect(active).toEqual([]);
          // nodes open strictly in plan order, each once (no retries in plan v1)
          expect(flow.nodeRuns.map((r) => r.nodeKey)).toEqual(
            plan.nodes.slice(0, flow.nodeRuns.length).map((x) => x.key),
          );
          // every opened auto node got exactly one work item
          for (const c of commands.filter((c) => c.type === 'open_node'))
            expect(
              commands.filter((w) => w.type === 'enqueue_work' && w.nodeKey === c.nodeKey),
            ).toHaveLength(c.nodeKind === 'auto' ? 1 : 0);
          // outcome matches the node records
          if (flow.status === 'done') {
            expect(flow.nodeRuns).toHaveLength(plan.nodes.length);
            expect(flow.nodeRuns.every((r) => r.status === 'done')).toBe(true);
          }
          if (flow.status === 'failed') expect(flow.nodeRuns.at(-1)!.status).toBe('failed');
        }
      }),
      { numRuns: 500 },
    );
  });

  it('重复或过期的完成信号不产生任何命令', () => {
    const plan: Plan = {
      plan_schema_version: PLAN_SCHEMA_VERSION,
      nodes: [
        { key: 'fix', kind: 'auto' },
        { key: 'review', kind: 'human' },
      ],
    };
    let flow: FlowView = { status: 'running', plan, nodeRuns: [] };
    flow = apply(flow, advance(flow, { type: 'start' }), () => 'r1');
    const done: Signal = { type: 'node_finished', nodeRunId: 'r1', outcome: 'done' };
    flow = apply(flow, advance(flow, done), () => 'r2');
    expect(advance(flow, done)).toEqual([]);
    expect(advance(flow, { type: 'start' })).toEqual([]);
    expect(flow.nodeRuns.map((r) => [r.nodeKey, r.status])).toEqual([
      ['fix', 'done'],
      ['review', 'waiting_human'],
    ]);
  });
});
