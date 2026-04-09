import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_ROUTES = ['/login', '/registro', '/recuperar', '/restablecer', '/verificar-email', '/unirse', '/api/auth', '/api/registro', '/api/unirse'];

const ROLE_ROUTES: Record<string, string[]> = {
  '/validaciones': ['responsable_area', 'super_admin'],
  '/aprobaciones': ['director', 'super_admin'],
  '/compras':      ['tesoreria', 'super_admin'],
  '/admin':        ['admin', 'super_admin'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
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
