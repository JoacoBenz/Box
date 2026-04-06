import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'super_admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const tid = effectiveTenantId ?? session.tenantId;
    const configs = await prisma.configuracion.findMany({
      where: { tenant_id: tid },
    });

    const result: Record<string, string> = {};
    for (const c of configs) {
      result[c.clave] = c.valor;
    }

    return Response.json(result);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'super_admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const tid = effectiveTenantId ?? session.tenantId;
    const body = await request.json();
    const { clave, valor } = body;

    if (!clave || typeof clave !== 'string') {
      return apiError('VALIDATION_ERROR', 'Clave requerida', 400);
    }

    // All keys below are org-level config (safe for director access).
    // If platform-level keys are added in the future, restrict them to admin-only.
    const allowedKeys = [
      'sso_dominio', 'sso_google_habilitado', 'sso_microsoft_habilitado',
      'moneda', 'umbral_aprobacion_responsable', 'umbral_aprobacion_director',
    ];
    if (!allowedKeys.includes(clave)) {
      return apiError('VALIDATION_ERROR', `Clave no permitida: ${clave}`, 400);
    }

    await prisma.configuracion.upsert({
      where: { tenant_id_clave: { tenant_id: tid, clave } },
      update: { valor: String(valor ?? '') },
      create: { tenant_id: tid, clave, valor: String(valor ?? '') },
    });

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
