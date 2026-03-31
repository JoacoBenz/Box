import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';

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
    console.error('Error updating tenant:', error);
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

    // Delete cascadeable children first, then tenant
    await prisma.$transaction([
      prisma.usuarios.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.areas.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.centros_costo.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.configuracion.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.delegaciones.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.notificaciones.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.comentarios.deleteMany({ where: { tenant_id: tenantId } }),
      prisma.tenants.delete({ where: { id: tenantId } }),
    ]);

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    console.error('Error deleting tenant:', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
