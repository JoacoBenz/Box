import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { logApiError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitDb(`verificar-unirse:${ip}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMITED', message: 'Demasiados intentos' } },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { token } = body;
    if (!token || typeof token !== 'string') {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Token inválido' } },
        { status: 400 },
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Atomic: mark token as used and return user info
    const consumed = await prisma.$queryRaw<{ usuario_id: number }[]>`
      UPDATE tokens_verificacion_email
      SET usado = true
      WHERE token_hash = ${tokenHash} AND usado = false AND expira_el > NOW()
      RETURNING usuario_id
    `;

    if (consumed.length === 0) {
      return Response.json(
        {
          error: { code: 'NOT_FOUND', message: 'Enlace inválido o expirado. Registrate de nuevo.' },
        },
        { status: 404 },
      );
    }

    const { usuario_id } = consumed[0];

    // Activate the user
    await prisma.usuarios.update({
      where: { id: usuario_id },
      data: { activo: true },
    });

    const usuario = await prisma.usuarios.findUnique({
      where: { id: usuario_id },
      select: { tenant_id: true, nombre: true, email: true },
    });

    if (usuario) {
      await registrarAuditoria({
        tenantId: usuario.tenant_id,
        usuarioId: usuario_id,
        accion: 'verificar_email_empleado',
        entidad: 'usuario',
        entidadId: usuario_id,
        datosNuevos: { email: usuario.email },
        ipAddress: ip,
      });
    }

    return Response.json({
      message: 'Email verificado. Ya podés ingresar con tu cuenta.',
    });
  } catch (error) {
    logApiError('/api/unirse/verificar', 'POST', error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
