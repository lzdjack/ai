import type { Approval } from '../../types';

export type SortKey = 'submitted_at' | 'amount';
export type SortOrder = 'asc' | 'desc';

export function sortApprovals(list: Approval[], key: SortKey, order: SortOrder): Approval[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const compare = key === 'amount' ? a.amount - b.amount : a.submitted_at.localeCompare(b.submitted_at);
    return compare * dir;
  });
}
