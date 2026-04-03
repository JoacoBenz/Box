import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {},
  tenantPrisma: () => ({
    centros_costo: { findFirst: (...args: any[]) => mockFindFirst(...args) },
    compras: { findMany: (...args: any[]) => mockFindMany(...args) },
  }),
}));

import { verificarPresupuesto } from '@/lib/budget-control';

beforeEach(() => {
  mockFindFirst.mockReset();
  mockFindMany.mockReset();
});

describe('verificarPresupuesto', () => {
  it('returns permitido true when centro_costo not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await verificarPresupuesto(1, 999, 1000);
    expect(result.permitido).toBe(true);
  });

  it('returns permitido true and correct status when under annual budget', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 100000, presupuesto_mensual: null });
    mockFindMany.mockResolvedValue([{ monto_total: 20000, fecha_compra: new Date() }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(false);
    expect(result.status.gastoAnual).toBe(20000);
  });

  it('sets excedido true when annual budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 50000, presupuesto_mensual: null });
    mockFindMany.mockResolvedValue([{ monto_total: 45000, fecha_compra: new Date() }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true); // warning only
  });

  it('sets excedido true when monthly budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: 10000 });
    mockFindMany.mockResolvedValue([{ monto_total: 8000, fecha_compra: new Date() }]);
    const result = await verificarPresupuesto(1, 1, 5000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true);
  });

  it('returns excedido false when no budget limits configured', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: null });
    mockFindMany.mockResolvedValue([]);
    const result = await verificarPresupuesto(1, 1, 99999);
    expect(result.status.excedido).toBe(false);
  });

  it('calculates alertaPorcentaje correctly', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 100000, presupuesto_mensual: null });
    mockFindMany.mockResolvedValue([{ monto_total: 60000, fecha_compra: new Date() }]);
    const result = await verificarPresupuesto(1, 1, 15000);
    expect(result.status.alertaPorcentaje).toBe(75); // (60000+15000)/100000 * 100
  });

  it('returns alertaPorcentaje 0 when no annual budget', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: null, presupuesto_mensual: 50000 });
    mockFindMany.mockResolvedValue([]);
    const result = await verificarPresupuesto(1, 1, 1000);
    expect(result.status.alertaPorcentaje).toBe(0);
  });

  it('always returns permitido true (warning-only mode)', async () => {
    mockFindFirst.mockResolvedValue({ nombre: 'CC1', presupuesto_anual: 1000, presupuesto_mensual: 500 });
    mockFindMany.mockResolvedValue([{ monto_total: 999, fecha_compra: new Date() }]);
    const result = await verificarPresupuesto(1, 1, 999999);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(true);
  });
});
