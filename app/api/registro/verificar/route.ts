import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { notificarAdmins } from '@/lib/notifications';
import { logApiError } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({ token: z.string().min(1) });

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

const AREAS_DEFAULT = ['Dirección'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Token inválido' } },
        { status: 400 },
      );
    }

    const tokenHash = hashToken(parsed.data.token);

    const pending = await prisma.registros_pendientes.findFirst({
      where: { token_hash: tokenHash, verificado: false, expira_el: { gt: new Date() } },
    });

    if (!pending) {
      return Response.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'El enlace es inválido o expiró. Registrate de nuevo.',
          },
        },
        { status: 400 },
      );
    }

    // Double-check email is still unique
    const existingUser = await prisma.usuarios.findFirst({ where: { email: pending.email } });
    if (existingUser) {
      await prisma.registros_pendientes.update({
        where: { id: pending.id },
        data: { verificado: true },
      });
      return Response.json(
        { error: { code: 'CONFLICT', message: 'Este email ya fue registrado.' } },
        { status: 409 },
      );
    }

    // Get roles
    const roles = await prisma.roles.findMany();
    const directorRole = roles.find((r) => r.nombre === 'director');
    const solicitanteRole = roles.find((r) => r.nombre === 'solicitante');
    if (!directorRole || !solicitanteRole) {
      return Response.json(
        { error: { code: 'INTERNAL', message: 'Roles no encontrados. Ejecutá el seed.' } },
        { status: 500 },
      );
    }

    // Generate unique slug
    let slug = slugify(pending.nombre_organizacion);
    const existingSlug = await prisma.tenants.findUnique({ where: { slug } });
    if (existingSlug) {
      const count = await prisma.tenants.count({ where: { slug: { startsWith: slug } } });
      slug = `${slug}-${count + 1}`;
    }

    // Create tenant + founder in transaction
    const txResult = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenants.create({
        data: {
          nombre: pending.nombre_organizacion,
          slug,
          email_contacto: pending.email,
          moneda: 'ARS',
          estado: 'pendiente',
        },
      });

      const areas = await Promise.all(
        AREAS_DEFAULT.map((nombre) =>
          tx.areas.create({ data: { tenant_id: newTenant.id, nombre } }),
        ),
      );
      const areaDireccion = areas[0];

      const usuario = await tx.usuarios.create({
        data: {
          tenant_id: newTenant.id,
          nombre: pending.nombre_usuario,
          email: pending.email,
          password_hash: pending.password_hash,
          area_id: areaDireccion.id,
        },
      });

      await tx.usuarios_roles.createMany({
        data: [
          { usuario_id: usuario.id, rol_id: directorRole.id },
          { usuario_id: usuario.id, rol_id: solicitanteRole.id },
        ],
      });

      await tx.areas.update({
        where: { id: areaDireccion.id },
        data: { responsable_id: usuario.id },
      });

      const emailDomain = pending.email.split('@')[1] ?? '';
      await tx.configuracion.createMany({
        data: [
          { tenant_id: newTenant.id, clave: 'moneda', valor: 'ARS' },
          { tenant_id: newTenant.id, clave: 'umbral_aprobacion_responsable', valor: '0' },
          { tenant_id: newTenant.id, clave: 'umbral_aprobacion_director', valor: '999999999' },
          { tenant_id: newTenant.id, clave: 'sso_dominio', valor: emailDomain },
          { tenant_id: newTenant.id, clave: 'sso_google_habilitado', valor: 'true' },
          { tenant_id: newTenant.id, clave: 'sso_microsoft_habilitado', valor: 'true' },
        ],
      });

      // Mark pending registration as verified
      await tx.registros_pendientes.update({
        where: { id: pending.id },
        data: { verificado: true },
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

    await notificarAdmins(
      'Nueva organización pendiente',
      `"${pending.nombre_organizacion}" se registró y requiere aprobación.`,
    );

    return Response.json(
      {
        message: 'Email verificado. Tu organización fue registrada y está pendiente de aprobación.',
      },
      { status: 201 },
    );
  } catch (error) {
    logApiError('/api/registro/verificar', 'POST', error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
