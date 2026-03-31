import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { areaSchema } from '@/lib/validators';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
    }

    const { id } = await params;
    const areaId = parseInt(id);
    const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

    const area = await db.areas.findFirst({ where: { id: areaId } });
    if (!area) return Response.json({ error: { code: 'NOT_FOUND', message: 'Área no encontrada' } }, { status: 404 });

    const body = await request.json();

    // Toggle activo only
    if (typeof body.activo === 'boolean' && Object.keys(body).length === 1) {
      const updated = await db.areas.update({
        where: { id: areaId },
        data: { activo: body.activo },
      });
      await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: body.activo ? 'activar_area' : 'desactivar_area', entidad: 'area', entidadId: areaId, ipAddress: getClientIp(request) });
      return Response.json(updated);
    }

    const result = areaSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const { nombre, responsable_id } = result.data;

    if (nombre !== area.nombre) {
      const existing = await db.areas.findFirst({ where: { nombre } });
      if (existing) return Response.json({ error: { code: 'CONFLICT', message: 'Ya existe un área con ese nombre' } }, { status: 409 });
    }

    if (responsable_id) {
      const user = await db.usuarios.findFirst({ where: { id: responsable_id, activo: true } });
      if (!user) return Response.json({ error: { code: 'NOT_FOUND', message: 'Responsable no encontrado' } }, { status: 404 });
    }

    const updated = await db.areas.update({
      where: { id: areaId },
      data: { nombre, responsable_id: responsable_id ?? null },
    });

    await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: 'editar_area', entidad: 'area', entidadId: areaId, datosAnteriores: area, datosNuevos: updated, ipAddress: getClientIp(request) });

    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
    }

    const { id } = await params;
    const areaId = parseInt(id);
    const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

    const area = await db.areas.findFirst({ where: { id: areaId } });
    if (!area) return Response.json({ error: { code: 'NOT_FOUND', message: 'Área no encontrada' } }, { status: 404 });

    // Check for active solicitudes
    const activeSolicitudes = await db.solicitudes.count({
      where: { area_id: areaId, estado: { notIn: ['rechazada', 'cerrada'] } },
    });
    if (activeSolicitudes > 0) {
      return Response.json({ error: { code: 'CONFLICT', message: `No podés desactivar esta área: tiene ${activeSolicitudes} solicitud(es) activa(s)` } }, { status: 409 });
    }

    await db.areas.update({ where: { id: areaId }, data: { activo: false } });
    await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: 'desactivar_area', entidad: 'area', entidadId: areaId, ipAddress: getClientIp(request) });

    return Response.json({ message: 'Área desactivada' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
