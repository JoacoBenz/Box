import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, invalidateCache, invalidateTenantCache } from '@/lib/cache';

describe('cache', () => {
  // Use unique keys per test to avoid interference
  let keyCounter = 0;
  const uniqueKey = () => `test:cache:${++keyCounter}:${Date.now()}`;

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
      const result = await cached(key, 60_000, fetcher);
      expect(result).toBe('data');
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('refetches after TTL expires', async () => {
      const key = uniqueKey();
      const fetcher = vi.fn()
        .mockResolvedValueOnce('old')
        .mockResolvedValueOnce('new');

      await cached(key, 1, fetcher); // 1ms TTL
      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 10));
      const result = await cached(key, 1, fetcher);
      expect(result).toBe('new');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('caches different keys independently', async () => {
      const key1 = uniqueKey();
      const key2 = uniqueKey();
      const result1 = await cached(key1, 60_000, async () => 'value1');
      const result2 = await cached(key2, 60_000, async () => 'value2');
      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('caches complex objects', async () => {
      const key = uniqueKey();
      const data = { roles: ['admin', 'director'], delegaciones: [] };
      const result = await cached(key, 60_000, async () => data);
      expect(result).toEqual(data);
    });

    it('caches null values', async () => {
      const key = uniqueKey();
      const fetcher = vi.fn().mockResolvedValue(null);
      await cached(key, 60_000, fetcher);
      const result = await cached(key, 60_000, fetcher);
      expect(result).toBeNull();
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });

  describe('invalidateCache', () => {
    it('invalidates entries matching prefix', async () => {
      const prefix = `inv:${Date.now()}`;
      const key = `${prefix}:data`;
      const fetcher = vi.fn()
        .mockResolvedValueOnce('old')
        .mockResolvedValueOnce('new');

      await cached(key, 60_000, fetcher);
      invalidateCache(prefix);
      const result = await cached(key, 60_000, fetcher);
      expect(result).toBe('new');
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('does not invalidate entries with different prefix', async () => {
      const ts = Date.now();
      const key1 = `keep:${ts}:data`;
      const key2 = `remove:${ts}:data`;
      const fetcher1 = vi.fn().mockResolvedValue('kept');
      const fetcher2 = vi.fn()
        .mockResolvedValueOnce('old')
        .mockResolvedValueOnce('new');

      await cached(key1, 60_000, fetcher1);
      await cached(key2, 60_000, fetcher2);

      invalidateCache(`remove:${ts}`);

      const result1 = await cached(key1, 60_000, fetcher1);
      expect(result1).toBe('kept');
      expect(fetcher1).toHaveBeenCalledOnce(); // still cached

      const result2 = await cached(key2, 60_000, fetcher2);
      expect(result2).toBe('new');
      expect(fetcher2).toHaveBeenCalledTimes(2); // refetched
    });
  });

  describe('invalidateTenantCache', () => {
    it('invalidates all cache for a specific tenant', async () => {
      const ts = Date.now();
      const tenantId = 999;
      const key1 = `t:${tenantId}:roles:${ts}`;
      const key2 = `t:${tenantId}:config:${ts}`;
      const fetcher1 = vi.fn().mockResolvedValueOnce('r1').mockResolvedValueOnce('r2');
      const fetcher2 = vi.fn().mockResolvedValueOnce('c1').mockResolvedValueOnce('c2');

      await cached(key1, 60_000, fetcher1);
      await cached(key2, 60_000, fetcher2);

      invalidateTenantCache(tenantId);

      const r1 = await cached(key1, 60_000, fetcher1);
      const r2 = await cached(key2, 60_000, fetcher2);
      expect(r1).toBe('r2'); // refetched
      expect(r2).toBe('c2'); // refetched
    });

    it('does not invalidate other tenants', async () => {
      const ts = Date.now();
      const key1 = `t:100:data:${ts}`;
      const key2 = `t:200:data:${ts}`;
      const fetcher1 = vi.fn().mockResolvedValue('tenant100');
      const fetcher2 = vi.fn().mockResolvedValue('tenant200');

      await cached(key1, 60_000, fetcher1);
      await cached(key2, 60_000, fetcher2);

      invalidateTenantCache(100);

      await cached(key1, 60_000, fetcher1);
      expect(fetcher1).toHaveBeenCalledTimes(2); // refetched

      await cached(key2, 60_000, fetcher2);
      expect(fetcher2).toHaveBeenCalledOnce(); // still cached
    });
  });
});
