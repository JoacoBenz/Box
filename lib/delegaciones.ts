import { tenantPrisma } from './prisma';
import type { RolNombre } from '@/types';

/**
 * Get effective roles for a user, including delegated roles.
 * A delegation is active if: activo=true, today is between fecha_inicio and fecha_fin.
 */
export async function getRolesEfectivos(
  tenantId: number,
  userId: number,
  baseRoles: RolNombre[],
): Promise<{ roles: RolNombre[]; delegaciones: { rol: string; deleganteNombre: string }[] }> {
  const db = tenantPrisma(tenantId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delegacionesActivas = await db.delegaciones.findMany({
    where: {
      delegado_id: userId,
      activo: true,
      fecha_inicio: { lte: today },
      fecha_fin: { gte: today },
    },
    include: {
      delegante: { select: { nombre: true } },
    },
  });

  const rolesSet = new Set<RolNombre>(baseRoles);
  const delegacionesInfo: { rol: string; deleganteNombre: string }[] = [];

  for (const d of delegacionesActivas) {
    rolesSet.add(d.rol_delegado as RolNombre);
    delegacionesInfo.push({ rol: d.rol_delegado, deleganteNombre: d.delegante.nombre });
  }

  return { roles: Array.from(rolesSet), delegaciones: delegacionesInfo };
}
