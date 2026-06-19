import { prisma } from '@/lib/prisma';
import type { DashboardContext } from './context';

export async function getSuperAdminData(ctx: DashboardContext) {
  const { dates } = ctx;
  const { inicioMes } = dates;
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalOrganizaciones,
    orgActivas,
    orgPendientes,
    orgSuspendidas,
    totalUsuariosPlataforma,
    usuariosNuevosMes,
    orgsNuevasMes,
    orgsDormidas,
    promedioUsuariosPorOrg,
    crecimientoOrgsData,
    crecimientoUsuariosData,
    orgsTopUso,
  ] = await Promise.all([
    prisma.tenants.count({ where: { slug: { not: '__platform__' } } }),
    prisma.tenants.count({
      where: { estado: 'activo', desactivado: false, slug: { not: '__platform__' } },
    }),
    prisma.tenants.count({ where: { estado: 'pendiente', slug: { not: '__platform__' } } }),
    prisma.tenants.count({
      where: {
        slug: { not: '__platform__' },
        OR: [{ estado: 'suspendido' }, { desactivado: true }],
      },
    }),
    prisma.usuarios.count({
      where: { activo: true, tenant: { slug: { not: '__platform__' } } },
    }),
    prisma.usuarios.count({
      where: { created_at: { gte: inicioMes }, tenant: { slug: { not: '__platform__' } } },
    }),
    prisma.tenants.count({
      where: { fecha_registro: { gte: inicioMes }, slug: { not: '__platform__' } },
    }),
    prisma.$queryRaw<{ cantidad: string }[]>`
      SELECT COUNT(*)::text AS cantidad
      FROM tenants t
      WHERE t.estado = 'activo' AND t.desactivado = false AND t.slug != '__platform__'
        AND NOT EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.tenant_id = t.id AND u.activo = true
            AND u.updated_at >= ${hace30Dias}
        )
    `,
    prisma.$queryRaw<{ promedio: string }[]>`
      SELECT ROUND(AVG(cnt))::text AS promedio FROM (
        SELECT COUNT(u.id) AS cnt
        FROM tenants t
        LEFT JOIN usuarios u ON u.tenant_id = t.id AND u.activo = true
        WHERE t.estado = 'activo' AND t.desactivado = false AND t.slug != '__platform__'
        GROUP BY t.id
      ) sub
    `,
    prisma.$queryRaw<{ mes: string; cantidad: string }[]>`
      SELECT TO_CHAR(fecha_registro, 'YYYY-MM') AS mes, COUNT(*)::text AS cantidad
      FROM tenants
      WHERE fecha_registro >= CURRENT_DATE - INTERVAL '6 months' AND slug != '__platform__'
      GROUP BY TO_CHAR(fecha_registro, 'YYYY-MM')
      ORDER BY mes ASC
    `,
    prisma.$queryRaw<{ mes: string; cantidad: string }[]>`
      SELECT TO_CHAR(u2.created_at, 'YYYY-MM') AS mes, COUNT(*)::text AS cantidad
      FROM usuarios u2
      JOIN tenants t2 ON u2.tenant_id = t2.id
      WHERE u2.created_at >= CURRENT_DATE - INTERVAL '6 months' AND t2.slug != '__platform__'
      GROUP BY TO_CHAR(u2.created_at, 'YYYY-MM')
      ORDER BY mes ASC
    `,
    prisma.$queryRaw<
      {
        id: number;
        org: string;
        estado: string;
        usuarios: string;
        ultimo_acceso: string | null;
      }[]
    >`
      SELECT t.id, t.nombre AS org, t.estado,
             COUNT(u.id)::text AS usuarios,
             MAX(u.updated_at)::text AS ultimo_acceso
      FROM tenants t
      LEFT JOIN usuarios u ON u.tenant_id = t.id AND u.activo = true
      WHERE t.estado = 'activo' AND t.desactivado = false AND t.slug != '__platform__'
      GROUP BY t.id, t.nombre, t.estado
      ORDER BY COUNT(u.id) DESC
      LIMIT 10
    `,
  ]);

  return {
    adminPlatform: {
      totalOrganizaciones,
      orgActivas,
      orgPendientes,
      orgSuspendidas,
      totalUsuariosPlataforma,
      usuariosNuevosMes,
      orgsNuevasMes,
      orgsDormidas: parseInt(orgsDormidas[0]?.cantidad ?? '0'),
      promedioUsuariosPorOrg: parseInt(promedioUsuariosPorOrg[0]?.promedio ?? '0'),
      crecimientoOrgs: crecimientoOrgsData.map((r) => ({
        mes: r.mes,
        cantidad: parseInt(r.cantidad),
      })),
      crecimientoUsuarios: crecimientoUsuariosData.map((r) => ({
        mes: r.mes,
        cantidad: parseInt(r.cantidad),
      })),
      orgsTopUso: orgsTopUso.map((r) => ({
        id: r.id,
        org: r.org,
        estado: r.estado,
        usuarios: parseInt(r.usuarios),
        ultimoAcceso: r.ultimo_acceso,
      })),
    },
  };
}
