import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import nodemailer from 'nodemailer';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TO = 'bexovar@gmail.com';

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

interface MockSol {
  numero: string;
  titulo: string;
  area: string;
  solicitante: string;
  urgencia: string;
  monto: number;
  diasHabiles: number;
}

interface RoleConfig {
  roleName: string;
  heading: string;
  ctaPath: string;
  ctaLabel: string;
  recipientName: string;
  solicitudes: MockSol[];
}

const ROLES: RoleConfig[] = [
  {
    roleName: 'Responsable de Área',
    heading: 'para validar',
    ctaPath: '/solicitudes',
    ctaLabel: 'Ir a Solicitudes',
    recipientName: 'María',
    solicitudes: [
      {
        numero: 'SC-0032',
        titulo: 'Resmas A4 x 500 hojas',
        area: 'Administración',
        solicitante: 'Juan Pérez',
        urgencia: 'media',
        monto: 15000,
        diasHabiles: 1,
      },
      {
        numero: 'SC-0035',
        titulo: 'Marcadores pizarra x20',
        area: 'Administración',
        solicitante: 'Laura Gómez',
        urgencia: 'alta',
        monto: 8500,
        diasHabiles: 5,
      },
    ],
  },
  {
    roleName: 'Director',
    heading: 'para aprobar',
    ctaPath: '/aprobaciones',
    ctaLabel: 'Ir a Aprobaciones',
    recipientName: 'Joaquín',
    solicitudes: [
      {
        numero: 'SC-0012',
        titulo: 'Resmas A4 x 500 hojas',
        area: 'Administración',
        solicitante: 'María López',
        urgencia: 'media',
        monto: 15000,
        diasHabiles: 1,
      },
      {
        numero: 'SC-0015',
        titulo: 'Toner HP LaserJet',
        area: 'Dirección',
        solicitante: 'Carlos García',
        urgencia: 'alta',
        monto: 45000,
        diasHabiles: 4,
      },
      {
        numero: 'SC-0018',
        titulo: 'Sillas ergonómicas x5',
        area: 'Contaduría',
        solicitante: 'Ana Pérez',
        urgencia: 'baja',
        monto: 120000,
        diasHabiles: 0,
      },
      {
        numero: 'SC-0021',
        titulo: 'Proyector Epson',
        area: 'Sala de reuniones',
        solicitante: 'Luis Fernández',
        urgencia: 'normal',
        monto: 350000,
        diasHabiles: 2,
      },
    ],
  },
  {
    roleName: 'Compras',
    heading: 'para procesar',
    ctaPath: '/compras',
    ctaLabel: 'Ir a Compras',
    recipientName: 'Carolina',
    solicitudes: [
      {
        numero: 'SC-0010',
        titulo: 'Notebooks Lenovo x3',
        area: 'Sistemas',
        solicitante: 'Pedro Ruiz',
        urgencia: 'alta',
        monto: 1200000,
        diasHabiles: 2,
      },
      {
        numero: 'SC-0014',
        titulo: 'Escritorios regulables x2',
        area: 'Dirección',
        solicitante: 'Ana Pérez',
        urgencia: 'normal',
        monto: 280000,
        diasHabiles: 0,
      },
      {
        numero: 'SC-0019',
        titulo: 'Papel higiénico x100',
        area: 'Mantenimiento',
        solicitante: 'Roberto Díaz',
        urgencia: 'baja',
        monto: 35000,
        diasHabiles: 6,
      },
    ],
  },
  {
    roleName: 'Tesorería',
    heading: 'para ejecutar pago',
    ctaPath: '/tesoreria',
    ctaLabel: 'Ir a Tesorería',
    recipientName: 'Silvia',
    solicitudes: [
      {
        numero: 'SC-0008',
        titulo: 'Aire acondicionado Samsung',
        area: 'Sala de reuniones',
        solicitante: 'Luis Fernández',
        urgencia: 'critica',
        monto: 650000,
        diasHabiles: 4,
      },
      {
        numero: 'SC-0011',
        titulo: 'Licencias Microsoft 365',
        area: 'Sistemas',
        solicitante: 'Pedro Ruiz',
        urgencia: 'normal',
        monto: 180000,
        diasHabiles: 1,
      },
    ],
  },
];

