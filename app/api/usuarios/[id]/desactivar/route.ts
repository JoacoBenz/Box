import { withAdminOverride } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';

export const PATCH = withAdminOverride({ roles: ['admin', 'director'] }, async (request, { session, db, ip, effectiveTenantId }, params) => {
  const userId = parseInt(params.id);

  const usuario = await db.usuarios.findFirst({ where: { id: userId }, include: { usuarios_roles: { include: { rol: true } } } });
  if (!usuario) return Response.json({ error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const nuevoActivo = typeof body.activo === 'boolean' ? body.activo : !usuario.activo;

  // Directors cannot deactivate/activate admin users
  const targetIsAdmin = usuario.usuarios_roles.some(ur => ur.rol.nombre === 'admin');
  if (targetIsAdmin && !session.roles.includes('admin')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo un administrador de plataforma puede modificar usuarios admin' } }, { status: 403 });
  }

  // Only check last-admin constraint when deactivating
  if (!nuevoActivo) {
    if (targetIsAdmin) {
      const adminCount = await prisma.usuarios.count({
        where: { tenant_id: session.tenantId, activo: true, usuarios_roles: { some: { rol: { nombre: 'admin' } } } },
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
