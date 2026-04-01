import { NextResponse } from 'next/server';
import { tenantPrisma } from '@/lib/prisma';
import { apiError } from '@/lib/permissions';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { session, effectiveTenantId } = await getEffectiveTenantId(request);
  const { id } = await params;
  const solicitudId = Number(id);
  if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

  const db = tenantPrisma(effectiveTenantId ?? session.tenantId);

  // Get audit log entries for this solicitud
  const events = await db.log_auditoria.findMany({
    where: {
      entidad: 'solicitud',
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
  } catch (e: any) {
    if (e.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error cargando timeline', 500);
  }
}
