import { describe, expect, it } from 'vitest';
import { translate } from '../i18n';
import { validateApproval } from '../pages/approvals/validate';

describe('B003 金额校验', () => {
  it('金额必须大于 0，英文界面的报错是英文', () => {
    const base = { title: '差旅', reason: '出差' };
    expect(validateApproval({ ...base, amount: 0 }).amount).toBe('form.amount.positive');
    expect(validateApproval({ ...base, amount: -1 }).amount).toBe('form.amount.positive');
    expect(validateApproval({ ...base, amount: 0.01 })).toEqual({});
    expect(translate('en-US', 'form.amount.positive')).toMatch(/greater than 0/i);
    expect(translate('zh-CN', 'form.amount.positive')).toBe('金额必须大于 0');
  });
});
