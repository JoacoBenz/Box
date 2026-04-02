import { NextResponse } from 'next/server';
import { withAdminOverride } from '@/lib/api-handler';
import { apiError } from '@/lib/permissions';

export const GET = withAdminOverride({}, async (_request, { db }, params) => {
  const solicitudId = Number(params.id);
  if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

  // Get audit log entries for this solicitud
  const events = await db.log_auditoria.findMany({
    where: {
      entidad: 'solicitudes',
      entidad_id: solicitudId,
    },
    include: {
      usuario: { select: { nombre: true } },
    },
    orderBy: { created_at: 'asc' },
  });

  // Map to timeline events
  const timeline = events.map(e => ({
    id: Number(e.id),
    accion: e.accion,
    usuario: e.usuario.nombre,
    fecha: e.created_at,
    detalles: e.datos_nuevos as any,
    datosAnteriores: e.datos_anteriores as any,
  }));

  return NextResponse.json(timeline);
});