function buildHtml(config: RoleConfig): string {
  let montoTotal = 0;
  const rows = config.solicitudes
    .map((sol) => {
      montoTotal += sol.monto;
      const urg = URGENCIA_COLORS[sol.urgencia] ?? URGENCIA_COLORS.normal;
      const urgente = sol.diasHabiles >= 3;
      return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-weight: 600; color: #4f46e5; font-size: 13px; white-space: nowrap;">
          ${sol.numero}
          ${urgente ? `<br><span style="color: #dc2626; font-size: 11px; font-weight: 700;">⏰ ${sol.diasHabiles}d</span>` : ''}
        </td>
        <td style="padding: 12px 8px;">
          <div style="font-weight: 600; font-size: 14px; color: #1f2937;">${sol.titulo}</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${sol.area} · ${sol.solicitante}</div>
        </td>
        <td style="padding: 12px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: ${urg.bg}; color: ${urg.text};">${urg.label}</span>
        </td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 700; font-size: 14px; color: #1f2937; white-space: nowrap;">${formatMonto(sol.monto)}</td>
      </tr>`;
    })
    .join('');

  const count = config.solicitudes.length;
  const plural = count !== 1;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px 16px 0 0; padding: 24px; text-align: center;">
      <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 8px 12px; margin-bottom: 12px;">
        <span style="font-size: 20px;">📦</span>
        <span style="color: white; font-weight: 800; font-size: 16px; margin-left: 4px;">Box</span>
      </div>
      <h1 style="color: white; font-size: 20px; font-weight: 700; margin: 0;">Tenés ${count} solicitud${plural ? 'es' : ''} ${config.heading}</h1>
      <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 8px 0 0;">Escuela Test</p>
    </div>
    <div style="background: white; padding: 24px; border-radius: 0 0 16px 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="color: #374151; font-size: 15px; margin: 0 0 20px;">Hola <strong>${config.recipientName}</strong>, estas solicitudes esperan tu acción:</p>
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
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background: #f9fafb; border-top: 2px solid #e5e7eb;">
              <td colspan="3" style="padding: 14px 8px; font-weight: 700; font-size: 15px; color: #374151;">Total estimado</td>
              <td style="padding: 14px 8px; text-align: right; font-weight: 800; font-size: 16px; color: #4f46e5;">${formatMonto(montoTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="text-align: center; margin-top: 28px;">
        <a href="${APP_URL}${config.ctaPath}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 14px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(79,70,229,0.3);">${config.ctaLabel} →</a>
      </div>
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Este email fue enviado automáticamente por Box — Gestión de Compras.</p>
        <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0;">Podés desactivar estos recordatorios desde tu <a href="${APP_URL}/perfil" style="color: #4f46e5;">perfil</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  for (const config of ROLES) {
    const hasUrgent = config.solicitudes.some((s) => s.diasHabiles >= 3);
    const count = config.solicitudes.length;
    const plural = count !== 1;
    const subject = hasUrgent
      ? `Box — ⚠️ ${count} solicitud${plural ? 'es' : ''} pendiente${plural ? 's' : ''} ${config.heading}`
      : `Box — 📋 ${count} solicitud${plural ? 'es' : ''} ${config.heading}`;

    console.log(`Enviando email de ${config.roleName} a ${TO}...`);
    await transporter.sendMail({
      from: `Box <${process.env.GMAIL_USER}>`,
      to: TO,
      subject,
      html: buildHtml(config),
    });
    console.log(`✅ ${config.roleName} enviado!`);
  }
  console.log('\n🎉 4 emails enviados!');
}

main().catch(console.error);
