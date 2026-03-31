import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion, verificarResponsableDeArea } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { devolucionSchema } from '@/lib/validators';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = parseInt(id);

    const body = await request.json();
    const result = devolucionSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const origen = body.origen as 'responsable' | 'director';
    const db = tenantPrisma(session.tenantId);
    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });

    // Optimistic locking: verify no concurrent modification
    const expectedUpdatedAt = body?.updated_at;
    if (expectedUpdatedAt) {
      const current = solicitud.updated_at.toISOString();
      if (current !== expectedUpdatedAt) {
        return Response.json({ error: { code: 'CONFLICT', message: 'Esta solicitud fue modificada por otro usuario. Recargá la página.' } }, { status: 409 });
      }
    }

    if (origen === 'responsable') {
      if (!verificarRol(session.roles, ['responsable_area'])) {
        return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
      }
      if (solicitud.estado !== 'enviada') {
        return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden devolver solicitudes enviadas' } }, { status: 400 });
      }
      const seg = verificarSegregacion(solicitud, session.userId, 'validar');
      if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });
      const esResponsable = await verificarResponsableDeArea(session.tenantId, session.userId, solicitud.area_id);
      if (!esResponsable) return Response.json({ error: { code: 'FORBIDDEN', message: 'No sos responsable del área' } }, { status: 403 });

      await db.solicitudes.update({ where: { id: solicitudId }, data: { estado: 'devuelta_resp', observaciones_responsable: result.data.observaciones } });
      await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_devuelta', titulo: 'Solicitud devuelta para corrección', mensaje: `${session.nombre}: ${result.data.observaciones}`, solicitudId });

    } else if (origen === 'director') {
      if (!verificarRol(session.roles, ['director'])) {
        return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
      }
      if (solicitud.estado !== 'validada') {
        return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden devolver solicitudes validadas' } }, { status: 400 });
      }
      const seg = verificarSegregacion(solicitud, session.userId, 'aprobar');
      if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

      await db.solicitudes.update({ where: { id: solicitudId }, data: { estado: 'devuelta_dir', observaciones_director: result.data.observaciones } });

      const area = await prisma.areas.findFirst({ where: { id: solicitud.area_id, tenant_id: session.tenantId } });
      if (area?.responsable_id) {
        await crearNotificacion({ tenantId: session.tenantId, destinatarioId: area.responsable_id, tipo: 'solicitud_devuelta_dir', titulo: 'Solicitud devuelta por Dirección', mensaje: `${session.nombre}: ${result.data.observaciones}`, solicitudId });
      }
      await crearNotificacion({ tenantId: session.tenantId, destinatarioId: solicitud.solicitante_id, tipo: 'solicitud_devuelta_dir', titulo: 'Solicitud devuelta por Dirección', mensaje: `${session.nombre}: ${result.data.observaciones}`, solicitudId });
    } else {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'origen debe ser responsable o director' } }, { status: 400 });
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: `devolver_${origen}`, entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { observaciones: result.data.observaciones }, ipAddress: getClientIp(request) });
    return Response.json({ message: 'Solicitud devuelta' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
