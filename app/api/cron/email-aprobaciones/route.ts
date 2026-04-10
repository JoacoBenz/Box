import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { logApiError } from '@/lib/logger';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Count business days (Mon-Fri) between two dates.
 */
function businessDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function formatMonto(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const URGENCIA_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  baja: { bg: '#f0fdf4', text: '#16a34a', label: 'Baja' },
  normal: { bg: '#eff6ff', text: '#2563eb', label: 'Normal' },
  media: { bg: '#fefce8', text: '#ca8a04', label: 'Media' },
  alta: { bg: '#fef2f2', text: '#dc2626', label: 'Alta' },
  critica: { bg: '#fef2f2', text: '#dc2626', label: 'Critica' },
};

interface SolicitudRow {
  id: number;
  numero: string;
  titulo: string;
  urgencia: string;
  fecha_validacion: Date | null;
  area: { nombre: string } | null;
  solicitante: { nombre: string };
  items_solicitud: { precio_estimado: any; cantidad: any }[];
}

function buildEmailHtml(directorName: string, solicitudes: SolicitudRow[], tenantNombre: string): string {
  let montoTotal = 0;

  const rows = solicitudes.map((sol) => {
    const monto = sol.items_solicitud.reduce(
      (sum, it) => sum + (it.precio_estimado ? Number(it.precio_estimado) * Number(it.cantidad) : 0),
      0
    );
    montoTotal += monto;

    const urg = URGENCIA_COLORS[sol.urgencia] ?? URGENCIA_COLORS.normal;
    const diasHabiles = sol.fecha_validacion ? businessDaysBetween(sol.fecha_validacion, new Date()) : 0;
    const urgente = diasHabiles >= 3;

    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600; color: #4f46e5; font-size: 13px; white-space: nowrap;">
          ${sol.numero}
          ${urgente ? `<br><span style="color: #dc2626; font-size: 11px; font-weight: 700;">⏰ ${diasHabiles}d</span>` : ''}
        </td>
        <td style="padding: 12px 8px;">
          <div style="font-weight: 600; font-size: 14px; color: #1f2937;">${sol.titulo}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
            ${sol.area?.nombre ?? '—'} · ${sol.solicitante.nombre}
          </div>
        </td>
        <td style="padding: 12px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${urg.bg}; color: ${urg.text};">
            ${urg.label}
          </span>
        </td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; font-size: 14px; color: #1f2937; white-space: nowrap;">
          ${formatMonto(monto)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px 16px 0 0; padding: 24px; text-align: center;">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 8px 12px; margin-bottom: 12px;">
            <span style="font-size: 20px;">📦</span>
            <span style="color: white; font-weight: 800; font-size: 16px; margin-left: 4px;">Box</span>
          </div>
          <h1 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">
            Tenés ${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} para aprobar
          </h1>
          <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 8px 0 0;">
            ${tenantNombre}
          </p>
        </div>

        <!-- Body -->
        <div style="background: white; padding: 24px; border-radius: 0 0 16px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
            Hola <strong>${directorName}</strong>, estas solicitudes ya fueron validadas por los responsables de área y esperan tu aprobación:
          </p>

          <!-- Table -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">#</th>
                  <th style="padding: 10px 8px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Solicitud</th>
                  <th style="padding: 10px 8px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Urgencia</th>
                  <th style="padding: 10px 8px; text-align: right; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Monto</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
              <tfoot>
                <tr style="background: #f9fafb; border-top: 2px solid #e5e7eb;">
                  <td colspan="3" style="padding: 14px 8px; font-weight: 700; font-size: 15px; color: #374151;">
                    Total estimado
                  </td>
                  <td style="padding: 14px 8px; text-align: right; font-weight: 800; font-size: 16px; color: #4f46e5;">
                    ${formatMonto(montoTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin-top: 28px;">
            <a href="${APP_URL}/aprobaciones"
               style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(79,70,229,0.3);">
              Ir a Aprobaciones →
            </a>
          </div>

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este email fue enviado automáticamente por Box — Gestión de Compras.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">
              Podés desactivar estos recordatorios desde tu <a href="${APP_URL}/perfil" style="color: #4f46e5;">perfil</a>.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  let emailsSent = 0;
  let skipped = 0;

  try {
    // Get all active tenants (exclude platform)
    const tenants = await prisma.tenants.findMany({
      where: { estado: 'activo', desactivado: false, slug: { not: '__platform__' } },
      select: { id: true, nombre: true },
    });

    for (const tenant of tenants) {
      // Get all solicitudes in estado 'validada' for this tenant
      const solicitudes = await prisma.solicitudes.findMany({
        where: { tenant_id: tenant.id, estado: 'validada' },
        include: {
          area: { select: { nombre: true } },
          solicitante: { select: { nombre: true } },
          items_solicitud: { select: { precio_estimado: true, cantidad: true } },
        },
        orderBy: { fecha_validacion: 'asc' },
      });

      if (solicitudes.length === 0) continue;

      // Check if any solicitud has been waiting >= 3 business days
      const hasUrgent = solicitudes.some((sol) => {
        const from = sol.fecha_validacion ?? sol.updated_at;
        return businessDaysBetween(from, now) >= 3;
      });

      // Get all directors for this tenant
      const directors = await prisma.usuarios.findMany({
        where: {
          tenant_id: tenant.id,
          activo: true,
          usuarios_roles: { some: { rol: { nombre: 'director' } } },
        },
        select: { id: true, nombre: true, email: true, email_digest: true },
      });

      for (const director of directors) {
        // Skip if digest disabled AND no urgent solicitudes
        if (!director.email_digest && !hasUrgent) {
          skipped++;
          continue;
        }

        const html = buildEmailHtml(director.nombre, solicitudes, tenant.nombre);
        const subject = hasUrgent
          ? `Box — ⚠️ ${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} pendiente${solicitudes.length !== 1 ? 's' : ''} de aprobación`
          : `Box — 📋 ${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} para aprobar`;

        await sendEmail({ to: director.email, subject, html });
        emailsSent++;
      }
    }

    return Response.json({ ok: true, emails_sent: emailsSent, skipped });
  } catch (error) {
    logApiError('/api/cron/email-aprobaciones', 'POST', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
