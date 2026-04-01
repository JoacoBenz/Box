import { NextResponse } from 'next/server';
import { getServerSession } from './auth';
import { tenantPrisma } from './prisma';
import { verificarRol, apiError } from './permissions';
import { getClientIp } from './audit';
import type { RolNombre } from '@/types';
import { logApiError } from './logger';

interface HandlerContext {
  session: Awaited<ReturnType<typeof getServerSession>>;
  db: ReturnType<typeof tenantPrisma>;
  ip: string;
}

type ApiHandler = (
  request: Request,
  context: HandlerContext,
  params?: any
) => Promise<Response>;

interface ApiHandlerOptions {
  roles?: RolNombre[];  // Required roles (any of these). Empty = authenticated only.
}

/**
 * Wraps an API route handler with authentication, tenant DB, and optional role checks.
 * Usage:
 *   export const POST = withAuth({ roles: ['admin'] }, async (request, { session, db, ip }) => {
 *     // handler logic
 *   });
 */
export function withAuth(options: ApiHandlerOptions, handler: ApiHandler) {
  return async (request: Request, routeParams?: any) => {
    try {
      const session = await getServerSession();

      if (options.roles && options.roles.length > 0) {
        if (!verificarRol(session.roles, options.roles)) {
          return apiError('FORBIDDEN', 'No tenés permisos para esta acción', 403);
        }
      }

      const db = tenantPrisma(session.tenantId);
      const ip = getClientIp(request);
      const params = routeParams?.params ? await routeParams.params : undefined;

      return await handler(request, { session, db, ip }, params);
    } catch (error: any) {
      if (error.message === 'No autenticado') {
        return apiError('UNAUTHORIZED', 'Sesión expirada. Iniciá sesión nuevamente.', 401);
      }
      const url = new URL(request.url);
      logApiError(url.pathname, request.method, error);
      return apiError('INTERNAL', 'Error interno del servidor', 500);
    }
  };
}

/**
 * Simplified version without role check — just auth + tenant DB.
 */
export function withTenant(handler: ApiHandler) {
  return withAuth({}, handler);
}
