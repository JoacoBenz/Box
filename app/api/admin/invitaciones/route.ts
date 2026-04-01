import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from '@/lib/auth';
import { prisma, tenantPrisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: NextRequest) {
  try {
    console.log('[invitaciones] GET started');
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    console.log('[invitaciones] session ok, roles:', session.roles, 'tid:', effectiveTenantId ?? session.tenantId);

    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const tid = effectiveTenantId ?? session.tenantId;
    console.log('[invitaciones] querying codigos for tenant:', tid);

    const codigos = await prisma.codigos_invitacion.findMany({
      where: { tenant_id: tid },
      orderBy: { created_at: 'desc' },
      include: { creador: { select: { nombre: true } } },
    });

    console.log('[invitaciones] found', codigos.length, 'codigos');
    return Response.json(codigos);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    console.error('[invitaciones GET ERROR]', msg);
    console.error('[invitaciones GET STACK]', stack);
    if (msg === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    // Return the actual error message for debugging
    return NextResponse.json({ error: { code: 'INTERNAL', message: `DEBUG: ${msg}` } }, { status: 500 });
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[invitaciones POST ERROR]', msg);
    if (msg === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return NextResponse.json({ error: { code: 'INTERNAL', message: `DEBUG: ${msg}` } }, { status: 500 });
  }
}
