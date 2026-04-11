import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logApiError } from '@/lib/logger';
import {
  businessDaysBetween,
  buildEmailHtml,
  buildSubject,
  filterSolicitudesForUser,
  shouldSendDigest,
  ROLE_CONFIGS,
} from '@/lib/email-digest';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let emailsSent = 0;
  let skipped = 0;

  try {
    const tenants = await prisma.tenants.findMany({
      where: { estado: 'activo', desactivado: false, slug: { not: '__platform__' } },
      select: { id: true, nombre: true },
    });

    for (const tenant of tenants) {
      for (const config of ROLE_CONFIGS) {
        // Get solicitudes in the relevant state for this role
        const solicitudes = await prisma.solicitudes.findMany({
          where: { tenant_id: tenant.id, estado: config.estado },
          include: {
            area: { select: { id: true, nombre: true } },
            solicitante: { select: { nombre: true } },
            items_solicitud: { select: { precio_estimado: true, cantidad: true } },
          },
          orderBy: { updated_at: 'asc' },
        });

        if (solicitudes.length === 0) continue;

        // Check if any solicitud has been waiting >= 3 business days
        const hasUrgent = solicitudes.some((sol) => {
          const from = sol.fecha_validacion ?? sol.updated_at;
          return businessDaysBetween(from, now) >= 3;
        });

        // Get users with this role for this tenant
        const users = await prisma.usuarios.findMany({
          where: {
            tenant_id: tenant.id,
            activo: true,
            usuarios_roles: { some: { rol: { nombre: config.roleName } } },
          },
          select: { id: true, nombre: true, email: true, email_digest: true, area_id: true },
        });

        for (const user of users) {
          const userSolicitudes = filterSolicitudesForUser(solicitudes, config, user.area_id);
          if (userSolicitudes.length === 0) continue;

          const userHasUrgent = userSolicitudes.some((sol) => {
            const from = sol.fecha_validacion ?? sol.updated_at;
            return businessDaysBetween(from, now) >= 3;
          });

          if (!shouldSendDigest(user.email_digest, userHasUrgent)) {
            skipped++;
            continue;
          }

          const html = buildEmailHtml(user.nombre, userSolicitudes, tenant.nombre, config, APP_URL);
          const subject = buildSubject(userSolicitudes.length, config.heading, userHasUrgent);

          await sendEmail({ to: user.email, subject, html });
          emailsSent++;
        }
      }
    }

    return Response.json({ ok: true, emails_sent: emailsSent, skipped });
  } catch (error) {
    logApiError('/api/cron/email-aprobaciones', 'POST', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
