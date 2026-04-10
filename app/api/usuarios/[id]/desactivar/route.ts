import { withAdminOverride, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { isOnlyResponsable } from '@/lib/permissions';

export const PATCH = withAdminOverride({ roles: ['admin', 'director', 'responsable_area'] }, async (request, { session, db, ip, effectiveTenantId }, params) => {
  const userId = parseId(params.id);
  if (!userId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 });

  const usuario = await db.usuarios.findFirst({ where: { id: userId }, include: { usuarios_roles: { include: { rol: true } } } });
  if (!usuario) return Response.json({ error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const nuevoActivo = typeof body.activo === 'boolean' ? body.activo : !usuario.activo;

  // Responsable de área: can only deactivate solicitantes in their area
  if (isOnlyResponsable(session.roles)) {
    if (usuario.area_id !== session.areaId) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo podés modificar usuarios de tu área' } }, { status: 403 });
    }
    const targetRoles = usuario.usuarios_roles.map(ur => ur.rol.nombre);
    if (targetRoles.some(r => r !== 'solicitante')) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo podés modificar usuarios con rol solicitante' } }, { status: 403 });
    }
  }

  // Directors cannot deactivate/activate admin users
  const targetIsAdmin = usuario.usuarios_roles.some(ur => ur.rol.nombre === 'admin');
  if (targetIsAdmin && !session.roles.includes('admin') && !session.roles.includes('super_admin')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo un administrador de plataforma puede modificar usuarios admin' } }, { status: 403 });
  }

  // Only check last-admin constraint when deactivating
  if (!nuevoActivo) {
    if (targetIsAdmin) {
      const adminCount = await prisma.usuarios.count({
        where: { tenant_id: effectiveTenantId ?? session.tenantId, activo: true, usuarios_roles: { some: { rol: { nombre: 'admin' } } } },
      });
      if (adminCount <= 1) {
        return Response.json({ error: { code: 'CONFLICT', message: 'No podés desactivar al único administrador' } }, { status: 409 });
      }
    }
  }

  await db.usuarios.update({ where: { id: userId }, data: { activo: nuevoActivo } });
  const accion = nuevoActivo ? 'activar_usuario' : 'desactivar_usuario';
  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion, entidad: 'usuario', entidadId: userId, ipAddress: ip });

  return Response.json({ message: nuevoActivo ? 'Usuario activado' : 'Usuario desactivado' });
});
