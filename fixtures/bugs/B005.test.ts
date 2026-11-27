import { statusMeta } from '@demo/lib';
import { describe, expect, it } from 'vitest';
import { STATUS_FILTER_OPTIONS } from '../pages/approvals/filter';

describe('B005 已撤回状态', () => {
  it('标签是「已撤回」灰色，筛选项里有已撤回', () => {
    expect(statusMeta('withdrawn')).toEqual({ tone: 'neutral', label: '已撤回' });
    expect(statusMeta('withdrawn', 'en-US').label).toBe('Withdrawn');
    expect(statusMeta('rejected').label).toBe('已拒绝');
    expect(STATUS_FILTER_OPTIONS).toContain('withdrawn');
  });
});
