import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: { configuracion: { findUnique: (...args: any[]) => mockFindUnique(...args) } },
  tenantPrisma: () => ({}),
}));

// Mock cache to pass through directly (no caching in tests)
vi.mock('@/lib/cache', () => ({
  cached: vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<any>) => fetcher()),
}));

import { getTenantConfig, getTenantConfigBool, getTenantConfigNumber } from '@/lib/tenant-config';

beforeEach(() => {
  mockFindUnique.mockReset();
});

describe('getTenantConfig', () => {
  it('returns valor when config exists', async () => {
    mockFindUnique.mockResolvedValue({ valor: 'test_value' });
    const result = await getTenantConfig(1, 'some_key');
    expect(result).toBe('test_value');
  });

  it('returns null when config not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await getTenantConfig(1, 'missing_key');
    expect(result).toBeNull();
  });
});

describe('getTenantConfigBool', () => {
  it('returns true for "true"', async () => {
    mockFindUnique.mockResolvedValue({ valor: 'true' });
    expect(await getTenantConfigBool(1, 'key', false)).toBe(true);
  });

  it('returns true for "1"', async () => {
    mockFindUnique.mockResolvedValue({ valor: '1' });
    expect(await getTenantConfigBool(1, 'key', false)).toBe(true);
  });

  it('returns false for "false"', async () => {
    mockFindUnique.mockResolvedValue({ valor: 'false' });
    expect(await getTenantConfigBool(1, 'key', true)).toBe(false);
  });

  it('returns defaultVal when config is null', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getTenantConfigBool(1, 'key', true)).toBe(true);
    expect(await getTenantConfigBool(1, 'key', false)).toBe(false);
  });
});

describe('getTenantConfigNumber', () => {
  it('returns parsed number for valid numeric string', async () => {
    mockFindUnique.mockResolvedValue({ valor: '42' });
    expect(await getTenantConfigNumber(1, 'key', 0)).toBe(42);
  });

  it('returns defaultVal for non-numeric string', async () => {
    mockFindUnique.mockResolvedValue({ valor: 'abc' });
    expect(await getTenantConfigNumber(1, 'key', 99)).toBe(99);
  });

  it('returns defaultVal when config is null', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getTenantConfigNumber(1, 'key', 55)).toBe(55);
  });
});
