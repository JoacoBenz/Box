import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  },
  tenantPrisma: () => ({
    centros_costo: { findFirst: (...args: any[]) => mockFindFirst(...args) },
  }),
}));

import { verificarPresupuesto } from '@/lib/budget-control';

beforeEach(() => {
  mockFindFirst.mockReset();
  mockQueryRaw.mockReset();
});

describe('verificarPresupuesto', () => {
  it('returns permitido true when centro_costo not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await verificarPresupuesto(1, 999, 1000);
    expect(result.permitido).toBe(true);
  });

  it('returns permitido true and correct status when under annual budget', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 100000, presupuesto_mensual: null });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 20000, gasto_mensual: 20000 }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(false);
    expect(result.status.gastoAnual).toBe(20000);
  });

  it('sets excedido true when annual budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 50000, presupuesto_mensual: null });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 45000, gasto_mensual: 45000 }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true); // warning only
  });

  it('sets excedido true when monthly budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: 10000 });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 8000, gasto_mensual: 8000 }]);
    const result = await verificarPresupuesto(1, 1, 5000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true);
  });

  it('returns excedido false when no budget limits configured', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: null });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 0, gasto_mensual: 0 }]);
    const result = await verificarPresupuesto(1, 1, 99999);
    expect(result.status.excedido).toBe(false);
  });

  it('calculates alertaPorcentaje correctly', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 100000, presupuesto_mensual: null });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 60000, gasto_mensual: 60000 }]);
    const result = await verificarPresupuesto(1, 1, 15000);
    expect(result.status.alertaPorcentaje).toBe(75); // (60000+15000)/100000 * 100
  });

  it('returns alertaPorcentaje 0 when no annual budget', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: 50000 });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 0, gasto_mensual: 0 }]);
    const result = await verificarPresupuesto(1, 1, 1000);
    expect(result.status.alertaPorcentaje).toBe(0);
  });

  it('always returns permitido true (warning-only mode)', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 1000, presupuesto_mensual: 500 });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 999, gasto_mensual: 999 }]);
    const result = await verificarPresupuesto(1, 1, 999999);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(true);
  });
});
