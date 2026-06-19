import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    areas: { findFirst: vi.fn() },
    notificaciones: { create: vi.fn(), createMany: vi.fn() },
    usuarios: { findMany: vi.fn() },
  } as Record<string, any>,
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ logNotificationError: vi.fn() }));

import { notificarResponsableArea } from '@/lib/notifications';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.notificaciones.create.mockResolvedValue({});
});

describe('notificarResponsableArea', () => {
  const baseOpts = {
    tenantId: 1,
    areaId: 10,
    tipo: 'solicitud_rechazada',
    titulo: 'Solicitud rechazada',
    mensaje: 'Fue rechazada',
    solicitudId: 100,
  };

  it('notifies the area responsable when found', async () => {
    mockPrisma.areas.findFirst.mockResolvedValue({ responsable_id: 5 });

    await notificarResponsableArea(baseOpts);

    expect(mockPrisma.areas.findFirst).toHaveBeenCalledWith({
      where: { id: 10, tenant_id: 1 },
      select: { responsable_id: true },
    });
    expect(mockPrisma.notificaciones.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuario_destino_id: 5,
        tipo: 'solicitud_rechazada',
        solicitud_id: 100,
      }),
    });
  });

  it('does nothing when area has no responsable', async () => {
    mockPrisma.areas.findFirst.mockResolvedValue({ responsable_id: null });

    await notificarResponsableArea(baseOpts);

    expect(mockPrisma.notificaciones.create).not.toHaveBeenCalled();
  });

  it('does nothing when area is not found', async () => {
    mockPrisma.areas.findFirst.mockResolvedValue(null);

    await notificarResponsableArea(baseOpts);

    expect(mockPrisma.notificaciones.create).not.toHaveBeenCalled();
  });

  it('skips notification when responsable is in excludeIds', async () => {
    mockPrisma.areas.findFirst.mockResolvedValue({ responsable_id: 5 });

    await notificarResponsableArea({ ...baseOpts, excludeIds: [5] });

    expect(mockPrisma.notificaciones.create).not.toHaveBeenCalled();
  });

  it('notifies when responsable is NOT in excludeIds', async () => {
    mockPrisma.areas.findFirst.mockResolvedValue({ responsable_id: 5 });

    await notificarResponsableArea({ ...baseOpts, excludeIds: [2, 3] });

    expect(mockPrisma.notificaciones.create).toHaveBeenCalledOnce();
  });
});
