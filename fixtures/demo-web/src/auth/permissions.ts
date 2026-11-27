import type { Approval, User } from '../types';

/** 只有申请人本人能撤回，而且只能撤回审批中的单 */
export function canWithdraw(user: User, approval: Approval): boolean {
  return approval.status === 'pending' && approval.applicant_id === user.id;
}
