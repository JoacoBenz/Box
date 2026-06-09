import { prisma } from '@/lib/prisma';
import { getResumenPresupuesto } from '@/lib/budget-control';
import type { DashboardContext } from './context';

export async function getOrgAdminData(ctx: DashboardContext, hasPresupuesto: boolean) {
  const { tdb, tenantId } = ctx;

  const [
    totalUsuarios,
    usuariosActivos,
    totalAreas,
    areasConResponsable,
    totalCentrosCosto,
    invitacionesActivas,
    ultimasAuditorias,
    solicitudesActivas,
  ] = await Promise.all([
    tdb.usuarios.count(),
    tdb.usuarios.count({ where: { activo: true } }),
    tdb.areas.count(),
    tdb.areas.count({ where: { responsable_id: { not: null } } }),
    tdb.centros_costo.count(),
    tdb.codigos_invitacion
      .count({ where: { activo: true, expira_el: { gte: new Date() } } })
      .catch(() => 0),
    prisma.$queryRaw<{ accion: string; usuario: string; fecha: string }[]>`
      SELECT la.accion, u.nombre AS usuario, la.created_at::text AS fecha
      FROM log_auditoria la
      JOIN usuarios u ON la.usuario_id = u.id
      WHERE la.tenant_id = ${tenantId}
      ORDER BY la.created_at DESC
      LIMIT 5
    `,
    tdb.solicitudes.count({
      where: { estado: { notIn: ['cerrada', 'anulada', 'rechazada'] } },
    }),
  ]);

  const result: Record<string, unknown> = {
    orgAdmin: {
      totalUsuarios,
      usuariosActivos,
      totalAreas,
      areasConResponsable,
      totalCentrosCosto,
      invitacionesActivas,
      ultimasAuditorias,
      solicitudesActivas,
    },
  };

  if (!hasPresupuesto) {
    result.resumenPresupuesto = await getResumenPresupuesto(tenantId);
  }

  return result;
}
