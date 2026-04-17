import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

// Mock next-auth/jwt — proxy.ts calls getToken() on every request.
// These tests verify the middleware contract regardless of NextAuth internals,
// which is critical because getToken() is the most likely surface to break
// on a next-auth upgrade.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
const mockedGetToken = vi.mocked(getToken);

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`https://app.test${pathname}`);
}

beforeEach(() => {
  mockedGetToken.mockReset();
});

describe('proxy (Next.js 16 middleware)', () => {
  // ── Public routes ──
  describe('public routes', () => {
    const publicPaths = [
      '/inicio',
      '/login',
      '/registro',
      '/recuperar',
      '/restablecer',
      '/verificar-email',
      '/unirse',
      '/api/auth/signin',
      '/api/registro',
      '/api/unirse',
      '/api/health',
    ];

    for (const path of publicPaths) {
      it(`lets ${path} through without calling getToken`, async () => {
        const res = await proxy(makeRequest(path));
        expect(res.status).toBe(200);
        expect(mockedGetToken).not.toHaveBeenCalled();
      });
    }
  });

  // ── Unauthenticated ──
  describe('missing token', () => {
    it('redirects to /inicio when no token is present', async () => {
      mockedGetToken.mockResolvedValue(null);
      const res = await proxy(makeRequest('/'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe('https://app.test/inicio');
    });
  });

  // ── Tenant guard ──
  describe('tenant guard', () => {
    it('redirects when token lacks tenantId', async () => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        roles: ['solicitante'],
      } as never);
      const res = await proxy(makeRequest('/'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/inicio');
      expect(res.headers.get('location')).toContain('reason=invalid_session');
    });

    it('redirects when tenantId is not a number', async () => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        tenantId: 'not-a-number',
        roles: ['solicitante'],
      } as never);
      const res = await proxy(makeRequest('/'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('reason=invalid_session');
    });

    it('redirects when tenantId is zero or negative', async () => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        tenantId: 0,
        roles: ['solicitante'],
      } as never);
      const res = await proxy(makeRequest('/'));
      expect(res.headers.get('location')).toContain('reason=invalid_session');
    });
  });

  // ── Role-based routing ──
  describe('role-based routing', () => {
    const routesByRole: Array<[string, string]> = [
      ['/validaciones', 'responsable_area'],
      ['/aprobaciones', 'director'],
      ['/compras', 'tesoreria'],
      ['/admin', 'admin'],
    ];

    for (const [route, role] of routesByRole) {
      it(`lets ${role} access ${route}`, async () => {
        mockedGetToken.mockResolvedValue({
          userId: 1,
          tenantId: 42,
          roles: [role],
        } as never);
        const res = await proxy(makeRequest(route));
        expect(res.status).toBe(200);
      });

      it(`lets super_admin access ${route}`, async () => {
        mockedGetToken.mockResolvedValue({
          userId: 1,
          tenantId: 42,
          roles: ['super_admin'],
        } as never);
        const res = await proxy(makeRequest(route));
        expect(res.status).toBe(200);
      });

      it(`redirects non-privileged user away from ${route}`, async () => {
        mockedGetToken.mockResolvedValue({
          userId: 1,
          tenantId: 42,
          roles: ['solicitante'],
        } as never);
        const res = await proxy(makeRequest(route));
        expect(res.status).toBe(307);
        expect(res.headers.get('location')).toBe('https://app.test/');
      });
    }
  });

  // ── Security headers ──
  describe('security headers on authenticated responses', () => {
    beforeEach(() => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        tenantId: 42,
        roles: ['solicitante'],
      } as never);
    });

    it('sets X-Frame-Options DENY', async () => {
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Content-Type-Options nosniff', async () => {
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Referrer-Policy', async () => {
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('sets Permissions-Policy locking down device APIs', async () => {
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
      expect(res.headers.get('Permissions-Policy')).toContain('microphone=()');
      expect(res.headers.get('Permissions-Policy')).toContain('geolocation=()');
    });
  });
});
