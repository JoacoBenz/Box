import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol, verificarSegregacion } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { crearNotificacion } from '@/lib/notifications';
import { procesarComprasSchema } from '@/lib/validators';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['compras'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo el sector Compras puede procesar solicitudes' } }, { status: 403 });
    }

    const { id } = await params;
    const solicitudId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const solicitud = await db.solicitudes.findFirst({ where: { id: solicitudId } });
    if (!solicitud) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrada' } }, { status: 404 });
    if (!['aprobada', 'en_compras'].includes(solicitud.estado)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Solo se pueden procesar solicitudes aprobadas' } }, { status: 400 });
    }

    const seg = verificarSegregacion(solicitud, session.userId, 'procesar_compras');
    if (!seg.permitido) return Response.json({ error: { code: 'FORBIDDEN', message: seg.motivo } }, { status: 403 });

    const body = await request.json();
    const result = procesarComprasSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    // Optimistic locking: verify no concurrent modification
    const expectedUpdatedAt = body?.updated_at;
    if (expectedUpdatedAt) {
      const current = solicitud.updated_at.toISOString();
      if (current !== expectedUpdatedAt) {
        return Response.json({ error: { code: 'CONFLICT', message: 'Esta solicitud fue modificada por otro usuario. Recargá la página.' } }, { status: 409 });
      }
    }

    await db.solicitudes.update({
      where: { id: solicitudId },
      data: {
        estado: 'en_compras',
        procesado_por_id: session.userId,
        fecha_procesamiento: new Date(),
        prioridad_compra: result.data.prioridad_compra,
        observaciones_compras: result.data.observaciones ?? null,
      },
    });

    await crearNotificacion({
      tenantId: session.tenantId,
      destinatarioId: solicitud.solicitante_id,
      tipo: 'solicitud_en_compras',
      titulo: 'Tu solicitud está siendo procesada',
      mensaje: `El sector Compras está procesando: ${solicitud.titulo}`,
      solicitudId,
    });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'procesar_compras', entidad: 'solicitud', entidadId: solicitudId, datosNuevos: { prioridad_compra: result.data.prioridad_compra, observaciones: result.data.observaciones }, ipAddress: getClientIp(request) });
    return Response.json({ message: 'Solicitud en procesamiento' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
