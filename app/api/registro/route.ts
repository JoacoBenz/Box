import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registroSchema } from '@/lib/validators';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { logApiError } from '@/lib/logger';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rateLimit = checkRateLimit(`registro:${ip}`, 3, 3_600_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Intentá de nuevo más tarde.' } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const result = registroSchema.safeParse(body);
    if (!result.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } },
        { status: 400 }
      );
    }

    const { nombreOrganizacion, nombreUsuario, email, password } = result.data;

    // Check email uniqueness globally
    const existingUser = await prisma.usuarios.findFirst({ where: { email } });
    if (existingUser) {
      return Response.json(
        { error: { code: 'CONFLICT', message: 'Este email ya está registrado' } },
        { status: 409 }
      );
    }

    // Generate unique slug
    let slug = slugify(nombreOrganizacion);
    const existingSlug = await prisma.tenants.findUnique({ where: { slug } });
    if (existingSlug) {
      const count = await prisma.tenants.count({ where: { slug: { startsWith: slug } } });
      slug = `${slug}-${count + 1}`;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Get all roles
    const roles = await prisma.roles.findMany();
    const adminRole = roles.find(r => r.nombre === 'admin');
    const directorRole = roles.find(r => r.nombre === 'director');
    if (!adminRole || !directorRole) {
      return Response.json({ error: { code: 'INTERNAL', message: 'Roles no encontrados. Ejecutá el seed.' } }, { status: 500 });
    }

    const AREAS_DEFAULT = ['Administración', 'Operaciones', 'Finanzas', 'Recursos Humanos', 'Logística'];

    // Atomic transaction
    const txResult = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenants.create({
        data: { nombre: nombreOrganizacion, slug, email_contacto: email, moneda: 'ARS' },
      });

      // Create default areas
      const areas = await Promise.all(
        AREAS_DEFAULT.map(nombre => tx.areas.create({ data: { tenant_id: newTenant.id, nombre } }))
      );
      const areaDireccion = areas[0];

      // Create admin user
      const usuario = await tx.usuarios.create({
        data: {
          tenant_id: newTenant.id,
          nombre: nombreUsuario,
          email,
          password_hash: passwordHash,
          area_id: areaDireccion.id,
        },
      });

      // Assign admin + director roles
      await tx.usuarios_roles.createMany({
        data: [
          { usuario_id: usuario.id, rol_id: adminRole.id },
          { usuario_id: usuario.id, rol_id: directorRole.id },
        ],
      });

      // Set user as area responsable
      await tx.areas.update({
        where: { id: areaDireccion.id },
        data: { responsable_id: usuario.id },
      });

      // Initial config
      await tx.configuracion.createMany({
        data: [
          { tenant_id: newTenant.id, clave: 'moneda', valor: 'ARS' },
          { tenant_id: newTenant.id, clave: 'umbral_aprobacion_responsable', valor: '0' },
          { tenant_id: newTenant.id, clave: 'umbral_aprobacion_director', valor: '999999999' },
        ],
      });

      return { tenant: newTenant, usuarioId: usuario.id };
    });

    await registrarAuditoria({
      tenantId: txResult.tenant.id,
      usuarioId: txResult.usuarioId,
      accion: 'registro_organizacion',
      entidad: 'tenant',
      entidadId: txResult.tenant.id,
      ipAddress: getClientIp(request),
    });

    return Response.json({ message: 'Organización registrada exitosamente' }, { status: 201 });
  } catch (error) {
    logApiError('/api/registro', 'POST', error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } }, { status: 500 });
  }
}
