import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('@/lib/prisma', () => ({
  prisma: { log_auditoria: { create: (...args: any[]) => mockCreate(...args) } },
  tenantPrisma: () => ({}),
}));
vi.mock('@/lib/logger', () => ({
  logApiError: vi.fn(),
}));

import { getClientIp, registrarAuditoria } from '@/lib/audit';

describe('getClientIp', () => {
  it('returns first IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('trims whitespace from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' },
    });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip when x-forwarded-for absent', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('returns unknown when no IP headers present', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('registrarAuditoria', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const baseEntry = {
    tenantId: 1,
    usuarioId: 1,
    accion: 'crear_solicitud',
    entidad: 'solicitud',
    entidadId: 10,
    ipAddress: '1.2.3.4',
  };

  it('creates audit log entry with all fields', async () => {
    mockCreate.mockResolvedValue({});
    await registrarAuditoria({
      ...baseEntry,
      datosAnteriores: { old: 1 },
      datosNuevos: { new: 2 },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 1,
        usuario_id: 1,
        accion: 'crear_solicitud',
        entidad: 'solicitud',
        entidad_id: 10,
        datos_anteriores: { old: 1 },
        datos_nuevos: { new: 2 },
        ip_address: '1.2.3.4',
      }),
    });
  });

  it('omits datos_anteriores and datos_nuevos when undefined', async () => {
    mockCreate.mockResolvedValue({});
    await registrarAuditoria(baseEntry);
    const call = mockCreate.mock.calls[0][0];
    expect(call.data.datos_anteriores).toBeUndefined();
    expect(call.data.datos_nuevos).toBeUndefined();
  });

  it('swallows error for non-critical action', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(registrarAuditoria(baseEntry)).resolves.toBeUndefined();
  });

  it('throws error for critical action aprobar_solicitud', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(registrarAuditoria({ ...baseEntry, accion: 'aprobar_solicitud' })).rejects.toThrow(
      'critical action',
    );
  });

  it('throws error for critical action registrar_compra', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(registrarAuditoria({ ...baseEntry, accion: 'registrar_compra' })).rejects.toThrow(
      'critical action',
    );
  });

  it('throws error for critical action confirmar_recepcion', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(
      registrarAuditoria({ ...baseEntry, accion: 'confirmar_recepcion' }),
    ).rejects.toThrow('critical action');
  });

  it('throws error for critical action anular_solicitud', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'));
    await expect(registrarAuditoria({ ...baseEntry, accion: 'anular_solicitud' })).rejects.toThrow(
      'critical action',
    );
  });
});
