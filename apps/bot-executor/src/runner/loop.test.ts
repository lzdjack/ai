import type {
  HeartbeatRequest,
  HeartbeatResponse,
  StepAssignment,
} from '@cloudcraft/core-protocol';
import { describe, expect, it } from 'vitest';
import { startRunnerLoop, type StepHandler } from './loop.ts';
import { RunnerApiError, type RunnerTransport } from './transport.ts';

const step = (id: string): StepAssignment => ({
  work_item_id: id,
  lease_token: `${id}-token`,
  fence: 1,
  lease_expires_at: new Date().toISOString(),
  flow_instance_id: 'f',
  node_run_id: `${id}-run`,
  node_key: 'trial_build',
  node_kind: 'deterministic_verify',
  attempt_no: 1,
  repo_id: null,
  config: { action: 'trial_build' },
  repos: [],
});

/** Scripted server: each heartbeat answers with the next response; records every call. */
function fakeTransport(
  responses: Partial<HeartbeatResponse>[],
  refuse = new Set<string>(),
  next = new Map<string, StepAssignment>(),
) {
  const heartbeats: HeartbeatRequest[] = [];
  const completed: string[] = [];
  const transport = {
    registerRunner: () => Promise.reject(new Error('not used')),
    heartbeatAndPoll: async (_c: unknown, req: HeartbeatRequest) => {
      heartbeats.push(req);
      return { lost: [], assigned: [], poll_ms: 10, ...responses.shift() };
    },
    completeRoundStep: async (_c: unknown, req: { work_item_id: string; take_next?: boolean }) => {
      if (refuse.has(req.work_item_id))
        throw new RunnerApiError(409, 'runner.lease_lost', 'lease lost');
      completed.push(req.work_item_id);
      const n = req.take_next ? next.get(req.work_item_id) : undefined;
      return { accepted: true, ...(n ? { next: n } : {}) };
    },
  } as unknown as RunnerTransport;
  return { transport, heartbeats, completed };
}

const until = async (fn: () => boolean) => {
  for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(fn()).toBe(true);
};

describe('执行器主循环', () => {
  it('按空闲槽领活，干活期间心跳带上租约续租；租约丢了就中止这一步、不写回', async () => {
    let release!: () => void;
    const aborted: string[] = [];
    const handler: StepHandler = (s, signal) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => aborted.push(s.work_item_id));
        if (s.work_item_id === 'b') release = () => resolve({ outcome: 'done', output: {} });
      });
    const fake = fakeTransport([{ assigned: [step('a'), step('b')] }, {}, { lost: ['a'] }]);
    const loop = startRunnerLoop({
      transport: fake.transport,
      creds: { runnerId: 'r', secret: 's' },
      slots: 2,
      handlerFor: () => handler,
    });
    await until(() => aborted.includes('a'));
    // while both run there is no free slot, and both leases are renewed
    expect(fake.heartbeats[1]).toEqual({
      free_slots: 0,
      leases: [
        { work_item_id: 'a', lease_token: 'a-token' },
        { work_item_id: 'b', lease_token: 'b-token' },
      ],
    });
    release();
    await until(() => fake.completed.includes('b'));
    await loop.stop();
    expect(fake.completed).toEqual(['b']);
  });

  it('写回被拒（租约已归别人）只记一笔，循环照常；停止时等跑着的步骤做完', async () => {
    const fake = fakeTransport([{ assigned: [step('x')] }], new Set(['x']));
    const logs: string[] = [];
    const loop = startRunnerLoop({
      transport: fake.transport,
      creds: { runnerId: 'r', secret: 's' },
      slots: 1,
      handlerFor: () => async () => ({ outcome: 'done', output: {} }),
      log: (m) => logs.push(m),
    });
    await until(() => logs.some((l) => l.includes('refused')));
    await until(() => fake.heartbeats.length > 3);
    await loop.stop();
    expect(fake.completed).toEqual([]);
  });

  it('写回带回同一流程的下一步：在同一个槽里接着做，中间不空出槽位；整段做完才通知收尾', async () => {
    const fake = fakeTransport(
      [{ assigned: [step('prep')] }],
      new Set(),
      new Map([
        ['prep', step('fix')],
        ['fix', step('verify')],
      ]),
    );
    const ran: string[] = [];
    const ended: string[] = [];
    const loop = startRunnerLoop({
      transport: fake.transport,
      creds: { runnerId: 'r', secret: 's' },
      slots: 1,
      handlerFor: () => async (s) => {
        ran.push(s.work_item_id);
        await new Promise((r) => setTimeout(r, 30));
        return { outcome: 'done', output: {} };
      },
      onSegmentEnd: (s) => ended.push(s.work_item_id),
      log: () => {},
    });
    await until(() => ended.length === 1);
    await loop.stop();
    expect(ran).toEqual(['prep', 'fix', 'verify']);
    expect(ended).toEqual(['verify']);
    // while the segment ran, every heartbeat saw the slot taken
    const during = fake.heartbeats.slice(1, -1);
    expect(during.every((h) => h.free_slots === 0)).toBe(true);
  });
});
