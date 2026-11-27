import type { MessageKey } from '../../i18n/zh-CN';
import type { NewApproval } from '../../types';

export type FormErrors = Partial<Record<keyof NewApproval, MessageKey>>;

/** 发起审批表单校验；返回各字段的报错词条，空对象表示通过 */
export function validateApproval(v: Partial<NewApproval>): FormErrors {
  const errors: FormErrors = {};
  const title = v.title?.trim() ?? '';
  if (!title) errors.title = 'form.title.required';
  else if (title.length > 40) errors.title = 'form.title.too_long';
  if (typeof v.amount !== 'number' || Number.isNaN(v.amount)) errors.amount = 'form.amount.required';
  else if (v.amount <= 0) errors.amount = 'form.amount.positive';
  if (!v.reason?.trim()) errors.reason = 'form.reason.required';
  return errors;
}
