import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockBcrypt, mockRateLimit } = vi.hoisted(() => ({
  mockPrisma: {
    $queryRaw: vi.fn(),
    usuarios: {
      updateMany: vi.fn(),
    },
  },
  mockBcrypt: {
    hash: vi.fn(),
  },
  mockRateLimit: {
    checkRateLimitDb: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma, tenantPrisma: vi.fn(() => mockPrisma) }));
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));
vi.mock('@/lib/rate-limit', () => mockRateLimit);
vi.mock('@/lib/audit', () => ({ getClientIp: vi.fn(() => '1.2.3.4') }));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/validators', async () => await vi.importActual('@/lib/validators'));

import { POST } from '@/app/api/auth/reset-password/route';

function makeRequest(body: unknown) {
  return new NextRequest('https://app.test/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.checkRateLimitDb.mockResolvedValue({ allowed: true });
    mockBcrypt.hash.mockResolvedValue('$2a$12$newhash');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockRateLimit.checkRateLimitDb.mockResolvedValue({ allowed: false });
    const res = await POST(makeRequest({ token: 'x', password: 'Password1!' }));
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns 400 when token is missing', async () => {
    const res = await POST(makeRequest({ password: 'Password1!' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when password does not meet requirements', async () => {
    const res = await POST(makeRequest({ token: 'x', password: 'short' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.details).toBeDefined();
  });

  it('returns 400 INVALID_TOKEN when the token is expired, used, or unknown', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const res = await POST(makeRequest({ token: 'bad-token', password: 'Password1!' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_TOKEN');
    expect(mockPrisma.usuarios.updateMany).not.toHaveBeenCalled();
  });

  it('atomically consumes the token and updates the password', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ email: 'alice@example.com' }]);
    mockPrisma.usuarios.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest({ token: 'good-token', password: 'Password1!' }));

    expect(res.status).toBe(200);
    // The UPDATE...RETURNING query is the atomic token consumption
    expect(mockPrisma.$queryRaw).toHaveBeenCalledOnce();
    // Password was bcrypt-hashed with cost 12 before being stored
    expect(mockBcrypt.hash).toHaveBeenCalledWith('Password1!', 12);
    // The user's password was updated with the hashed value
    expect(mockPrisma.usuarios.updateMany).toHaveBeenCalledWith({
      where: { email: 'alice@example.com', activo: true },
      data: { password_hash: '$2a$12$newhash' },
    });
  });

  it('returns 500 when the DB throws an unexpected error', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('db down'));
    const res = await POST(makeRequest({ token: 'x', password: 'Password1!' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
  });
});
