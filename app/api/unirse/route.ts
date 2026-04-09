import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { unirseSchema } from '@/lib/validators';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { notificarPorRol } from '@/lib/notifications';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { logApiError } from '@/lib/logger';

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitDb(`unirse:${ip}`, 5, 3_600_000);
    if (!rateLimit.allowed) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Intentá de nuevo más tarde.' } }, { status: 429 });
    }

    const body = await request.json();
    const result = unirseSchema.safeParse(body);
    if (!result.success) {
      return Response.json({
        error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) },
      }, { status: 400 });
    }

    const { nombre, email, password, area_texto, codigo } = result.data;

    // Resolve tenant
    let tenantId: number | null = null;

    if (codigo) {
      // Invitation code flow
      const inv = await prisma.codigos_invitacion.findFirst({
        where: { codigo, activo: true, expira_el: { gt: new Date() } },
      });
      if (!inv) {
        return Response.json({ error: { code: 'NOT_FOUND', message: 'Código de invitación inválido o expirado' } }, { status: 404 });
      }
      if (inv.max_usos && inv.usos >= inv.max_usos) {
        return Response.json({ error: { code: 'CONFLICT', message: 'Este código ya alcanzó el máximo de usos' } }, { status: 409 });
      }
      tenantId = inv.tenant_id;
    } else {
      // Domain matching flow
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Email inválido' } }, { status: 400 });
      }

      const config = await prisma.configuracion.findFirst({
        where: { clave: 'sso_dominio', valor: domain },
      });
      if (config) {
        const tenant = await prisma.tenants.findFirst({
          where: { id: config.tenant_id, estado: 'activo', desactivado: false },
        });
        if (tenant) tenantId = tenant.id;
      }
    }

    if (!tenantId) {
      return Response.json({
        error: { code: 'NOT_FOUND', message: 'No se encontró una organización para tu email. Pedile un código de invitación a tu organización.' },
      }, { status: 404 });
    }

    // Verify tenant is active
    const tenant = await prisma.tenants.findFirst({
      where: { id: tenantId, estado: 'activo', desactivado: false },
    });
    if (!tenant) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'La organización no está activa' } }, { status: 404 });
    }

    // Check email uniqueness in tenant
    const existingUser = await prisma.usuarios.findFirst({
      where: { tenant_id: tenantId, email },
    });
    if (existingUser) {
      return Response.json({ error: { code: 'CONFLICT', message: 'Ya existe un usuario con este email en la organización' } }, { status: 409 });
    }

    // Fuzzy match area
    const areas = await prisma.areas.findMany({
      where: { tenant_id: tenantId, activo: true },
      select: { id: true, nombre: true },
    });

    const areaTextoNorm = normalizar(area_texto);
    let matchedAreaId: number | null = null;

    for (const area of areas) {
      const areaNorm = normalizar(area.nombre);
      if (areaNorm === areaTextoNorm || areaNorm.includes(areaTextoNorm) || areaTextoNorm.includes(areaNorm)) {
        matchedAreaId = area.id;
        break;
      }
    }

    // Get solicitante role
    const solicitanteRole = await prisma.roles.findFirst({ where: { nombre: 'solicitante' } });
    if (!solicitanteRole) {
      return Response.json({ error: { code: 'INTERNAL', message: 'Rol solicitante no encontrado' } }, { status: 500 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user in transaction
    const usuario = await prisma.$transaction(async (tx) => {
      const newUser = await tx.usuarios.create({
        data: {
          tenant_id: tenantId!,
          nombre,
          email,
          password_hash: passwordHash,
          area_id: matchedAreaId,
          area_sugerida: matchedAreaId ? null : area_texto,
        },
      });

      await tx.usuarios_roles.create({
        data: { usuario_id: newUser.id, rol_id: solicitanteRole.id },
      });

      // Increment invitation code usage
      if (codigo) {
        await tx.codigos_invitacion.updateMany({
          where: { codigo },
          data: { usos: { increment: 1 } },
        });
      }

      return newUser;
    });

    // Notify admins if area was not matched
    if (!matchedAreaId) {
      await notificarPorRol(
        tenantId,
        'admin',
        `Nuevo empleado sugiere área "${area_texto}"`,
        `${nombre} (${email}) se registró y sugirió el área "${area_texto}". Podés crearla desde Administración > Áreas y luego asignar al usuario.`,
      );
    }

    await registrarAuditoria({
      tenantId,
      usuarioId: usuario.id,
      accion: 'registro_empleado',
      entidad: 'usuario',
      entidadId: usuario.id,
      datosNuevos: { nombre, email, area_texto, metodo: codigo ? 'codigo_invitacion' : 'dominio' },
      ipAddress: getClientIp(request),
    });

    return Response.json({
      message: matchedAreaId
        ? 'Cuenta creada exitosamente. Ya podés ingresar.'
        : 'Cuenta creada exitosamente. Tu área sugerida fue enviada al administrador para su revisión. Ya podés ingresar.',
    }, { status: 201 });
  } catch (error) {
    logApiError('/api/unirse', 'POST', error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } }, { status: 500 });
  }
}
