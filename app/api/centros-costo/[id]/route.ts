import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin', 'tesoreria'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permisos' } }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = centroCostoSchema.partial().safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' } }, { status: 400 });
    }

    const db = tenantPrisma(session.tenantId);
    const centro = await db.centros_costo.findFirst({ where: { id: parseInt(id) } });
    if (!centro) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }, { status: 404 });

    const updated = await db.centros_costo.update({
      where: { id: parseInt(id) },
      data: {
        ...(result.data.nombre && { nombre: result.data.nombre }),
        ...(result.data.codigo && { codigo: result.data.codigo.toUpperCase() }),
        ...(body.activo !== undefined && { activo: body.activo }),
      },
    });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'editar_centro_costo', entidad: 'centro_costo', entidadId: updated.id });
    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
