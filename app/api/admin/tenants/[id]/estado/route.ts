import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';

const ESTADOS_VALIDOS = ['activo', 'rechazado', 'suspendido'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { id } = await params;
    const tenantId = parseInt(id);
    const body = await request.json();
    const { estado } = body;

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return apiError('VALIDATION_ERROR', `Estado inválido. Opciones: ${ESTADOS_VALIDOS.join(', ')}`, 400);
    }

    const tenant = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!tenant) return apiError('NOT_FOUND', 'Organización no encontrada', 404);

    if (tenantId === session.tenantId) {
      return apiError('VALIDATION_ERROR', 'No podés cambiar el estado de tu propia organización', 400);
    }

    const updated = await prisma.tenants.update({
      where: { id: tenantId },
      data: { estado },
    });

    await registrarAuditoria({
      tenantId: session.tenantId,
      usuarioId: session.userId,
      accion: `cambiar_estado_tenant_${estado}`,
      entidad: 'tenant',
      entidadId: tenantId,
      datosAnteriores: { estado: tenant.estado },
      datosNuevos: { estado },
      ipAddress: getClientIp(request),
    });

    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
