import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession();

    const usuario = await prisma.usuarios.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        nombre: true,
        email: true,
        password_hash: true,
        area: { select: { nombre: true } },
        tenant: { select: { nombre: true } },
        usuarios_roles: {
          select: { rol: { select: { nombre: true } } },
        },
      },
    });

    if (!usuario) return apiError('NOT_FOUND', 'Usuario no encontrado', 404);

    return Response.json({
      nombre: usuario.nombre,
      email: usuario.email,
      area: usuario.area?.nombre ?? null,
      organizacion: usuario.tenant?.nombre ?? null,
      roles: usuario.usuarios_roles.map(ur => ur.rol.nombre),
      tienePassword: !!usuario.password_hash,
    });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    const { nombre, passwordActual, passwordNuevo } = body;

    const updateData: Record<string, any> = {};

    if (nombre && typeof nombre === 'string' && nombre.trim()) {
      updateData.nombre = nombre.trim();
    }

    if (passwordNuevo) {
      const usuario = await prisma.usuarios.findUnique({
        where: { id: session.userId },
        select: { password_hash: true, usuarios_roles: { select: { rol: { select: { nombre: true } } } } },
      });

      const isAdmin = usuario?.usuarios_roles?.some(ur => ur.rol.nombre === 'admin');

      if (!usuario?.password_hash && !isAdmin) {
        return apiError('VALIDATION_ERROR', 'No se puede cambiar la contraseña de cuentas SSO', 400);
      }

      if (usuario?.password_hash) {
        if (!passwordActual) {
          return apiError('VALIDATION_ERROR', 'Debe ingresar la contraseña actual', 400);
        }
        const valid = await bcrypt.compare(passwordActual, usuario.password_hash);
        if (!valid) {
          return apiError('VALIDATION_ERROR', 'Contraseña actual incorrecta', 400);
        }
      }

      if (passwordNuevo.length < 8) {
        return apiError('VALIDATION_ERROR', 'La nueva contraseña debe tener al menos 8 caracteres', 400);
      }

      updateData.password_hash = await bcrypt.hash(passwordNuevo, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return apiError('VALIDATION_ERROR', 'No hay datos para actualizar', 400);
    }

    await prisma.usuarios.update({
      where: { id: session.userId },
      data: updateData,
    });

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
