import bcrypt from 'bcryptjs';
import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/audit';
import { usuarioSchema } from '@/lib/validators';

export const GET = withAdminOverride({ roles: ['admin', 'director'] }, async (request, { session, db, effectiveTenantId }) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50')));

  const [usuarios, total] = await Promise.all([
    db.usuarios.findMany({
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        area: { select: { id: true, nombre: true } },
        usuarios_roles: { include: { rol: { select: { id: true, nombre: true } } } },
        ...(!effectiveTenantId && { tenant: { select: { id: true, nombre: true } } }),
      },
    }),
    db.usuarios.count(),
  ]);

  const data = usuarios.map(u => ({ ...u, password_hash: undefined }));
  return Response.json({ data, total, page, pageSize });
});

export const POST = withAdminOverride({ roles: ['admin', 'director'] }, async (request, { session, effectiveTenantId, ip }) => {
  if (!effectiveTenantId) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } }, { status: 400 });
  }

  const body = await request.json();
  const parsed = validateBody(usuarioSchema, body);
  if (!parsed.success) return parsed.response;

  const { nombre, email, password, area_id, roles: roleNames } = parsed.data;
  if (!password) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'La contraseña es obligatoria para nuevos usuarios' } }, { status: 400 });
  }

  // Directors cannot assign the admin role
  if (roleNames.includes('admin') && !session.roles.includes('admin')) {
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo un administrador de plataforma puede asignar el rol admin' } }, { status: 403 });
  }

  const db = tenantPrisma(effectiveTenantId);

  const existingEmail = await db.usuarios.findFirst({ where: { email } });
  if (existingEmail) return Response.json({ error: { code: 'CONFLICT', message: 'Email ya registrado en esta organización' } }, { status: 409 });

  const area = await db.areas.findFirst({ where: { id: area_id, activo: true } });
  if (!area) return Response.json({ error: { code: 'NOT_FOUND', message: 'Área no encontrada o inactiva' } }, { status: 404 });

  const rolesData = await prisma.roles.findMany({ where: { nombre: { in: roleNames } } });
  if (rolesData.length !== roleNames.length) {
    return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Uno o más roles son inválidos' } }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const usuario = await prisma.$transaction(async (tx) => {
    const newUser = await tx.usuarios.create({
      data: { tenant_id: effectiveTenantId, nombre, email, password_hash: passwordHash, area_id },
    });
    await tx.usuarios_roles.createMany({
      data: rolesData.map(r => ({ usuario_id: newUser.id, rol_id: r.id })),
    });
    // If user has responsable_area role, set them as the area's responsable
    if (roleNames.includes('responsable_area') && area_id) {
      await tx.areas.update({ where: { id: area_id }, data: { responsable_id: newUser.id } });
    }
    return newUser;
  });

  await registrarAuditoria({ tenantId: effectiveTenantId, usuarioId: session.userId, accion: 'crear_usuario', entidad: 'usuario', entidadId: usuario.id, datosNuevos: { nombre, email, roles: roleNames }, ipAddress: ip });

  return Response.json({ ...usuario, password_hash: undefined }, { status: 201 });
});
