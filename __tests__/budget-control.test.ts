import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockAreasFindFirst = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  },
  tenantPrisma: () => ({
    centros_costo: { findFirst: (...args: any[]) => mockFindFirst(...args) },
    areas: { findFirst: (...args: any[]) => mockAreasFindFirst(...args) },
  }),
}));

import {
  verificarPresupuesto,
  verificarPresupuestoArea,
  verificarPresupuestoSolicitanteArea,
  getResumenPresupuesto,
} from '@/lib/budget-control';

beforeEach(() => {
  mockFindFirst.mockReset();
  mockAreasFindFirst.mockReset();
  mockQueryRaw.mockReset();
});

describe('verificarPresupuesto', () => {
  it('returns permitido true when centro_costo not found', async () => {
    mockFindFirst.mockResolvedValue(null);
    const result = await verificarPresupuesto(1, 999, 1000);
    expect(result.permitido).toBe(true);
  });

  it('returns permitido true and correct status when under annual budget', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: 100000,
      presupuesto_mensual: null,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 20000, gasto_mensual: 20000 }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(false);
    expect(result.status.gastoAnual).toBe(20000);
  });

  it('sets excedido true when annual budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: 50000,
      presupuesto_mensual: null,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 45000, gasto_mensual: 45000 }]);
    const result = await verificarPresupuesto(1, 1, 10000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true); // warning only
  });

  it('sets excedido true when monthly budget would be exceeded', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: null,
      presupuesto_mensual: 10000,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 8000, gasto_mensual: 8000 }]);
    const result = await verificarPresupuesto(1, 1, 5000);
    expect(result.status.excedido).toBe(true);
    expect(result.permitido).toBe(true);
  });

  it('returns excedido false when no budget limits configured', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: null,
      presupuesto_mensual: null,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 0, gasto_mensual: 0 }]);
    const result = await verificarPresupuesto(1, 1, 99999);
    expect(result.status.excedido).toBe(false);
  });

  it('calculates alertaPorcentaje correctly', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: 100000,
      presupuesto_mensual: null,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 60000, gasto_mensual: 60000 }]);
    const result = await verificarPresupuesto(1, 1, 15000);
    expect(result.status.alertaPorcentaje).toBe(75); // (60000+15000)/100000 * 100
  });

  it('returns alertaPorcentaje 0 when no annual budget', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: null,
      presupuesto_mensual: 50000,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 0, gasto_mensual: 0 }]);
    const result = await verificarPresupuesto(1, 1, 1000);
    expect(result.status.alertaPorcentaje).toBe(0);
  });

  it('always returns permitido true (warning-only mode)', async () => {
    mockFindFirst.mockResolvedValue({
      nombre: 'CC1',
      presupuesto_anual: 1000,
      presupuesto_mensual: 500,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 999, gasto_mensual: 999 }]);
    const result = await verificarPresupuesto(1, 1, 999999);
    expect(result.permitido).toBe(true);
    expect(result.status.excedido).toBe(true);
  });
});

describe('verificarPresupuestoArea', () => {
  it('permite cuando el área no existe', async () => {
    mockAreasFindFirst.mockResolvedValue(null);
    const result = await verificarPresupuestoArea(1, 99, 1000);
    expect(result.permitido).toBe(true);
  });

  it('permite cuando no hay presupuesto configurado', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Administración',
      presupuesto_anual: null,
      presupuesto_mensual: null,
    });
    const result = await verificarPresupuestoArea(1, 1, 50000);
    expect(result.permitido).toBe(true);
    expect(result.status.area).toBe('Administración');
    expect(result.status.excedidoAnual).toBe(false);
    expect(result.status.excedidoMensual).toBe(false);
  });

  it('permite cuando el gasto está dentro del presupuesto', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Ventas',
      presupuesto_anual: 1000000,
      presupuesto_mensual: 100000,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 200000, gasto_mensual: 30000 }]);

    const result = await verificarPresupuestoArea(1, 1, 50000);
    expect(result.permitido).toBe(true);
    expect(result.status.gastoAnual).toBe(200000);
    expect(result.status.gastoMensual).toBe(30000);
  });

  it('bloquea cuando excede presupuesto mensual', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Marketing',
      presupuesto_anual: 1000000,
      presupuesto_mensual: 100000,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 200000, gasto_mensual: 80000 }]);

    const result = await verificarPresupuestoArea(1, 1, 30000);
    expect(result.permitido).toBe(false);
    expect(result.status.excedidoMensual).toBe(true);
    expect(result.mensaje).toContain('mensual');
  });

  it('bloquea cuando excede presupuesto anual', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'IT',
      presupuesto_anual: 500000,
      presupuesto_mensual: null,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 480000, gasto_mensual: 0 }]);

    const result = await verificarPresupuestoArea(1, 1, 30000);
    expect(result.permitido).toBe(false);
    expect(result.status.excedidoAnual).toBe(true);
    expect(result.mensaje).toContain('anual');
  });

  it('bloquea con mensaje combinado cuando excede ambos presupuestos', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Compras',
      presupuesto_anual: 500000,
      presupuesto_mensual: 50000,
    });
    mockQueryRaw.mockResolvedValue([{ gasto_anual: 490000, gasto_mensual: 45000 }]);

    const result = await verificarPresupuestoArea(1, 1, 20000);
    expect(result.permitido).toBe(false);
    expect(result.status.excedidoAnual).toBe(true);
    expect(result.status.excedidoMensual).toBe(true);
    expect(result.mensaje).toContain('mensual');
    expect(result.mensaje).toContain('anual');
  });
});

