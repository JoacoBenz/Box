import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { invalidateCache } from '@/lib/cache';

export async function GET(request: Request) {
  const { session, effectiveTenantId } = await (await import('@/lib/tenant-override')).getEffectiveTenantId(request);
  const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

  // Admin sees all, others see their own delegations
  const where = verificarRol(session.roles, ['admin'])
    ? {}
    : { OR: [{ delegante_id: session.userId }, { delegado_id: session.userId }] };

  const delegaciones = await db.delegaciones.findMany({
    where: { ...where, activo: true },
    include: {
      delegante: { select: { id: true, nombre: true, email: true } },
      delegado: { select: { id: true, nombre: true, email: true } },
    },
    orderBy: { fecha_inicio: 'desc' },
  });

  return NextResponse.json(delegaciones);
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!verificarRol(session.roles, ['admin', 'director', 'responsable_area'])) {
    return apiError('FORBIDDEN', 'No tenés permisos para delegar', 403);
  }

  const body = await request.json();
  const { delegado_id, rol_delegado, fecha_inicio, fecha_fin, motivo } = body;

  if (!delegado_id || !rol_delegado || !fecha_inicio || !fecha_fin) {
    return apiError('VALIDATION', 'Campos requeridos: delegado, rol, fecha inicio y fin', 400);
  }

  if (delegado_id === session.userId) {
    return apiError('VALIDATION', 'No podés delegarte a vos mismo', 400);
  }

  const inicio = new Date(fecha_inicio);
  const fin = new Date(fecha_fin);
  if (fin < inicio) {
    return apiError('VALIDATION', 'La fecha de fin debe ser posterior a la de inicio', 400);
  }

  // Can only delegate roles you have
  if (!session.roles.includes(rol_delegado as any) && !session.roles.includes('admin')) {
    return apiError('FORBIDDEN', 'Solo podés delegar roles que vos tenés', 403);
  }

  const db = tenantPrisma(session.tenantId);

  const delegacion = await db.delegaciones.create({
    data: {
      tenant_id: session.tenantId,
      delegante_id: session.userId,
      delegado_id: delegado_id,
      rol_delegado,
      fecha_inicio: inicio,
      fecha_fin: fin,
      motivo: motivo || null,
    } as any,
  });

  await registrarAuditoria({
    tenantId: session.tenantId,
    usuarioId: session.userId,
    accion: 'crear_delegacion',
    entidad: 'delegaciones',
    entidadId: delegacion.id,
    datosNuevos: { delegado_id, rol_delegado, fecha_inicio, fecha_fin },
    ipAddress: getClientIp(request),
  });

  // Invalidate cached roles for the delegado so new roles take effect immediately
  invalidateCache(`t:${session.tenantId}:roles:${delegado_id}`);

  return NextResponse.json(delegacion, { status: 201 });
}
