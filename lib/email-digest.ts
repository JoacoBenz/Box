/**
 * Shared logic for email digest — exported for testability.
 */

export function businessDaysBetween(from: Date, to: Date): number {
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

export function formatMonto(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const URGENCIA_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  baja: { bg: '#f0fdf4', text: '#16a34a', label: 'Baja' },
  normal: { bg: '#eff6ff', text: '#2563eb', label: 'Normal' },
  media: { bg: '#fefce8', text: '#ca8a04', label: 'Media' },
  alta: { bg: '#fef2f2', text: '#dc2626', label: 'Alta' },
  critica: { bg: '#fef2f2', text: '#dc2626', label: 'Critica' },
};

export interface SolicitudRow {
  id: number;
  numero: string;
  titulo: string;
  urgencia: string;
  fecha_validacion: Date | null;
  updated_at: Date;
  area: { id?: number; nombre: string } | null;
  solicitante: { nombre: string };
  items_solicitud: { precio_estimado: any; cantidad: any }[];
}

export interface RoleDigestConfig {
  roleName: string;
  estado: string;
  heading: string;
  ctaPath: string;
  ctaLabel: string;
  filterByArea: boolean;
}

export const ROLE_CONFIGS: RoleDigestConfig[] = [
  {
    roleName: 'responsable_area',
    estado: 'pendiente_validacion',
    heading: 'para validar',
    ctaPath: '/solicitudes',
    ctaLabel: 'Ir a Solicitudes',
    filterByArea: true,
  },
  {
    roleName: 'director',
    estado: 'validada',
    heading: 'para aprobar',
    ctaPath: '/aprobaciones',
    ctaLabel: 'Ir a Aprobaciones',
    filterByArea: false,
  },
  {
    roleName: 'compras',
    estado: 'aprobada',
    heading: 'para procesar',
    ctaPath: '/compras',
    ctaLabel: 'Ir a Compras',
    filterByArea: false,
  },
  {
    roleName: 'tesoreria',
    estado: 'pago_programado',
    heading: 'para ejecutar pago',
    ctaPath: '/tesoreria',
    ctaLabel: 'Ir a Tesorería',
    filterByArea: false,
  },
];

export function computeMonto(items: { precio_estimado: any; cantidad: any }[]): number {
  return items.reduce(
    (sum, it) => sum + (it.precio_estimado ? Number(it.precio_estimado) * Number(it.cantidad) : 0),
    0,
  );
}

export function buildEmailHtml(
  recipientName: string,
  solicitudes: SolicitudRow[],
  tenantNombre: string,
  config: RoleDigestConfig,
  appUrl: string = 'http://localhost:3000',
): string {
  let montoTotal = 0;
  const now = new Date();

  const rows = solicitudes.map((sol) => {
    const monto = computeMonto(sol.items_solicitud);
    montoTotal += monto;

    const urg = URGENCIA_COLORS[sol.urgencia] ?? URGENCIA_COLORS.normal;
    const dateRef = sol.fecha_validacion ?? sol.updated_at;
    const diasHabiles = businessDaysBetween(dateRef, now);
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

  const count = solicitudes.length;
  const plural = count !== 1;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
        <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px 16px 0 0; padding: 24px; text-align: center;">
          <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 8px 12px; margin-bottom: 12px;">
            <span style="font-size: 20px;">📦</span>
            <span style="color: white; font-weight: 800; font-size: 16px; margin-left: 4px;">Box</span>
          </div>
          <h1 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">
            Tenés ${count} solicitud${plural ? 'es' : ''} ${config.heading}
          </h1>
          <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 8px 0 0;">
            ${tenantNombre}
          </p>
        </div>
        <div style="background: white; padding: 24px; border-radius: 0 0 16px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">
            Hola <strong>${recipientName}</strong>, estas solicitudes esperan tu acción:
          </p>
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
          <div style="text-align: center; margin-top: 28px;">
            <a href="${appUrl}${config.ctaPath}"
               style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(79,70,229,0.3);">
              ${config.ctaLabel} →
            </a>
          </div>
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este email fue enviado automáticamente por Box — Gestión de Compras.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">
              Podés desactivar estos recordatorios desde tu <a href="${appUrl}/perfil" style="color: #4f46e5;">perfil</a>.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/** Determine if a user should receive the digest email */
export function shouldSendDigest(emailDigest: boolean, _hasUrgent: boolean): boolean {
  // TODO: _hasUrgent is intentionally kept for future use. The plan is to
  // send digests even when emailDigest=false if there are urgent solicitudes
  // (e.g. 3+ business days waiting). Temporarily disabled until UX for
  // urgent-only notifications is finalized.
  if (!emailDigest) return false;
  return true;
}

/** Filter solicitudes for a user based on role config */
export function filterSolicitudesForUser(
  solicitudes: SolicitudRow[],
  config: RoleDigestConfig,
  userAreaId: number | null,
): SolicitudRow[] {
  if (!config.filterByArea) return solicitudes;
  return solicitudes.filter((sol) => sol.area?.id === userAreaId);
}

/** Build the email subject line */
export function buildSubject(count: number, heading: string, hasUrgent: boolean): string {
  const plural = count !== 1;
  return hasUrgent
    ? `Box — ⚠️ ${count} solicitud${plural ? 'es' : ''} pendiente${plural ? 's' : ''} ${heading}`
    : `Box — 📋 ${count} solicitud${plural ? 'es' : ''} ${heading}`;
}
