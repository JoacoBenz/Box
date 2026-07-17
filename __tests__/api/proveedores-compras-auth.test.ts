import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/tenant-override', () => ({
  getEffectiveTenantId: vi.fn().mockRejectedValue(new Error('No autenticado')),
}));
vi.mock('@/lib/auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {}, tenantPrisma: vi.fn() }));

import { GET } from '@/app/api/proveedores/[id]/compras/route';

describe('GET /api/proveedores/[id]/compras', () => {
  it('returns 401 (not 500) when unauthenticated', async () => {
    const res = await GET(new Request('http://localhost/api/proveedores/1/compras'), {
      params: Promise.resolve({ id: '1' }),
    });
    expect(res.status).toBe(401);
  });
});
