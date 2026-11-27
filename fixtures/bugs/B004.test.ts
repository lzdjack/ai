import { describe, expect, it } from 'vitest';
import { canWithdraw } from '../auth/permissions';
import type { Approval } from '../types';

const me = { id: 'u1', name: '张三' };
const approval = (applicant_id: string, status: Approval['status']) => ({ applicant_id, status }) as Approval;

describe('B004 撤回权限', () => {
  it('只有申请人本人能撤回审批中的单', () => {
    expect(canWithdraw(me, approval('u1', 'pending'))).toBe(true);
    expect(canWithdraw(me, approval('u2', 'pending'))).toBe(false);
    expect(canWithdraw(me, approval('u1', 'approved'))).toBe(false);
    expect(canWithdraw(me, approval('u1', 'withdrawn'))).toBe(false);
  });
});
