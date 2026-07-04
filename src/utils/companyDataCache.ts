/** In-memory cache for company-scoped list reads (invalidated on writes). */
const TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

function cacheKey(companyId: string, collection: string): string {
  return `${companyId}:${collection}`;
}

export function getCachedList<T>(companyId: string, collection: string): T[] | null {
  const entry = store.get(cacheKey(companyId, collection));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    store.delete(cacheKey(companyId, collection));
    return null;
  }
  return entry.data as T[];
}

export function setCachedList<T>(companyId: string, collection: string, data: T[]): void {
  store.set(cacheKey(companyId, collection), { data, fetchedAt: Date.now() });
}

export function invalidateCollectionCache(companyId: string, collection: string): void {
  store.delete(cacheKey(companyId, collection));
}

export function invalidateCompanyCache(companyId: string): void {
  const prefix = `${companyId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCompanyDataCache(): void {
  store.clear();
}
