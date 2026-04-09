import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { logApiError } from '@/lib/logger';
import { sendEmail } from '@/lib/email';

const ESTADOS_VALIDOS = ['activo', 'rechazado', 'suspendido'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['super_admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const { id } = await params;
    const tenantId = parseInt(id);
    const body = await request.json();

    const existing = await prisma.tenants.findUnique({ where: { id: tenantId } });
    if (!existing) return apiError('NOT_FOUND', 'Organización no encontrada', 404);

    // Estado change flow (used by aprobaciones-org page)
    if (body.estado && ESTADOS_VALIDOS.includes(body.estado)) {
      if (tenantId === session.tenantId) {
        return apiError('VALIDATION_ERROR', 'No podés cambiar el estado de tu propia organización', 400);
      }

      const updated = await prisma.tenants.update({
        where: { id: tenantId },
        data: { estado: body.estado },
      });

      await registrarAuditoria({
        tenantId: session.tenantId,
        usuarioId: session.userId,
        accion: `cambiar_estado_tenant_${body.estado}`,
        entidad: 'tenant',
        entidadId: tenantId,
        datosAnteriores: { estado: existing.estado },
        datosNuevos: { estado: body.estado },
        ipAddress: getClientIp(request),
      });

      if (body.estado === 'activo' && existing.email_contacto) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.box.com';
        sendEmail({
          to: existing.email_contacto,
          subject: 'Tu organización fue aprobada — Gestión de Compras',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #16a34a;">¡Tu organización fue aprobada!</h2>
              <p>Hola,</p>
              <p>Nos complace informarte que tu organización <strong>${existing.nombre}</strong> fue aprobada y ya se encuentra activa en nuestra plataforma.</p>
              <p>Ya podés iniciar sesión y comenzar a gestionar tus compras.</p>
              <a href="${appUrl}/login" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 16px;">Iniciar sesión</a>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Si tenés alguna consulta, no dudes en contactarnos.</p>
            </div>
          `,
        }).catch(() => {});
      }

      return Response.json(updated);
    }

    // General edit flow (used by organizaciones page)
    const { nombre, email_contacto, moneda, desactivado } = body;
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
    if (!verificarRol(session.roles, ['super_admin'])) {
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
      await tx.log_auditoria.deleteMany({ where: { tenant_id: tenantId } });
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
