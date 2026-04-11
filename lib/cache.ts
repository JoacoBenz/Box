interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const store = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Simple in-memory TTL cache with request coalescing.
 * Key should include tenantId for tenant isolation.
 * Concurrent requests for the same key share one fetch (stampede protection).
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    // Update position for true LRU: delete and re-insert so it's "recently used"
    store.delete(key);
    store.set(key, entry);
    return entry.data;
  }

  // Coalesce concurrent requests for the same key
  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const promise = fetcher().then((data) => {
    if (store.size >= MAX_CACHE_SIZE) {
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) store.delete(firstKey);
    }
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }).finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
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

/** Remove expired entries from the cache. Runs automatically every 120 s. */
export function _cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) store.delete(key);
  }
}

// Periodic cleanup of expired entries
let _cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (!_cleanupTimer) {
  _cleanupTimer = setInterval(_cleanupExpired, 120_000);
}
