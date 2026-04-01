import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { id } = await params;
    const inv = await prisma.codigos_invitacion.findUnique({ where: { id: parseInt(id) } });
    if (!inv) return apiError('NOT_FOUND', 'Código no encontrado', 404);

    const updated = await prisma.codigos_invitacion.update({
      where: { id: parseInt(id) },
      data: { activo: !inv.activo },
    });

    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
