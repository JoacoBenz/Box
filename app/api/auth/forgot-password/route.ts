import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { generateToken, hashToken } from '@/lib/tokens';
import { sendEmail } from '@/lib/email';
import { logApiError } from '@/lib/logger';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email inválido' } },
        { status: 400 },
      );
    }

    const { email } = parsed.data;

    const rateLimit = await checkRateLimitDb(`forgot:${email}`, 3, 3_600_000);
    if (!rateLimit.allowed) {
      // Still return success to not reveal rate limiting per email
      return Response.json({
        message:
          'Si el email está registrado, te enviamos un enlace para restablecer tu contraseña.',
      });
    }

    const usuario = await prisma.usuarios.findFirst({
      where: { email, activo: true },
      select: { id: true, nombre: true, password_hash: true },
    });

    if (usuario) {
      const token = generateToken();
      const tokenHash = hashToken(token);

      await prisma.tokens_password_reset.create({
        data: {
          email,
          token_hash: tokenHash,
          expira_el: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        },
      });

      const resetUrl = `${APP_URL}/restablecer?token=${token}`;

      if (usuario.password_hash) {
        await sendEmail({
          to: email,
          subject: 'Restablecé tu contraseña — Gestión de Compras',
          html: `
            <h2>Hola ${usuario.nombre},</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña.</p>
            <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Restablecer contraseña</a></p>
            <p>Este enlace expira en 1 hora.</p>
            <p>Si no solicitaste esto, ignorá este email.</p>
          `,
        });
      } else {
        await sendEmail({
          to: email,
          subject: 'Solicitud de restablecimiento — Gestión de Compras',
          html: `
            <h2>Hola ${usuario.nombre},</h2>
            <p>Recibimos una solicitud para restablecer tu contraseña, pero tu cuenta usa inicio de sesión con Google o Microsoft (SSO).</p>
            <p>No necesitás una contraseña — ingresá usando el botón de Google o Microsoft en la página de login.</p>
            <p>Si no solicitaste esto, ignorá este email.</p>
          `,
        });
      }
    }

    return Response.json({
      message: 'Si el email está registrado, te enviamos un enlace para restablecer tu contraseña.',
    });
  } catch (error) {
    logApiError('/api/auth/forgot-password', 'POST', error);
    return Response.json({
      message: 'Si el email está registrado, te enviamos un enlace para restablecer tu contraseña.',
    });
  }
}
