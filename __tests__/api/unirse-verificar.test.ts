import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockRateLimit, mockAudit } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    usuarios: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  mockRateLimit: {
    checkRateLimitDb: vi.fn(),
  },
  mockAudit: {
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
    getClientIp: vi.fn(() => '1.2.3.4'),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, tenantPrisma: vi.fn(() => mockPrisma) }));
vi.mock('@/lib/rate-limit', () => mockRateLimit);
vi.mock('@/lib/audit', () => mockAudit);
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));

import { POST } from '@/app/api/unirse/verificar/route';

function makeRequest(body: unknown) {
  return new NextRequest('https://app.test/api/unirse/verificar', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/unirse/verificar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.checkRateLimitDb.mockResolvedValue({ allowed: true });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.checkRateLimitDb.mockResolvedValue({ allowed: false });
    const res = await POST(makeRequest({ token: 'x' }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 when token is missing', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when token is not a string', async () => {
    const res = await POST(makeRequest({ token: 123 }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the token is expired, used, or unknown', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const res = await POST(makeRequest({ token: 'bad-token' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_FOUND');
    expect(mockPrisma.usuarios.update).not.toHaveBeenCalled();
  });

  it('atomically consumes token, activates user, and writes audit log', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ usuario_id: 77 }]);
    mockPrisma.usuarios.findUnique.mockResolvedValue({
      tenant_id: 42,
      nombre: 'Bob',
      email: 'bob@acme.com',
    });

    const res = await POST(makeRequest({ token: 'good-token' }));

    expect(res.status).toBe(200);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    expect(mockPrisma.usuarios.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { activo: true },
    });
    expect(mockAudit.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 42,
        usuarioId: 77,
        accion: 'verificar_email_empleado',
        entidad: 'usuario',
        entidadId: 77,
      }),
    );
  });

  it('still returns 200 when user lookup after activation fails (audit skipped)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ usuario_id: 77 }]);
    mockPrisma.usuarios.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ token: 'good-token' }));

    expect(res.status).toBe(200);
    expect(mockPrisma.usuarios.update).toHaveBeenCalled();
    expect(mockAudit.registrarAuditoria).not.toHaveBeenCalled();
  });

  it('returns 500 when the DB throws an unexpected error', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ token: 'x' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
  });
});
