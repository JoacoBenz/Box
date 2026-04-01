import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  const { id } = await params;
  const delegacionId = Number(id);
  if (isNaN(delegacionId)) return apiError('VALIDATION', 'ID inválido', 400);

  const db = tenantPrisma(session.tenantId);
  const delegacion = await db.delegaciones.findFirst({ where: { id: delegacionId } });

  if (!delegacion) return apiError('NOT_FOUND', 'Delegación no encontrada', 404);

  // Only the delegante or admin can deactivate
  if (delegacion.delegante_id !== session.userId && !verificarRol(session.roles, ['admin'])) {
    return apiError('FORBIDDEN', 'Solo el delegante o un admin puede desactivar', 403);
  }

  await db.delegaciones.update({
    where: { id: delegacionId },
    data: { activo: false },
  });

  await registrarAuditoria({
    tenantId: session.tenantId,
    usuarioId: session.userId,
    accion: 'desactivar_delegacion',
    entidad: 'delegaciones',
    entidadId: delegacionId,
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ ok: true });
}
