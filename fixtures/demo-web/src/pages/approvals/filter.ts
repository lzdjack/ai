import type { ApprovalStatus } from '@demo/lib';
import type { Approval } from '../../types';

export type StatusFilter = 'all' | ApprovalStatus;

/** 列表筛选下拉的选项，顺序即显示顺序 */
export const STATUS_FILTER_OPTIONS: StatusFilter[] = ['all', 'pending', 'approved', 'rejected', 'withdrawn'];

export function filterApprovals(list: Approval[], opts: { status: StatusFilter; keyword: string }): Approval[] {
  const kw = opts.keyword.trim().toLowerCase();
  return list.filter(
    (a) =>
      (opts.status === 'all' || a.status === opts.status) &&
      (!kw || a.title.toLowerCase().includes(kw) || a.applicant_name.includes(kw)),
  );
}
