import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  INTERRUPTED,
  type RepoSpec,
  PLAN_SCHEMA_VERSION,
  advance,
  isActive,
  type Command,
  type FlowView,
  type NodeRunView,
  type Plan,
  type Signal,
} from './advance.ts';

const repo = (id: string): RepoSpec => ({
  id,
  name: id,
  clone_url: `http://git.test/${id}.git`,
  ref: 'main',
  build_command: 'pnpm build',
});

/** Applies commands in memory exactly as flow.ts does in the database. */
function apply(flow: FlowView, commands: Command[], nextId: () => string): FlowView {
  const runs = flow.nodeRuns.map((r) => ({ ...r }));
  let status = flow.status;
  for (const c of commands) {
    if (c.type === 'open_node')
      runs.push({
        id: nextId(),
        nodeKey: c.nodeKey,
        attemptNo: c.attemptNo,
        repoId: c.repoId,
        status: c.status,
      });
    if (c.type === 'close_node') {
      const r = runs.find((x) => x.id === c.nodeRunId)!;
      r.status = c.status;
      r.error = c.error ?? null;
    }
    if (c.type === 'finish_flow') status = c.status;
  }
  return { ...flow, status, nodeRuns: runs };
}

const planArb = fc
  .record({
    nodes: fc.array(
      fc.record({
        kind: fc.constantFrom('auto' as const, 'human' as const),
        perRepo: fc.boolean(),
        partial: fc.boolean(),
        onFail: fc.option(fc.record({ back: fc.nat(5), max: fc.integer({ min: 1, max: 3 }) })),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    repos: fc.integer({ min: 1, max: 3 }),
  })
  .map(({ nodes, repos }): Plan => ({
    plan_schema_version: PLAN_SCHEMA_VERSION,
    repos: Array.from({ length: repos }, (_, i) => repo(`repo${i}`)),
    nodes: nodes.map((n, i) => ({
      key: `n${i}`,
      kind: n.kind,
      ...(n.perRepo ? { per_repo: true } : {}),
      ...(n.partial ? { join: 'allow_partial_continue' as const } : {}),
      // on_fail may only point back (or to itself): only rework edges form cycles
      ...(n.onFail
        ? { on_fail: { rework_to: `n${n.onFail.back % (i + 1)}`, max_attempts: n.onFail.max } }
        : {}),
    })),
  }));

/** Finish signals mostly hit an active run (progress), sometimes any run (late / duplicate). */
const stepArb = fc.oneof(
  { weight: 1, arbitrary: fc.constant({ type: 'start' as const }) },
  { weight: 1, arbitrary: fc.constant({ type: 'cancel' as const }) },
  {
    weight: 2,
    arbitrary: fc.record({ type: fc.constant('rework' as const), node: fc.nat(6) }),
  },
  {
    weight: 10,
    arbitrary: fc.record({
      type: fc.constant('finish' as const),
      pick: fc.nat(20),
      anyRun: fc.boolean(),
      outcome: fc.constantFrom(
        'done' as const,
        'done' as const,
        'failed' as const,
        'interrupted' as const,
      ),
    }),
  },
);

type Step = typeof stepArb extends fc.Arbitrary<infer S> ? S : never;

function toSignal(step: Step, flow: FlowView): Signal {
  if (step.type === 'start' || step.type === 'cancel') return step;
  if (step.type === 'rework') return { type: 'rework', toNodeKey: `n${step.node}` };
  const pool = step.anyRun ? flow.nodeRuns : flow.nodeRuns.filter(isActive);
  const run = pool[step.pick % Math.max(pool.length, 1)];
  return { type: 'node_finished', nodeRunId: run?.id ?? 'bogus', outcome: step.outcome };
}

const group = (r: NodeRunView) => `${r.nodeKey}#${r.attemptNo}`;

describe('advance() 推进函数', () => {
  it('任意计划（扇出、自动打回）、任意信号序列（含打回、执行中断、迟到信号）下不变式都成立', () => {
    fc.assert(
      fc.property(planArb, fc.array(stepArb, { maxLength: 40 }), (plan, steps) => {
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
          // only one node attempt is active at a time, with one run per repo at most
          const active = flow.nodeRuns.filter(isActive);
          expect(new Set(active.map(group)).size).toBeLessThanOrEqual(1);
          expect(active.length).toBeLessThanOrEqual(plan.repos!.length);
          if (flow.status !== 'running') expect(active).toEqual([]);
          // attempts per node and repo are 1..n without gaps or duplicates
          const attempts = new Map<string, number[]>();
          for (const r of flow.nodeRuns) {
            const k = `${r.nodeKey}@${r.repoId}`;
            attempts.set(k, [...(attempts.get(k) ?? []), r.attemptNo]);
          }
          for (const a of attempts.values()) expect(a).toEqual(a.map((_, i) => i + 1));
          // every opened auto run got exactly one work item
          for (const c of commands.filter((c) => c.type === 'open_node'))
            expect(
              commands.filter(
                (w) =>
                  w.type === 'enqueue_work' &&
                  w.nodeKey === c.nodeKey &&
                  w.attemptNo === c.attemptNo &&
                  w.repoId === c.repoId,
              ),
            ).toHaveLength(c.nodeKind === 'auto' ? 1 : 0);
          // an interruption never routes on by itself: a person decides
          if (signal.type === 'node_finished' && signal.outcome === 'interrupted')
            expect(commands.filter((c) => c.type !== 'close_node')).toEqual([]);
          // automatic rework stops at max_attempts of the failing node
          if (signal.type === 'node_finished') {
            const run = flow.nodeRuns.find((r) => r.id === signal.nodeRunId);
            const onFail = plan.nodes.find((x) => x.key === run?.nodeKey)?.on_fail;
            if (
              onFail &&
              commands.some((c) => c.type === 'open_node' && c.nodeKey === onFail.rework_to)
            )
              expect(run!.attemptNo).toBeLessThan(onFail.max_attempts);
          }
          // never stuck: a running, started flow has an active run or waits on an interruption
          if (flow.status === 'running' && flow.nodeRuns.length > 0 && active.length === 0)
            expect(flow.nodeRuns.some((r) => r.error === INTERRUPTED)).toBe(true);
          // done means the last node's latest attempt joined successfully
          if (flow.status === 'done') {
            const last = plan.nodes.at(-1)!;
            const runs = flow.nodeRuns.filter((r) => r.nodeKey === last.key);
            const latest = runs.filter(
              (r) => r.attemptNo === Math.max(...runs.map((x) => x.attemptNo)),
            );
            const ok = latest.filter((r) => r.status === 'done').length;
            expect(ok === latest.length || (last.join === 'allow_partial_continue' && ok > 0)).toBe(
              true,
            );
          }
        }
      }),
      { numRuns: 1000 },
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

  it('三仓扇出一仓失败：等齐再判定，按 on_fail 回到中间节点重开，上一轮的迟到信号无效', () => {
    const plan: Plan = {
      plan_schema_version: PLAN_SCHEMA_VERSION,
      repos: ['a', 'b', 'c'].map(repo),
      nodes: [
        { key: 'prepare', kind: 'auto' },
        { key: 'fix', kind: 'auto' },
        {
          key: 'build',
          kind: 'auto',
          per_repo: true,
          on_fail: { rework_to: 'fix', max_attempts: 2 },
        },
        { key: 'review', kind: 'human' },
      ],
    };
    let n = 0;
    const nextId = () => `r${++n}`;
    const step = (s: Signal) => (flow = apply(flow, advance(flow, s), nextId));
    const finish = (
      key: string,
      attempt: number,
      repo: string | null,
      outcome: 'done' | 'failed',
    ) => {
      const r = flow.nodeRuns.find(
        (x) => x.nodeKey === key && x.attemptNo === attempt && x.repoId === repo,
      )!;
      step({ type: 'node_finished', nodeRunId: r.id, outcome });
      return r.id;
    };
    let flow: FlowView = { status: 'running', plan, nodeRuns: [] };
    step({ type: 'start' });
    finish('prepare', 1, null, 'done');
    finish('fix', 1, null, 'done');
    finish('build', 1, 'b', 'failed');
    finish('build', 1, 'a', 'done');
    // c still running: nothing decided yet
    expect(flow.nodeRuns.filter(isActive).map((r) => r.repoId)).toEqual(['c']);
    const lateC = finish('build', 1, 'c', 'done');
    // all joined, one failed: back to fix, attempt 2
    expect(flow.nodeRuns.filter(isActive).map((r) => [r.nodeKey, r.attemptNo])).toEqual([
      ['fix', 2],
    ]);
    expect(advance(flow, { type: 'node_finished', nodeRunId: lateC, outcome: 'failed' })).toEqual(
      [],
    );
    finish('fix', 2, null, 'done');
    for (const repo of ['a', 'b', 'c']) finish('build', 2, repo, 'done');
    expect(flow.nodeRuns.filter(isActive).map((r) => r.nodeKey)).toEqual(['review']);
  });
});
