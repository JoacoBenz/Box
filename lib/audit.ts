import { prisma } from './prisma';
import { logApiError } from './logger';

export function getClientIp(request: Request): string {
  // Use x-real-ip first (set by reverse proxy, harder to spoof)
  // then fall back to x-forwarded-for (can be spoofed by clients)
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) return realIp;

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded && isValidIp(forwarded)) return forwarded;

  return 'unknown';
}

function isValidIp(ip: string): boolean {
  // Basic validation: IPv4 or IPv6, no spaces/special chars
  return /^[\da-fA-F.:]+$/.test(ip) && ip.length <= 45;
}

interface AuditEntry {
  tenantId: number;
  usuarioId: number;
  accion: string;
  entidad: string;
  entidadId?: number;
  datosAnteriores?: any;
  datosNuevos?: any;
  ipAddress?: string;
}

/** Critical actions where audit failure should propagate to the caller */
const CRITICAL_ACTIONS = new Set([
  'aprobar_solicitud',
  'rechazar_solicitud',
  'registrar_compra',
  'confirmar_recepcion',
  'anular_solicitud',
  'editar_usuario',
  'crear_delegacion',
  'desactivar_delegacion',
]);

/**
 * Records an audit log entry.
 * For critical financial/security actions, failures propagate to the caller.
 * For non-critical actions, failures are logged but swallowed.
 */
export async function registrarAuditoria(entry: AuditEntry): Promise<void> {
  try {
    await prisma.log_auditoria.create({
      data: {
        tenant_id: entry.tenantId,
        usuario_id: entry.usuarioId,
        accion: entry.accion,
        entidad: entry.entidad,
        entidad_id: entry.entidadId,
        datos_anteriores: entry.datosAnteriores ?? undefined,
        datos_nuevos: entry.datosNuevos ?? undefined,
        ip_address: entry.ipAddress,
      },
    });
  } catch (error) {
    logApiError('audit', 'registrarAuditoria', error, entry.usuarioId, entry.tenantId);
    if (CRITICAL_ACTIONS.has(entry.accion)) {
      throw new Error(`Audit logging failed for critical action: ${entry.accion}`);
    }
  }
}
