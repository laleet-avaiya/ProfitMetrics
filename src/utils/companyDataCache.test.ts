import { describe, expect, it } from 'vitest';
import {
  clearCompanyDataCache,
  getCachedList,
  invalidateCollectionCache,
  setCachedList,
} from './companyDataCache';

describe('companyDataCache', () => {
  it('returns cached lists within TTL', () => {
    setCachedList('co-1', 'sales', [{ id: 's1' }]);
    expect(getCachedList('co-1', 'sales')).toEqual([{ id: 's1' }]);
  });

  it('invalidates a collection', () => {
    setCachedList('co-1', 'sales', [{ id: 's1' }]);
    invalidateCollectionCache('co-1', 'sales');
    expect(getCachedList('co-1', 'sales')).toBeNull();
  });

  it('clears all entries', () => {
    setCachedList('co-1', 'sales', []);
    setCachedList('co-2', 'products', []);
    clearCompanyDataCache();
    expect(getCachedList('co-1', 'sales')).toBeNull();
    expect(getCachedList('co-2', 'products')).toBeNull();
  });
});
