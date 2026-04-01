import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { logApiError } from '@/lib/logger';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { id } = await params;
    const tenantId = parseInt(id);
    const body = await request.json();
    const { nombre, email_contacto, moneda, desactivado } = body;

    const existing = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!existing) return apiError('NOT_FOUND', 'Organización no encontrada', 404);

    const data: any = { updated_at: new Date() };
    if (nombre?.trim()) data.nombre = nombre.trim();
    if (email_contacto?.trim()) data.email_contacto = email_contacto.trim();
    if (moneda?.trim()) data.moneda = moneda.trim();
    if (typeof desactivado === 'boolean') data.desactivado = desactivado;

    const updated = await prisma.tenants.update({
      where: { id: tenantId },
      data,
    });

    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/tenants/[id]', 'PATCH', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { id } = await params;
    const tenantId = parseInt(id);

    // Don't allow deleting own tenant
    if (tenantId === session.tenantId) {
      return apiError('VALIDATION', 'No podés eliminar tu propia organización', 400);
    }

    // Check for data that prevents deletion (RESTRICT FKs: archivos, compras, log_auditoria, proveedores, recepciones, solicitudes)
    const [solicitudes, compras, proveedores] = await Promise.all([
      prisma.solicitudes.count({ where: { tenant_id: tenantId } }),
      prisma.compras.count({ where: { tenant_id: tenantId } }),
      prisma.proveedores.count({ where: { tenant_id: tenantId } }),
    ]);

    if (solicitudes > 0 || compras > 0 || proveedores > 0) {
      return apiError('VALIDATION', 'No se puede eliminar: la organización tiene solicitudes, compras o proveedores. Desactivala en su lugar.', 400);
    }

    // Delete children in correct order (respecting FK constraints), then tenant
    await prisma.$transaction(async (tx) => {
      // Delete records that reference usuarios first
      await tx.codigos_invitacion.deleteMany({ where: { tenant_id: tenantId } });
      const userIds = (await tx.usuarios.findMany({ where: { tenant_id: tenantId }, select: { id: true } })).map(u => u.id);
      if (userIds.length > 0) {
        await tx.usuarios_roles.deleteMany({ where: { usuario_id: { in: userIds } } });
      }
      await tx.comentarios.deleteMany({ where: { tenant_id: tenantId } });
      await tx.notificaciones.deleteMany({ where: { tenant_id: tenantId } });
      await tx.delegaciones.deleteMany({ where: { tenant_id: tenantId } });
      await tx.configuracion.deleteMany({ where: { tenant_id: tenantId } });
      // Clear area responsable FKs before deleting usuarios
      await tx.areas.updateMany({ where: { tenant_id: tenantId }, data: { responsable_id: null } });
      await tx.usuarios.deleteMany({ where: { tenant_id: tenantId } });
      await tx.areas.deleteMany({ where: { tenant_id: tenantId } });
      await tx.centros_costo.deleteMany({ where: { tenant_id: tenantId } });
      await tx.tenants.delete({ where: { id: tenantId } });
    });

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/tenants/[id]', 'DELETE', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
