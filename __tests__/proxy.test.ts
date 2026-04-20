import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth/jwt — proxy.ts calls getToken() on every request.
// These tests verify the middleware contract regardless of NextAuth internals,
// which is critical because getToken() is the most likely surface to break
// on a next-auth upgrade.
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

// Mock subscription lookup so tests don't hit the DB. Default: tenant has access.
vi.mock('@/lib/subscription', () => ({
  getSubscriptionStatus: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import { getSubscriptionStatus } from '@/lib/subscription';
import { proxy } from '@/proxy';

const mockedGetToken = vi.mocked(getToken);
const mockedGetSubscription = vi.mocked(getSubscriptionStatus);

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`https://app.test${pathname}`);
}

function activeSubscription() {
  return {
    tenantId: 42,
    planId: 1,
    planNombre: 'box-principal',
    estado: 'active' as const,
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    stripeCustomerId: 'cus_x',
    stripeSubscriptionId: 'sub_x',
    hasAccess: true,
    trialDaysLeft: null,
  };
}

beforeEach(() => {
  mockedGetToken.mockReset();
  mockedGetSubscription.mockReset();
  // Default: active subscription so existing assertions still pass
  mockedGetSubscription.mockResolvedValue(activeSubscription());
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

  // ── Subscription guard ──
  describe('subscription guard', () => {
    beforeEach(() => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        tenantId: 42,
        roles: ['solicitante'],
      } as never);
    });

    it('allows access when subscription is active', async () => {
      mockedGetSubscription.mockResolvedValue(activeSubscription());
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.status).toBe(200);
    });

    it('allows access when trialing with access', async () => {
      mockedGetSubscription.mockResolvedValue({
        ...activeSubscription(),
        estado: 'trialing',
        trialDaysLeft: 5,
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        hasAccess: true,
      });
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.status).toBe(200);
    });

    it('redirects to /facturacion when subscription is canceled', async () => {
      mockedGetSubscription.mockResolvedValue({
        ...activeSubscription(),
        estado: 'canceled',
        hasAccess: false,
      });
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('/facturacion');
      expect(res.headers.get('location')).toContain('reason=canceled');
    });

    it('redirects to /facturacion when tenant has no subscription row', async () => {
      mockedGetSubscription.mockResolvedValue(null);
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toContain('reason=no_subscription');
    });

    it('lets /facturacion through even when subscription is canceled', async () => {
      mockedGetSubscription.mockResolvedValue({
        ...activeSubscription(),
        estado: 'canceled',
        hasAccess: false,
      });
      const res = await proxy(makeRequest('/facturacion'));
      expect(res.status).toBe(200);
    });

    it('lets /api/stripe/* through even when subscription is canceled', async () => {
      mockedGetSubscription.mockResolvedValue({
        ...activeSubscription(),
        estado: 'canceled',
        hasAccess: false,
      });
      const res = await proxy(makeRequest('/api/stripe/checkout'));
      expect(res.status).toBe(200);
    });

    it('lets super_admin through regardless of subscription state (platform staff)', async () => {
      mockedGetToken.mockResolvedValue({
        userId: 1,
        tenantId: 42,
        roles: ['super_admin'],
      } as never);
      mockedGetSubscription.mockResolvedValue({
        ...activeSubscription(),
        estado: 'canceled',
        hasAccess: false,
      });
      const res = await proxy(makeRequest('/solicitudes'));
      expect(res.status).toBe(200);
      // Subscription lookup is skipped for platform staff
      expect(mockedGetSubscription).not.toHaveBeenCalled();
    });
  });
});
