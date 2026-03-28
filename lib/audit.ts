import { prisma } from './prisma';

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
    console.error('Error escribiendo auditoría:', error);
  }
}
