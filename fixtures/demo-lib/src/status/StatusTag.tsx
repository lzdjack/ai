import type { Locale } from '../index';
import { statusMeta, type ApprovalStatus } from './status';

/** 审批状态标签；颜色由使用方按 demo-tag--<tone> 类名定义 */
export function StatusTag({ status, locale = 'zh-CN' }: { status: ApprovalStatus; locale?: Locale }) {
  const { tone, label } = statusMeta(status, locale);
  return <span className={`demo-tag demo-tag--${tone}`}>{label}</span>;
}
