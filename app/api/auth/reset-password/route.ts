import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';
import { passwordSchema } from '@/lib/validators';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import { logApiError } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitDb(`reset:${ip}`, 10, 3_600_000);
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos',
            details: parsed.error.issues.map((i) => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
        },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;
    const tokenHash = hashToken(token);

    const passwordHash = await bcrypt.hash(password, 12);

    // Atomic token consumption: mark as used and get email in one operation
    // Prevents race condition where two requests could use the same token
    const consumed = await prisma.$queryRaw<{ email: string }[]>`
      UPDATE tokens_password_reset
      SET usado = true
      WHERE token_hash = ${tokenHash}
        AND usado = false
        AND expira_el > NOW()
      RETURNING email
    `;

    if (consumed.length === 0) {
      return Response.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'El enlace es inválido o expiró. Solicitá uno nuevo.',
          },
        },
        { status: 400 },
      );
    }

    await prisma.usuarios.updateMany({
      where: { email: consumed[0].email, activo: true },
      data: { password_hash: passwordHash },
    });

    return Response.json({ message: 'Tu contraseña fue restablecida. Ya podés iniciar sesión.' });
  } catch (error) {
    logApiError('/api/auth/reset-password', 'POST', error);
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Error interno del servidor' } },
      { status: 500 },
    );
  }
}