describe('verificarPresupuestoSolicitanteArea', () => {
  it('permite cuando el área no existe', async () => {
    mockAreasFindFirst.mockResolvedValue(null);
    const result = await verificarPresupuestoSolicitanteArea(1, 99, 1000);
    expect(result.permitido).toBe(true);
  });

  it('permite cuando no hay presupuesto configurado', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Administración',
      presupuesto_anual: null,
      presupuesto_mensual: null,
    });
    const result = await verificarPresupuestoSolicitanteArea(1, 1, 50000);
    expect(result.permitido).toBe(true);
    expect(result.status.area).toBe('Administración');
    expect(result.status.excedidoAnual).toBe(false);
    expect(result.status.excedidoMensual).toBe(false);
  });

  it('bloquea cuando gasto real + comprometido + nuevo excede anual', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Ventas',
      presupuesto_anual: 150000,
      presupuesto_mensual: null,
    });
    // Real $50k + comprometido $80k + nuevo $30k = $160k > $150k → bloquea
    mockQueryRaw.mockResolvedValue([
      { real_anual: 50000, real_mensual: 0, comprometido_anual: 80000, comprometido_mensual: 0 },
    ]);
    const result = await verificarPresupuestoSolicitanteArea(1, 1, 30000);
    expect(result.permitido).toBe(false);
    expect(result.status.excedidoAnual).toBe(true);
    expect(result.mensaje).toContain('anual');
    expect(result.mensaje).toContain('solicitudes pendientes');
  });

  it('permite cuando gasto + comprometido + nuevo queda bajo el presupuesto', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Ventas',
      presupuesto_anual: 200000,
      presupuesto_mensual: null,
    });
    // Real $50k + comprometido $80k + nuevo $30k = $160k < $200k → permite
    mockQueryRaw.mockResolvedValue([
      { real_anual: 50000, real_mensual: 0, comprometido_anual: 80000, comprometido_mensual: 0 },
    ]);
    const result = await verificarPresupuestoSolicitanteArea(1, 1, 30000);
    expect(result.permitido).toBe(true);
    expect(result.status.gastoAnual).toBe(130000);
  });

  it('bloquea cuando excede solo el presupuesto mensual', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Marketing',
      presupuesto_anual: null,
      presupuesto_mensual: 50000,
    });
    mockQueryRaw.mockResolvedValue([
      { real_anual: 0, real_mensual: 20000, comprometido_anual: 0, comprometido_mensual: 25000 },
    ]);
    // Real $20k + comprometido $25k + nuevo $10k = $55k > $50k → bloquea
    const result = await verificarPresupuestoSolicitanteArea(1, 1, 10000);
    expect(result.permitido).toBe(false);
    expect(result.status.excedidoMensual).toBe(true);
    expect(result.mensaje).toContain('mensual');
  });

  it('reporta ambos excesos en el mensaje cuando excede anual y mensual', async () => {
    mockAreasFindFirst.mockResolvedValue({
      id: 1,
      nombre: 'Ops',
      presupuesto_anual: 100000,
      presupuesto_mensual: 50000,
    });
    mockQueryRaw.mockResolvedValue([
      {
        real_anual: 70000,
        real_mensual: 40000,
        comprometido_anual: 20000,
        comprometido_mensual: 5000,
      },
    ]);
    const result = await verificarPresupuestoSolicitanteArea(1, 1, 15000);
    expect(result.permitido).toBe(false);
    expect(result.mensaje).toContain('mensual');
    expect(result.mensaje).toContain('anual');
  });
});

describe('getResumenPresupuesto', () => {
  it('retorna resumen con porcentajes calculados', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        area_id: 1,
        area_nombre: 'Administración',
        presupuesto_mensual: 200000,
        presupuesto_anual: 2000000,
        gasto_mensual: 100000,
        gasto_anual: 800000,
      },
      {
        area_id: 2,
        area_nombre: 'Mantenimiento',
        presupuesto_mensual: null,
        presupuesto_anual: 500000,
        gasto_mensual: 0,
        gasto_anual: 250000,
      },
    ]);

    const result = await getResumenPresupuesto(1);
    expect(result).toHaveLength(2);

    expect(result[0].areaNombre).toBe('Administración');
    expect(result[0].porcentajeMensual).toBe(50);
    expect(result[0].porcentajeAnual).toBe(40);
    expect(result[0].disponibleMensual).toBe(100000);
    expect(result[0].disponibleAnual).toBe(1200000);

    expect(result[1].areaNombre).toBe('Mantenimiento');
    expect(result[1].presupuestoMensual).toBeNull();
    expect(result[1].porcentajeMensual).toBe(0);
    expect(result[1].porcentajeAnual).toBe(50);
    expect(result[1].disponibleAnual).toBe(250000);
  });

  it('retorna array vacío cuando no hay áreas', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await getResumenPresupuesto(1);
    expect(result).toEqual([]);
  });
});
