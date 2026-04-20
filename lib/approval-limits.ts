import { getTenantConfigNumber } from './tenant-config';

export type ApprovalLevel = 'responsable' | 'director' | 'director_general';

export async function getRequiredApprovalLevel(
  tenantId: number,
  montoEstimado: number | null,
): Promise<ApprovalLevel> {
  if (!montoEstimado || montoEstimado <= 0) return 'director'; // default for unknown amounts

  const umbralResponsable = await getTenantConfigNumber(
    tenantId,
    'umbral_aprobacion_responsable',
    0,
  );
  const umbralDirector = await getTenantConfigNumber(
    tenantId,
    'umbral_aprobacion_director',
    999_999_999,
  );

  if (umbralResponsable > 0 && montoEstimado <= umbralResponsable) return 'responsable';
  if (montoEstimado <= umbralDirector) return 'director';
  return 'director_general';
}

export async function canUserApproveAmount(
  tenantId: number,
  userRoles: string[],
  montoEstimado: number | null,
): Promise<{ allowed: boolean; reason?: string; requiredLevel: ApprovalLevel }> {
  const requiredLevel = await getRequiredApprovalLevel(tenantId, montoEstimado);

  switch (requiredLevel) {
    case 'responsable':
      if (userRoles.some((r) => ['responsable_area', 'director', 'admin'].includes(r))) {
        return { allowed: true, requiredLevel };
      }
      return {
        allowed: false,
        reason: 'Se requiere al menos un responsable de área para este monto',
        requiredLevel,
      };

    case 'director':
      if (userRoles.some((r) => ['director', 'admin'].includes(r))) {
        return { allowed: true, requiredLevel };
      }
      return {
        allowed: false,
        reason: 'Se requiere aprobación de un director para este monto',
        requiredLevel,
      };

    case 'director_general':
      if (userRoles.includes('admin')) {
        return { allowed: true, requiredLevel };
      }
      return {
        allowed: false,
        reason:
          'Este monto excede el límite de aprobación del director. Se requiere aprobación de administración.',
        requiredLevel,
      };
  }
}
