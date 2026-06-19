import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockPrisma, mockSendEmail } = vi.hoisted(() => ({
  mockPrisma: {
    tenants: { findMany: vi.fn() },
    solicitudes: { findMany: vi.fn() },
    usuarios: { findMany: vi.fn() },
  } as Record<string, any>,
  mockSendEmail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/email', () => ({ sendEmail: mockSendEmail }));
vi.mock('@/lib/logger', () => ({ logApiError: vi.fn() }));
vi.mock('@/lib/email-digest', () => ({
  ROLE_CONFIGS: [{ estado: 'enviada', roleName: 'responsable_area', heading: 'Pendientes' }],
  businessDaysBetween: () => 0,
  filterSolicitudesForUser: (sols: any[]) => sols,
  shouldSendDigest: () => true,
  buildEmailHtml: () => '<p>html</p>',
  buildSubject: () => 'Asunto',
}));

import { POST } from '@/app/api/cron/email-aprobaciones/route';

function makeRequest() {
  return new NextRequest('http://localhost/api/cron/email-aprobaciones', { method: 'POST' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.tenants.findMany.mockResolvedValue([{ id: 1, nombre: 'Escuela' }]);
  mockPrisma.solicitudes.findMany.mockResolvedValue([
    { id: 10, fecha_validacion: null, updated_at: new Date(), area: null },
  ]);
  mockPrisma.usuarios.findMany.mockResolvedValue([
    { id: 1, nombre: 'A', email: 'a@x.com', email_digest: true, area_id: null },
    { id: 2, nombre: 'B', email: 'b@x.com', email_digest: true, area_id: null },
    { id: 3, nombre: 'C', email: 'c@x.com', email_digest: true, area_id: null },
  ]);
});

describe('POST /api/cron/email-aprobaciones — per-email isolation', () => {
  it('continues the batch when one email fails and reports counts', async () => {
    // First recipient throws, the other two succeed.
    mockSendEmail
      .mockRejectedValueOnce(new Error('bad address'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest());
    const body = await res.json();

    // The job must NOT abort — all three recipients are attempted.
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.emails_sent).toBe(2);
    expect(body.failed).toBe(1);
  });

  it('sends to all recipients when none fail', async () => {
    mockSendEmail.mockResolvedValue(undefined);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(body.emails_sent).toBe(3);
    expect(body.failed).toBe(0);
  });
});
