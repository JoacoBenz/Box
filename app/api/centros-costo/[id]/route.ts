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
    const centroId = parseInt(id);
    const centro = await db.centros_costo.findFirst({ where: { id: centroId } });
    if (!centro) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }, { status: 404 });

    // Duplicate checks on edit (exclude self)
    if (result.data.codigo) {
      const codigoUpper = result.data.codigo.toUpperCase();
      const dup = await db.centros_costo.findFirst({ where: { codigo: codigoUpper, id: { not: centroId } } });
      if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el código "${codigoUpper}"` } }, { status: 409 });
    }
    if (result.data.nombre) {
      const dup = await db.centros_costo.findFirst({ where: { nombre: { equals: result.data.nombre, mode: 'insensitive' }, activo: true, id: { not: centroId } } });
      if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el nombre "${result.data.nombre}"` } }, { status: 409 });
    }

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
