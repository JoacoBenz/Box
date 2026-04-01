interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const store = new Map<string, CacheEntry<any>>();

/**
 * Simple in-memory TTL cache.
 * Key should include tenantId for tenant isolation.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }

  const data = await fetcher();
  if (store.size >= MAX_CACHE_SIZE) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) store.delete(firstKey);
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

/**
 * Invalidate cache entries matching a prefix.
 * Call after mutations (e.g., after creating/updating areas).
 */
export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Invalidate all cache for a tenant.
 */
export function invalidateTenantCache(tenantId: number): void {
  invalidateCache(`t:${tenantId}:`);
}

// Periodic cleanup of expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) store.delete(key);
  }
}, 120_000); // every 2 minutes
