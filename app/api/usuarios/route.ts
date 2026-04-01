import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { usuarioSchema } from '@/lib/validators';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50')));

    const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;
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
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    if (!verificarRol(session.roles, ['admin', 'director'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
    }
    if (!effectiveTenantId) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } }, { status: 400 });
    }

    const body = await request.json();
    const result = usuarioSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const { nombre, email, password, area_id, roles: roleNames } = result.data;
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

    await registrarAuditoria({ tenantId: effectiveTenantId, usuarioId: session.userId, accion: 'crear_usuario', entidad: 'usuario', entidadId: usuario.id, datosNuevos: { nombre, email, roles: roleNames }, ipAddress: getClientIp(request) });

    return Response.json({ ...usuario, password_hash: undefined }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
