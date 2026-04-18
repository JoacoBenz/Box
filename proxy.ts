import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSubscriptionStatus } from '@/lib/subscription';

// Next.js 16 proxy (middleware) always runs on Node.js runtime, so Prisma
// is safe to call for the subscription check below.

const PUBLIC_ROUTES = [
  '/inicio',
  '/login',
  '/registro',
  '/recuperar',
  '/restablecer',
  '/verificar-email',
  '/unirse',
  '/api/auth',
  '/api/registro',
  '/api/unirse',
  '/api/health',
];

/**
 * Routes that remain reachable even when the tenant's subscription is
 * canceled/unpaid. Admins must still be able to reach billing to upgrade,
 * and Stripe callbacks must be able to notify the app.
 */
const SUBSCRIPTION_EXEMPT_ROUTES = [
  '/facturacion',
  '/api/stripe',
  '/api/auth',
  '/api/health',
  '/logout',
];

// NextAuth v5 (authjs) uses different cookie names than v4
const AUTH_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token';

const ROLE_ROUTES: Record<string, string[]> = {
  '/validaciones': ['responsable_area', 'super_admin'],
  '/aprobaciones': ['director', 'super_admin'],
  '/compras': ['tesoreria', 'super_admin'],
  '/admin': ['admin', 'super_admin'],
};

/** Super-admins manage the platform tenant and don't have a billing sub. */
const PLATFORM_TENANT_ROLE = 'super_admin';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: AUTH_COOKIE,
  });

  if (!token) {
    return NextResponse.redirect(new URL('/inicio', request.url));
  }

  // Session without tenantId means a stale/corrupted JWT (e.g. post-migration,
  // or a user whose tenant was deleted). Force re-auth rather than letting
  // handlers run with missing multi-tenant context.
  if (typeof token.tenantId !== 'number' || token.tenantId <= 0) {
    const url = new URL('/inicio', request.url);
    url.searchParams.set('reason', 'invalid_session');
    return NextResponse.redirect(url);
  }

  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route)) {
      const userRoles = (token.roles as string[]) || [];
      const hasAccess = allowedRoles.some((role) => userRoles.includes(role));
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  // Subscription check — gate everything except exempt routes and platform staff.
  const userRoles = (token.roles as string[]) || [];
  const isSubscriptionExempt =
    SUBSCRIPTION_EXEMPT_ROUTES.some((r) => pathname.startsWith(r)) ||
    userRoles.includes(PLATFORM_TENANT_ROLE);
  if (!isSubscriptionExempt) {
    const subscription = await getSubscriptionStatus(token.tenantId);
    if (!subscription || !subscription.hasAccess) {
      const url = new URL('/facturacion', request.url);
      url.searchParams.set('reason', subscription ? subscription.estado : 'no_subscription');
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
