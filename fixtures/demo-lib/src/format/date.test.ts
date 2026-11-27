import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './date';

describe('日期格式化', () => {
  it('按北京时间显示', () => {
    expect(formatDate('2026-11-26T17:30:00Z')).toBe('2026-11-27');
    expect(formatDateTime('2026-11-26T17:30:00Z')).toBe('2026-11-27 01:30');
    expect(formatDate('2026-11-26T17:30:00Z', 'en-US')).toBe('Nov 27, 2026');
  });
});
