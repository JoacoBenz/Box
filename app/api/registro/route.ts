import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registroSchema } from '@/lib/validators';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { logApiError } from '@/lib/logger';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitDb(`registro:${ip}`, 3, 3_600_000);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiados intentos. Intentá de nuevo más tarde.',
          },
        },
        { status: 429 },
      );
    }

    const body = await request.json();
    const result = registroSchema.safeParse(body);
    if (!result.success) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: result.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { nombreOrganizacion, nombreUsuario, email, password } = result.data;

    // Check email uniqueness in existing users
    const existingUser = await prisma.usuarios.findFirst({ where: { email } });
    if (existingUser) {
      return Response.json(
        { error: { code: 'CONFLICT', message: 'Este email ya está registrado' } },
        { status: 409 },
      );
    }

    // Check for non-expired pending registration with same email
    const existingPending = await prisma.registros_pendientes.findFirst({
      where: { email, verificado: false, expira_el: { gt: new Date() } },
    });
    if (existingPending) {
      return Response.json(
        {
          error: {
            code: 'CONFLICT',
            message:
              'Ya hay un registro pendiente de verificación para este email. Revisá tu bandeja de entrada.',
          },
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const token = generateToken();
    const tokenHash = hashToken(token);

    await prisma.registros_pendientes.create({
      data: {
        token_hash: tokenHash,
        nombre_organizacion: nombreOrganizacion,
        nombre_usuario: nombreUsuario,
        email,
        password_hash: passwordHash,
        expira_el: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
      },
    });

    const verifyUrl = `${APP_URL}/verificar-email?token=${token}`;

    try {
      await sendEmail({
        to: email,
        subject: 'Verificá tu email — Gestión de Compras',
        html: `
        <h2>Hola ${nombreUsuario},</h2>
        <p>Gracias por registrar <strong>${nombreOrganizacion}</strong>.</p>
        <p>Para completar el registro, verificá tu email:</p>
        <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0891b2;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Verificar email</a></p>
        <p>Este enlace expira en 24 horas.</p>
      `,
      });
    } catch (emailError) {
      // Email failed: roll back the pending registration so the user can retry
      // immediately instead of being locked out by the "pending" check for 24h.
      logApiError('/api/registro', 'POST:sendEmail', emailError);
      await prisma.registros_pendientes
        .deleteMany({ where: { token_hash: tokenHash } })
        .catch((cleanupError) => logApiError('/api/registro', 'POST:cleanup', cleanupError));
      return Response.json(
        {
          error: {
            code: 'EMAIL_FAILED',
            message:
              'No pudimos enviar el email de verificación. Intentá de nuevo en unos minutos.',
          },
        },
        { status: 502 },
      );
    }

    return Response.json(
      { message: 'Te enviamos un email de verificación. Revisá tu bandeja de entrada.' },
      { status: 201 },
    );
  } catch (error) {
    logApiError('/api/registro', 'POST', error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
