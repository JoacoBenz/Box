import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { logApiError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['super_admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const registros = await prisma.registros_pendientes.findMany({
      where: { verificado: false },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        nombre_organizacion: true,
        nombre_usuario: true,
        email: true,
        expira_el: true,
        created_at: true,
      },
    });

    // Add expired status
    const now = new Date();
    const result = registros.map(r => ({
      ...r,
      expirado: r.expira_el < now,
    }));

    return Response.json(result);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/registros-pendientes', 'GET', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['super_admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('VALIDATION', 'ID requerido', 400);

    await prisma.registros_pendientes.delete({ where: { id: parseInt(id) } });

    return Response.json({ message: 'Registro eliminado' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/registros-pendientes', 'DELETE', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
