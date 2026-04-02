import bcrypt from 'bcryptjs';
import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { usuarioSchema } from '@/lib/validators';
import { invalidateCache } from '@/lib/cache';

export const PATCH = withAdminOverride({ roles: ['admin', 'director'] }, async (request, { session, db, ip, effectiveTenantId }, params) => {
  const userId = parseInt(params.id);

  const usuario = await db.usuarios.findFirst({ where: { id: userId }, include: { usuarios_roles: { include: { rol: true } } } });
  if (!usuario) return Response.json({ error: { code: 'NOT_FOUND', message: 'Usuario no encontrado' } }, { status: 404 });

  const body = await request.json();
  const parsed = validateBody(usuarioSchema, body);
  if (!parsed.success) return parsed.response;

  const { nombre, email, password, area_id, roles: roleNames } = parsed.data;

  // Directors cannot assign or remove the admin role
  const isAdmin = session.roles.includes('admin');
  const targetHasAdmin = usuario.usuarios_roles.some(ur => ur.rol.nombre === 'admin');
  if (!isAdmin) {
    if (roleNames.includes('admin')) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo un administrador de plataforma puede asignar el rol admin' } }, { status: 403 });
    }
    if (targetHasAdmin) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'No podés editar un usuario con rol admin' } }, { status: 403 });
    }
  }

  if (email !== usuario.email) {
    const existing = await db.usuarios.findFirst({ where: { email } });
    if (existing) return Response.json({ error: { code: 'CONFLICT', message: 'Email ya en uso' } }, { status: 409 });
  }

  const area = await db.areas.findFirst({ where: { id: area_id, activo: true } });
  if (!area) return Response.json({ error: { code: 'NOT_FOUND', message: 'Área no encontrada' } }, { status: 404 });

  // Prevent removing last admin
  const currentRoles = usuario.usuarios_roles.map(ur => ur.rol.nombre);
  if (currentRoles.includes('admin') && !roleNames.includes('admin')) {
    const adminCount = await prisma.usuarios.count({
      where: { tenant_id: session.tenantId, activo: true, usuarios_roles: { some: { rol: { nombre: 'admin' } } } },
    });
    if (adminCount <= 1) {
      return Response.json({ error: { code: 'CONFLICT', message: 'No podés quitar el rol admin al único administrador' } }, { status: 409 });
    }
  }

  const rolesData = await prisma.roles.findMany({ where: { nombre: { in: roleNames } } });

  const updateData: { nombre: string; email: string; area_id: number; password_hash?: string } = { nombre, email, area_id };
  if (password) updateData.password_hash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.usuarios.update({ where: { id: userId }, data: updateData });
    await tx.usuarios_roles.deleteMany({ where: { usuario_id: userId } });
    await tx.usuarios_roles.createMany({ data: rolesData.map(r => ({ usuario_id: userId, rol_id: r.id })) });
    // If user has responsable_area role, set them as the area's responsable
    if (roleNames.includes('responsable_area') && area_id) {
      await tx.areas.update({ where: { id: area_id }, data: { responsable_id: userId } });
    }
    // If user lost responsable_area role, clear them from the area's responsable_id
    if (!roleNames.includes('responsable_area') && area_id) {
      const currentArea = await tx.areas.findFirst({ where: { id: area_id, responsable_id: userId } });
      if (currentArea) {
        await tx.areas.update({ where: { id: area_id }, data: { responsable_id: null } });
      }
    }
  });

  // Invalidate cached roles for the edited user
  invalidateCache(`t:${session.tenantId}:roles:${userId}`);

  await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'editar_usuario', entidad: 'usuario', entidadId: userId, ipAddress: ip });

  return Response.json({ message: 'Usuario actualizado' });
});
