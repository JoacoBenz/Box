import { describe, it, expect, vi } from 'vitest';
import { cached, invalidateCache, invalidateTenantCache, _cleanupExpired } from '@/lib/cache';

describe('cache', () => {
  let keyCounter = 0;
  const uniqueKey = () => `test:cache:${++keyCounter}`;

  describe('cached', () => {
    it('calls fetcher on first access', async () => {
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValue('data');
      const result = await cached(key, 60_000, fetcher);
      expect(result).toBe('data');
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('returns cached value on second access', async () => {
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValue('data');
      await cached(key, 60_000, fetcher);
      expect(await cached(key, 60_000, fetcher)).toBe('data');
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('refetches after TTL expires', async () => {
      vi.useFakeTimers();
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');

      await cached(key, 5_000, fetcher);
      vi.advanceTimersByTime(5_001);
      expect(await cached(key, 5_000, fetcher)).toBe('new');
      expect(fetcher).toHaveBeenCalledTimes(2);
      vi.useRealTimers();
    });

    it('stays cached before TTL expires', async () => {
      vi.useFakeTimers();
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValue('data');
      await cached(key, 60_000, fetcher);
      vi.advanceTimersByTime(30_000);
      expect(await cached(key, 60_000, fetcher)).toBe('data');
      expect(fetcher).toHaveBeenCalledOnce();
      vi.useRealTimers();
    });

    it('caches different keys independently', async () => {
      expect(await cached(uniqueKey(), 60_000, async () => 'v1')).toBe('v1');
      expect(await cached(uniqueKey(), 60_000, async () => 'v2')).toBe('v2');
    });

    it('caches complex objects', async () => {
      const data = { roles: ['admin'], delegaciones: [] };
      expect(await cached(uniqueKey(), 60_000, async () => data)).toEqual(data);
    });

    it('caches null values', async () => {
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValue(null);
      await cached(key, 60_000, fetcher);
      expect(await cached(key, 60_000, fetcher)).toBeNull();
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });

  // ── Eviction at MAX_CACHE_SIZE (500) ──
  describe('eviction at max cache size', () => {
    it('evicts oldest entry when cache exceeds 500', async () => {
      for (let i = 0; i < 500; i++) {
        await cached(`evict:${i}`, 600_000, async () => `val-${i}`);
      }
      // 501st triggers eviction of first
      await cached('evict:overflow', 600_000, async () => 'new');

      const refetcher = vi.fn().mockResolvedValue('refetched');
      expect(await cached('evict:0', 600_000, refetcher)).toBe('refetched');
      expect(refetcher).toHaveBeenCalledOnce();

      for (let i = 0; i <= 500; i++) invalidateCache(`evict:${i}`);
      invalidateCache('evict:overflow');
    });
  });

  describe('invalidateCache', () => {
    it('invalidates entries matching prefix', async () => {
      const prefix = uniqueKey();
      const key = `${prefix}:data`;
      const fetcher = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');

      await cached(key, 60_000, fetcher);
      invalidateCache(prefix);
      expect(await cached(key, 60_000, fetcher)).toBe('new');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not invalidate entries with different prefix', async () => {
      const key1 = `keep:${uniqueKey()}`;
      const key2 = `remove:${uniqueKey()}`;
      const fetcher1 = vi.fn().mockResolvedValue('kept');

      await cached(key1, 60_000, fetcher1);
      await cached(key2, 60_000, async () => 'old');
      invalidateCache(key2);

      expect(await cached(key1, 60_000, fetcher1)).toBe('kept');
      expect(fetcher1).toHaveBeenCalledOnce();
    });
  });

  describe('invalidateTenantCache', () => {
    it('invalidates all cache for a specific tenant', async () => {
      const tenantId = 999;
      const key1 = `t:${tenantId}:roles:${uniqueKey()}`;
      const key2 = `t:${tenantId}:config:${uniqueKey()}`;
      const f1 = vi.fn().mockResolvedValueOnce('r1').mockResolvedValueOnce('r2');
      const f2 = vi.fn().mockResolvedValueOnce('c1').mockResolvedValueOnce('c2');

      await cached(key1, 60_000, f1);
      await cached(key2, 60_000, f2);
      invalidateTenantCache(tenantId);

      expect(await cached(key1, 60_000, f1)).toBe('r2');
      expect(await cached(key2, 60_000, f2)).toBe('c2');
    });

    it('does not invalidate other tenants', async () => {
      const key1 = `t:100:data:${uniqueKey()}`;
      const key2 = `t:200:data:${uniqueKey()}`;
      const f1 = vi.fn().mockResolvedValue('t100');
      const f2 = vi.fn().mockResolvedValue('t200');

      await cached(key1, 60_000, f1);
      await cached(key2, 60_000, f2);
      invalidateTenantCache(100);

      await cached(key1, 60_000, f1);
      expect(f1).toHaveBeenCalledTimes(2);
      await cached(key2, 60_000, f2);
      expect(f2).toHaveBeenCalledOnce();
    });
  });
});

// ── _cleanupExpired ──
describe('cache _cleanupExpired', () => {
  it('removes entries whose TTL has expired', async () => {
    vi.useFakeTimers();
    const key = 'cleanup-cache-expired';
    const fetcher = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');

    await cached(key, 1_000, fetcher); // 1s TTL
    vi.advanceTimersByTime(1_001);

    // Run cleanup — expired entry should be deleted
    _cleanupExpired();

    expect(await cached(key, 60_000, fetcher)).toBe('new');
    expect(fetcher).toHaveBeenCalledTimes(2);
    invalidateCache(key);
    vi.useRealTimers();
  });

  it('keeps entries whose TTL has NOT expired', async () => {
    vi.useFakeTimers();
    const key = 'cleanup-cache-keep';
    const fetcher = vi.fn().mockResolvedValue('data');

    await cached(key, 600_000, fetcher); // 10 min TTL
    vi.advanceTimersByTime(10_000); // only 10s

    _cleanupExpired();

    expect(await cached(key, 600_000, fetcher)).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
    invalidateCache(key);
    vi.useRealTimers();
  });

  it('handles empty store gracefully', () => {
    expect(() => _cleanupExpired()).not.toThrow();
  });
});
