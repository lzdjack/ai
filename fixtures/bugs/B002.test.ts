import { describe, expect, it } from 'vitest';
import { formatAmount } from '../format/amount';

describe('B002 金额千分位', () => {
  it('每三位一个逗号，负数和英文同样正确', () => {
    expect(formatAmount(1234567)).toBe('¥1,234,567.00');
    expect(formatAmount(-9876543.215)).toBe('-¥9,876,543.22');
    expect(formatAmount(1000000000, 'en-US')).toBe('CNY 1,000,000,000.00');
    expect(formatAmount(999.5)).toBe('¥999.50');
  });
});
