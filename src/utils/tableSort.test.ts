import { describe, expect, it } from 'vitest';
import { compareSortValues, toggleTableSort } from './tableSort';

describe('tableSort', () => {
  it('compares numbers and strings with direction', () => {
    expect(compareSortValues(2, 10, 'asc')).toBeLessThan(0);
    expect(compareSortValues(2, 10, 'desc')).toBeGreaterThan(0);
    expect(compareSortValues('beta', 'Alpha', 'asc')).toBeGreaterThan(0);
  });

  it('toggles sort direction for the same column', () => {
    expect(toggleTableSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    });
    expect(toggleTableSort({ key: 'name', direction: 'desc' }, 'date')).toEqual({
      key: 'date',
      direction: 'asc',
    });
  });
});
