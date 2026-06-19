import type { PrismaClient } from '@/app/generated/prisma/client';
import { tenantPrisma } from '@/lib/prisma';
import { withAdminOverride } from '@/lib/api-handler';
import {
  buildDates,
  getSolicitanteData,
  getResponsableAreaData,
  getDirectorAreas,
  getDirectorData,
  getOrgAdminData,
  getComprasData,
  getTesoreriaData,
  getTesoreriaBudget,
  getSuperAdminData,
  getAnalyticsData,
} from '@/lib/dashboard';
import type { DashboardContext } from '@/lib/dashboard';

export const GET = withAdminOverride({}, async (request, { session, db, effectiveTenantId }) => {
  const { userId, areaId, roles } = session;
  const tenantId = effectiveTenantId ?? session.tenantId;
  const tdb = (effectiveTenantId ? db : tenantPrisma(tenantId)) as unknown as PrismaClient;
  const result: Record<string, unknown> = {};

  const { searchParams } = new URL(request.url);
  const directorAreaParam = searchParams.get('directorAreaId');
  const directorAreaId = directorAreaParam ? Number(directorAreaParam) : null;

  const ctx: DashboardContext = {
    tdb,
    tenantId,
    userId,
    areaId,
    directorAreaId,
    dates: buildDates(),
  };

  if (roles.includes('director')) {
    result.areasDisponibles = await getDirectorAreas(ctx);
  }

  if (roles.includes('solicitante')) {
    Object.assign(result, await getSolicitanteData(ctx));
  }

  if (roles.includes('responsable_area') && areaId) {
    const data = await getResponsableAreaData(ctx);
    if (data) Object.assign(result, data);
  }

  if (roles.includes('director')) {
    Object.assign(result, await getDirectorData(ctx));
  }

  if (roles.includes('tesoreria') && !roles.includes('director')) {
    Object.assign(result, await getTesoreriaBudget(tenantId));
  }

  if (roles.includes('admin')) {
    Object.assign(result, await getOrgAdminData(ctx, !!result.resumenPresupuesto));
  }

  if (roles.includes('compras')) {
    Object.assign(result, await getComprasData(ctx));
  }

  if (roles.includes('tesoreria')) {
    Object.assign(result, await getTesoreriaData(ctx));
  }

  if (roles.includes('super_admin')) {
    Object.assign(result, await getSuperAdminData(ctx));
  }

  const hasAnalytics =
    roles.includes('director') ||
    roles.includes('admin') ||
    roles.includes('tesoreria') ||
    roles.includes('compras');
  if (hasAnalytics) {
    Object.assign(result, await getAnalyticsData(ctx));
  }

  return Response.json(result);
});
