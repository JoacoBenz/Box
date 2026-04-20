import { getServerSession } from './auth';
import { tenantPrisma, prisma } from './prisma';
import { verificarRol, apiError } from './permissions';
import { getClientIp } from './audit';
import { getEffectiveTenantId } from './tenant-override';
import { checkRateLimitDb } from './rate-limit';
import type { RolNombre } from '@/types';
import { logApiError } from './logger';

interface HandlerContext {
  session: Awaited<ReturnType<typeof getServerSession>>;
  db: ReturnType<typeof tenantPrisma>;
  ip: string;
}

interface AdminHandlerContext extends HandlerContext {
  /** The effective tenant ID (null if admin viewing all tenants) */
  effectiveTenantId: number | null;
  /** Tenant-scoped DB if effectiveTenantId is set, otherwise global prisma */
  db: ReturnType<typeof tenantPrisma>;
}

type ApiHandler = (request: Request, context: HandlerContext, params?: any) => Promise<Response>;

type AdminApiHandler = (
  request: Request,
  context: AdminHandlerContext,
  params?: any,
) => Promise<Response>;

interface ApiHandlerOptions {
  roles?: RolNombre[]; // Required roles (any of these). Empty = authenticated only.
  /** Rate limit for write operations (POST/PATCH/PUT/DELETE). Defaults to 30/min per user. Set false to disable. */
  rateLimit?: { max: number; windowMs: number } | false;
}

function handleError(request: Request, error: any): Response {
  if (error.message === 'No autenticado') {
    return apiError('UNAUTHORIZED', 'Sesión expirada. Iniciá sesión nuevamente.', 401);
  }
  const url = new URL(request.url);
  logApiError(url.pathname, request.method, error);
  return apiError('INTERNAL', 'Error interno del servidor', 500);
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

      // super_admin bypasses role checks (has full platform access)
      if (options.roles && options.roles.length > 0 && !session.roles.includes('super_admin')) {
        if (!verificarRol(session.roles, options.roles)) {
          return apiError('FORBIDDEN', 'No tenés permisos para esta acción', 403);
        }
      }

      // Rate limit write operations (POST/PATCH/PUT/DELETE)
      const isWrite = request.method !== 'GET' && request.method !== 'HEAD';
      if (isWrite && options.rateLimit !== false) {
        const rl = options.rateLimit ?? { max: 30, windowMs: 60_000 };
        const url = new URL(request.url);
        const rlResult = await checkRateLimitDb(
          `api:${session.userId}:${url.pathname}`,
          rl.max,
          rl.windowMs,
        );
        if (!rlResult.allowed) {
          return apiError('RATE_LIMITED', 'Demasiados intentos. Intentá de nuevo más tarde.', 429);
        }
      }

      // super_admin uses effective tenant from override cookie/param
      const isSuperAdmin = session.roles.includes('super_admin');
      let tenantId = session.tenantId;
      if (isSuperAdmin) {
        const { effectiveTenantId } = await getEffectiveTenantId(request);
        if (effectiveTenantId) tenantId = effectiveTenantId;
      }
      const db = tenantPrisma(tenantId);
      const ip = getClientIp(request);
      const params = routeParams?.params ? await routeParams.params : undefined;

      return await handler(request, { session, db, ip }, params);
    } catch (error: any) {
      return handleError(request, error);
    }
  };
}

/**
 * Simplified version without role check — just auth + tenant DB.
 */
export function withTenant(handler: ApiHandler) {
  return withAuth({}, handler);
}

/**
 * Wraps an API route handler with admin tenant override support.
 * The effective tenant may be null (admin viewing all tenants) for GET requests.
 * Write operations (POST/PATCH/DELETE) require a specific tenant to be selected,
 * unless allowGlobalWrites is set (e.g., for platform-level admin actions).
 */
export function withAdminOverride(
  options: ApiHandlerOptions & { allowGlobalWrites?: boolean },
  handler: AdminApiHandler,
) {
  return async (request: Request, routeParams?: any) => {
    try {
      const { session, effectiveTenantId } = await getEffectiveTenantId(request);

      // super_admin bypasses role checks (has full platform access)
      if (options.roles && options.roles.length > 0 && !session.roles.includes('super_admin')) {
        if (!verificarRol(session.roles, options.roles)) {
          return apiError('FORBIDDEN', 'No tenés permisos para esta acción', 403);
        }
      }

      // Rate limit write operations
      const isWrite = request.method !== 'GET' && request.method !== 'HEAD';
      if (isWrite && options.rateLimit !== false) {
        const rl = (options as any).rateLimit ?? { max: 30, windowMs: 60_000 };
        const url = new URL(request.url);
        const rlResult = await checkRateLimitDb(
          `api:${session.userId}:${url.pathname}`,
          rl.max,
          rl.windowMs,
        );
        if (!rlResult.allowed) {
          return apiError('RATE_LIMITED', 'Demasiados intentos. Intentá de nuevo más tarde.', 429);
        }
      }

      // Block write operations without a specific tenant (prevents cross-tenant mutations)
      if (isWrite && !effectiveTenantId && !options.allowGlobalWrites) {
        return apiError(
          'BAD_REQUEST',
          'Seleccioná una organización antes de realizar esta acción',
          400,
        );
      }

      const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : (prisma as any);
      const ip = getClientIp(request);
      const params = routeParams?.params ? await routeParams.params : undefined;

      return await handler(request, { session, db, ip, effectiveTenantId }, params);
    } catch (error: any) {
      return handleError(request, error);
    }
  };
}

/**
 * Validates a Zod schema and returns a typed error response on failure.
 */
export function validateBody<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: any } },
  body: unknown,
): { success: true; data: T } | { success: false; response: Response } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: apiError(
        'VALIDATION_ERROR',
        'Datos inválidos',
        400,
        result.error.issues.map((i: any) => ({ field: i.path.join('.'), message: i.message })),
      ),
    };
  }
  return { success: true, data: result.data as T };
}

/**
 * Parses a route param ID and returns the number, or null if invalid.
 */
export function parseId(id: string | undefined): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}
