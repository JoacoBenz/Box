import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  tenantPrisma: () => ({
    delegaciones: { findMany: (...args: any[]) => mockFindMany(...args) },
  }),
}));

// Mock types to avoid import issues
vi.mock('@/types', () => ({}));

import { getRolesEfectivos } from '@/lib/delegaciones';

beforeEach(() => {
  mockFindMany.mockReset();
});

describe('getRolesEfectivos', () => {
  it('returns only base roles when no delegations exist', async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getRolesEfectivos(1, 1, ['solicitante']);
    expect(result.roles).toEqual(['solicitante']);
    expect(result.delegaciones).toHaveLength(0);
  });

  it('adds delegated role when delegation is active and within date range', async () => {
    mockFindMany.mockResolvedValue([
      { rol_delegado: 'director', delegante: { nombre: 'Director Test' } },
    ]);
    const result = await getRolesEfectivos(1, 1, ['solicitante']);
    expect(result.roles).toContain('director');
    expect(result.roles).toContain('solicitante');
    expect(result.delegaciones).toHaveLength(1);
    expect(result.delegaciones[0].deleganteNombre).toBe('Director Test');
  });

  it('deduplicates roles when base and delegated overlap', async () => {
    mockFindMany.mockResolvedValue([
      { rol_delegado: 'solicitante', delegante: { nombre: 'Someone' } },
    ]);
    const result = await getRolesEfectivos(1, 1, ['solicitante']);
    expect(result.roles.filter(r => r === 'solicitante')).toHaveLength(1);
  });

  it('handles multiple active delegations from different delegantes', async () => {
    mockFindMany.mockResolvedValue([
      { rol_delegado: 'director', delegante: { nombre: 'Dir A' } },
      { rol_delegado: 'tesoreria', delegante: { nombre: 'Dir B' } },
    ]);
    const result = await getRolesEfectivos(1, 1, ['solicitante']);
    expect(result.roles).toContain('director');
    expect(result.roles).toContain('tesoreria');
    expect(result.roles).toContain('solicitante');
    expect(result.delegaciones).toHaveLength(2);
  });

  it('query filters by activo=true and date range (DB handles filtering)', async () => {
    mockFindMany.mockResolvedValue([]);
    await getRolesEfectivos(1, 5, ['solicitante']);
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.delegado_id).toBe(5);
    expect(call.where.activo).toBe(true);
    expect(call.where.fecha_inicio).toBeDefined();
    expect(call.where.fecha_fin).toBeDefined();
  });
});
