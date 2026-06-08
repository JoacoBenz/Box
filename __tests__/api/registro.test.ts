import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockSendEmail, mockRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    usuarios: { findFirst: vi.fn() },
    registros_pendientes: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  } as Record<string, any>,
  mockSendEmail: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/email', () => ({ sendEmail: mockSendEmail }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimitDb: mockRateLimit }));
vi.mock('@/lib/audit', () => ({ getClientIp: () => '1.2.3.4' }));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/tokens', () => ({
  generateToken: () => 'plain-token',
  hashToken: () => 'hashed-token',
}));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed-pw') } }));

import { POST } from '@/app/api/registro/route';

function makeRequest() {
  return new NextRequest('http://localhost/api/registro', {
    method: 'POST',
    body: JSON.stringify({
      nombreOrganizacion: 'Escuela Demo',
      nombreUsuario: 'Juan Pérez',
      email: 'juan@escuela.com',
      password: 'Passw0rd!!',
    }),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue({ allowed: true });
  mockPrisma.usuarios.findFirst.mockResolvedValue(null);
  mockPrisma.registros_pendientes.findFirst.mockResolvedValue(null);
  mockPrisma.registros_pendientes.create.mockResolvedValue({ id: 1 });
  mockPrisma.registros_pendientes.deleteMany.mockResolvedValue({ count: 1 });
});

describe('POST /api/registro — email failure handling', () => {
  it('returns 201 and does NOT delete the pending record when email succeeds', async () => {
    mockSendEmail.mockResolvedValue(undefined);

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    expect(mockPrisma.registros_pendientes.create).toHaveBeenCalledOnce();
    expect(mockPrisma.registros_pendientes.deleteMany).not.toHaveBeenCalled();
  });

  it('rolls back the pending record and returns 502 when email fails', async () => {
    mockSendEmail.mockRejectedValue(new Error('SMTP down'));

    const res = await POST(makeRequest());
    const body = await res.json();

    // Must not 500 and lock the user out — must be a clean, retryable error.
    expect(res.status).toBe(502);
    expect(body.error.code).toBe('EMAIL_FAILED');
    // The pending registration must be removed so the user can retry immediately.
    expect(mockPrisma.registros_pendientes.deleteMany).toHaveBeenCalledWith({
      where: { token_hash: 'hashed-token' },
    });
  });

  it('still returns a retryable error even if cleanup itself fails', async () => {
    mockSendEmail.mockRejectedValue(new Error('SMTP down'));
    mockPrisma.registros_pendientes.deleteMany.mockRejectedValue(new Error('db hiccup'));

    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
  });
});
