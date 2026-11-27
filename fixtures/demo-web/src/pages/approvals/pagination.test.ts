import { describe, expect, it } from 'vitest';
import { paginate } from './pagination';

describe('分页', () => {
  it('页码越界时收回到有效范围', () => {
    const list = Array.from({ length: 23 }, (_, i) => i);
    expect(paginate(list, 1, 10).items).toHaveLength(10);
    expect(paginate(list, 3, 10)).toMatchObject({ page: 3, pages: 3, total: 23, items: [20, 21, 22] });
    expect(paginate(list, 9, 10).page).toBe(3);
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, pages: 1, total: 0 });
  });
});
