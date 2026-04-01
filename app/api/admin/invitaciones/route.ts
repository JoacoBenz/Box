import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const tid = effectiveTenantId ?? session.tenantId;
    const codigos = await prisma.codigos_invitacion.findMany({
      where: { tenant_id: tid },
      orderBy: { created_at: 'desc' },
      include: { creador: { select: { nombre: true } } },
    });

    return Response.json(codigos);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const tid = effectiveTenantId ?? session.tenantId;
    const body = await request.json();
    const maxUsos = body.max_usos ? parseInt(body.max_usos) : null;
    const diasValidez = parseInt(body.dias_validez) || 30;

    // Generate unique 8-char code
    let codigo: string;
    let attempts = 0;
    do {
      codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
      const exists = await prisma.codigos_invitacion.findFirst({ where: { codigo } });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return apiError('INTERNAL', 'No se pudo generar un código único', 500);
    }

    const expiraEl = new Date();
    expiraEl.setDate(expiraEl.getDate() + diasValidez);

    const inv = await prisma.codigos_invitacion.create({
      data: {
        tenant_id: tid,
        codigo: codigo!,
        creado_por: session.userId,
        max_usos: maxUsos,
        expira_el: expiraEl,
      },
    });

    return Response.json(inv, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
