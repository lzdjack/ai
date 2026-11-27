import type { Locale } from '../index';

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type StatusTone = 'info' | 'success' | 'danger' | 'neutral';

const META: Record<ApprovalStatus, { tone: StatusTone; label: Record<Locale, string> }> = {
  pending: { tone: 'info', label: { 'zh-CN': '审批中', 'en-US': 'Pending' } },
  approved: { tone: 'success', label: { 'zh-CN': '已通过', 'en-US': 'Approved' } },
  rejected: { tone: 'danger', label: { 'zh-CN': '已拒绝', 'en-US': 'Rejected' } },
  withdrawn: { tone: 'neutral', label: { 'zh-CN': '已撤回', 'en-US': 'Withdrawn' } },
};

export function statusMeta(status: ApprovalStatus, locale: Locale = 'zh-CN') {
  const m = META[status];
  return { tone: m.tone, label: m.label[locale] };
}
