import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockAudit, mockNotifications } = vi.hoisted(() => {
  // Una única instancia que actúa como tx dentro de $transaction y como
  // prisma de primer nivel. Así no hay que duplicar el mock.
  const instance = {
    registros_pendientes: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    usuarios: {
      findFirst: vi.fn(),
    },
    roles: {
      findMany: vi.fn(),
    },
    planes: {
      findUnique: vi.fn(),
    },
    tenants: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    areas: {
      create: vi.fn(),
      update: vi.fn(),
    },
    configuracion: {
      createMany: vi.fn(),
    },
    usuarios_roles: {
      createMany: vi.fn(),
    },
    suscripciones: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as Record<string, any>;

  // tx === instance — el handler usa `tx.tenants.create`, `tx.areas.create`,
  // etc., así que mockeamos $transaction para que pase el mismo objeto.
  instance.$transaction.mockImplementation(async (fn: any) => fn(instance));

  return {
    mockPrisma: instance,
    mockAudit: {
      registrarAuditoria: vi.fn().mockResolvedValue(undefined),
      getClientIp: vi.fn(() => '1.2.3.4'),
    },
    mockNotifications: {
      notificarAdmins: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/audit', () => mockAudit);
vi.mock('@/lib/notifications', () => mockNotifications);
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/tokens', () => ({
  hashToken: (t: string) => `hash(${t})`,
}));

import { POST } from '@/app/api/registro/verificar/route';

function makeRequest(body: unknown) {
  return new NextRequest('https://app.test/api/registro/verificar', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function validPendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    token_hash: 'hash(good-token)',
    nombre_organizacion: 'Colegio Test',
    nombre_usuario: 'Juan Director',
    email: 'juan@colegiotest.edu',
    password_hash: '$2a$10$pending',
    expira_el: new Date(Date.now() + 3600_000),
    verificado: false,
    ...overrides,
  };
}

function validPlan() {
  return {
    id: 1,
    nombre: 'box-principal',
    trial_dias: 14,
  };
}

function validRoles() {
  return [
    { id: 3, nombre: 'director' },
    { id: 7, nombre: 'solicitante' },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Después de clearAllMocks el mock de $transaction pierde la impl; la
  // re-aplicamos para que siga pasando tx === instance al handler.
  mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
});

describe('POST /api/registro/verificar', () => {
  it('returns 400 when the token is missing or empty', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 INVALID_TOKEN when the token is expired, used, or unknown', async () => {
    mockPrisma.registros_pendientes.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest({ token: 'bad-token' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_TOKEN');
    expect(mockPrisma.tenants.create).not.toHaveBeenCalled();
  });

  it('returns 409 CONFLICT when the email already exists (race condition)', async () => {
    mockPrisma.registros_pendientes.findFirst.mockResolvedValue(validPendingRow());
    mockPrisma.usuarios.findFirst.mockResolvedValue({ id: 999 });
    mockPrisma.registros_pendientes.update.mockResolvedValue({});

    const res = await POST(makeRequest({ token: 'good-token' }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CONFLICT');
    // El pending se marca como verificado para evitar re-uso.
    expect(mockPrisma.registros_pendientes.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { verificado: true },
    });
    expect(mockPrisma.tenants.create).not.toHaveBeenCalled();
  });

  it('returns 500 when the default plan box-principal is missing', async () => {
    mockPrisma.registros_pendientes.findFirst.mockResolvedValue(validPendingRow());
    mockPrisma.usuarios.findFirst.mockResolvedValue(null);
    mockPrisma.roles.findMany.mockResolvedValue(validRoles());
    mockPrisma.planes.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ token: 'good-token' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
    expect(mockPrisma.tenants.create).not.toHaveBeenCalled();
  });

  it('returns 500 when required roles are missing', async () => {
    mockPrisma.registros_pendientes.findFirst.mockResolvedValue(validPendingRow());
    mockPrisma.usuarios.findFirst.mockResolvedValue(null);
    // Falta el rol 'solicitante'.
    mockPrisma.roles.findMany.mockResolvedValue([{ id: 3, nombre: 'director' }]);

    const res = await POST(makeRequest({ token: 'good-token' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
  });

  it('creates tenant as active + trialing subscription on the happy path', async () => {
    mockPrisma.registros_pendientes.findFirst.mockResolvedValue(validPendingRow());
    mockPrisma.usuarios.findFirst.mockResolvedValue(null);
    mockPrisma.roles.findMany.mockResolvedValue(validRoles());
    mockPrisma.planes.findUnique.mockResolvedValue(validPlan());
    mockPrisma.tenants.findUnique.mockResolvedValue(null);
    mockPrisma.tenants.count.mockResolvedValue(0);
    mockPrisma.tenants.create.mockResolvedValue({ id: 42, slug: 'colegio-test' });
    mockPrisma.areas.create.mockResolvedValue({ id: 100 });
    const txUsuarios = {
      create: vi.fn().mockResolvedValue({ id: 500, tenant_id: 42 }),
    };
    // Patch usuarios dentro del mock para que tx.usuarios.create funcione.
    (mockPrisma as any).usuarios.create = txUsuarios.create;

    const res = await POST(makeRequest({ token: 'good-token' }));
    expect(res.status).toBe(201);

    // Tenant arranca activo, NO pendiente (fix del super_admin-approval).
    expect(mockPrisma.tenants.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'activo',
          nombre: 'Colegio Test',
          email_contacto: 'juan@colegiotest.edu',
          moneda: 'ARS',
        }),
      }),
    );

    // La suscripción trialing se crea inline en la tx, con 14 días.
    const createSubCall = mockPrisma.suscripciones.create.mock.calls[0][0];
    expect(createSubCall.data.tenant_id).toBe(42);
    expect(createSubCall.data.plan_id).toBe(1);
    expect(createSubCall.data.estado).toBe('trialing');
    const trialSpan =
      createSubCall.data.trial_ends_at.getTime() - createSubCall.data.trial_starts_at.getTime();
    expect(trialSpan).toBe(14 * 24 * 60 * 60 * 1000);

    // Notificación a admins es informativa, no pide aprobación.
    expect(mockNotifications.notificarAdmins).toHaveBeenCalledOnce();
    const notifArgs = mockNotifications.notificarAdmins.mock.calls[0];
    expect(notifArgs[0]).toMatch(/registrada/i);
    expect(notifArgs[0]).not.toMatch(/pendiente/i);

    // Se marca el token como usado para evitar re-registro.
    expect(mockPrisma.registros_pendientes.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { verificado: true },
    });
  });
});
