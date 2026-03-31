import type { RolNombre } from '@/types';
import { prisma } from './prisma';

export function verificarRol(rolesUsuario: RolNombre[], rolesRequeridos: RolNombre[]): boolean {
  return rolesRequeridos.some((rol) => rolesUsuario.includes(rol));
}

export function verificarSegregacion(
  solicitud: {
    solicitante_id: number;
    validado_por_id?: number | null;
    aprobado_por_id?: number | null;
  },
  usuarioId: number,
  accion: 'validar' | 'aprobar' | 'comprar' | 'procesar_compras'
): { permitido: boolean; motivo?: string } {
  switch (accion) {
    case 'validar':
      if (solicitud.solicitante_id === usuarioId) {
        return { permitido: false, motivo: 'No podés validar tu propia solicitud' };
      }
      break;
    case 'aprobar':
      if (solicitud.solicitante_id === usuarioId) {
        return { permitido: false, motivo: 'No podés aprobar tu propia solicitud' };
      }
      if (solicitud.validado_por_id != null && solicitud.validado_por_id === usuarioId) {
        return { permitido: false, motivo: 'No podés aprobar una solicitud que vos mismo validaste' };
      }
      break;
    case 'procesar_compras':
      if (solicitud.aprobado_por_id != null && solicitud.aprobado_por_id === usuarioId) {
        return { permitido: false, motivo: 'No podés procesar una solicitud que vos aprobaste' };
      }
      break;
    case 'comprar':
      if (solicitud.aprobado_por_id != null && solicitud.aprobado_por_id === usuarioId) {
        return { permitido: false, motivo: 'No podés registrar la compra de una solicitud que vos aprobaste' };
      }
      break;
  }
  return { permitido: true };
}

export async function verificarResponsableDeArea(
  tenantId: number,
  usuarioId: number,
  areaId: number
): Promise<boolean> {
  const area = await prisma.areas.findFirst({
    where: { id: areaId, tenant_id: tenantId, responsable_id: usuarioId },
  });
  return !!area;
}

export function apiError(code: string, message: string, status: number, details?: { field: string; message: string }[]) {
  return Response.json({ error: { code, message, details } }, { status });
}
