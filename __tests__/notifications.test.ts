import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockCreateMany = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificaciones: {
      create: (...args: any[]) => mockCreate(...args),
      createMany: (...args: any[]) => mockCreateMany(...args),
    },
    usuarios: { findMany: (...args: any[]) => mockFindMany(...args) },
  },
  tenantPrisma: () => ({}),
}));
vi.mock('@/lib/logger', () => ({
  logNotificationError: vi.fn(),
}));

import { crearNotificacion, notificarAdmins, notificarPorRol } from '@/lib/notifications';

beforeEach(() => {
  mockCreate.mockReset();
  mockCreateMany.mockReset();
  mockFindMany.mockReset();
});

describe('crearNotificacion', () => {
  it('creates a notification with correct fields', async () => {
    mockCreate.mockResolvedValue({});
    await crearNotificacion({
      tenantId: 1,
      destinatarioId: 2,
      tipo: 'test',
      titulo: 'Titulo',
      mensaje: 'Msg',
      solicitudId: 5,
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 1,
        usuario_destino_id: 2,
        tipo: 'test',
        titulo: 'Titulo',
        mensaje: 'Msg',
        solicitud_id: 5,
        leida: false,
      }),
    });
  });

  it('includes solicitudId when provided', async () => {
    mockCreate.mockResolvedValue({});
    await crearNotificacion({
      tenantId: 1,
      destinatarioId: 2,
      tipo: 'test',
      titulo: 'T',
      mensaje: 'M',
      solicitudId: 99,
    });
    expect(mockCreate.mock.calls[0][0].data.solicitud_id).toBe(99);
  });

  it('omits solicitud_id when not provided', async () => {
    mockCreate.mockResolvedValue({});
    await crearNotificacion({
      tenantId: 1,
      destinatarioId: 2,
      tipo: 'test',
      titulo: 'T',
      mensaje: 'M',
    });
    expect(mockCreate.mock.calls[0][0].data.solicitud_id).toBeUndefined();
  });

  it('swallows errors', async () => {
    mockCreate.mockRejectedValue(new Error('fail'));
    await expect(
      crearNotificacion({
        tenantId: 1,
        destinatarioId: 2,
        tipo: 'test',
        titulo: 'T',
        mensaje: 'M',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('notificarAdmins', () => {
  it('creates notifications for all active admin users', async () => {
    mockFindMany.mockResolvedValue([
      { id: 10, tenant_id: 0 },
      { id: 20, tenant_id: 0 },
    ]);
    mockCreateMany.mockResolvedValue({ count: 2 });
    await notificarAdmins('Titulo', 'Mensaje');
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ usuario_destino_id: 10, tipo: 'nueva_organizacion' }),
        expect.objectContaining({ usuario_destino_id: 20, tipo: 'nueva_organizacion' }),
      ]),
    });
  });

  it('returns early when no admins exist', async () => {
    mockFindMany.mockResolvedValue([]);
    await notificarAdmins('T', 'M');
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockFindMany.mockRejectedValue(new Error('fail'));
    await expect(notificarAdmins('T', 'M')).resolves.toBeUndefined();
  });
});

describe('notificarPorRol', () => {
  it('creates notifications for users with the given role', async () => {
    mockFindMany.mockResolvedValue([{ id: 5 }, { id: 6 }]);
    mockCreateMany.mockResolvedValue({ count: 2 });
    await notificarPorRol(1, 'director', 'Titulo', 'Msg', 10);
    expect(mockCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          usuario_destino_id: 5,
          tipo: 'notif_director',
          solicitud_id: 10,
        }),
        expect.objectContaining({
          usuario_destino_id: 6,
          tipo: 'notif_director',
          solicitud_id: 10,
        }),
      ]),
    });
  });

  it('includes users who also have admin role', async () => {
    mockFindMany.mockResolvedValue([]);
    await notificarPorRol(1, 'director', 'T', 'M');
    const call = mockFindMany.mock.calls[0][0];
    expect(call.where.usuarios_roles.some).toEqual({ rol: { nombre: 'director' } });
    expect(call.where.usuarios_roles.none).toBeUndefined();
  });

  it('returns early when no matching users', async () => {
    mockFindMany.mockResolvedValue([]);
    await notificarPorRol(1, 'director', 'T', 'M');
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('swallows errors', async () => {
    mockFindMany.mockRejectedValue(new Error('fail'));
    await expect(notificarPorRol(1, 'director', 'T', 'M')).resolves.toBeUndefined();
  });
});
