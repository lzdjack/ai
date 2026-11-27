import { describe, expect, it } from 'vitest';
import { sortApprovals } from '../pages/approvals/sort';
import type { Approval } from '../types';

const item = (id: string, submitted_at: string, amount: number) => ({ id, submitted_at, amount }) as Approval;
const list = [
  item('old', '2026-11-01T01:00:00.000Z', 30),
  item('new', '2026-11-20T01:00:00.000Z', 10),
  item('mid', '2026-11-10T01:00:00.000Z', 20),
];

describe('B001 提交时间排序', () => {
  it('倒序时最新的在前，正序时最早的在前；金额排序不受影响', () => {
    expect(sortApprovals(list, 'submitted_at', 'desc').map((a) => a.id)).toEqual(['new', 'mid', 'old']);
    expect(sortApprovals(list, 'submitted_at', 'asc').map((a) => a.id)).toEqual(['old', 'mid', 'new']);
    expect(sortApprovals(list, 'amount', 'asc').map((a) => a.id)).toEqual(['new', 'mid', 'old']);
  });
});
