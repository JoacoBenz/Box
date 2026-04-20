import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';
import { tenantPrisma } from '@/lib/prisma';
import { canCreateCentroCosto } from '@/lib/plan-limits';

export const GET = withAdminOverride({}, async (request, { db, effectiveTenantId }) => {
  const url = new URL(request.url);
  const areaIdParam = url.searchParams.get('area_id');

  const centros = await db.centros_costo.findMany({
    where: {
      activo: true,
      ...(areaIdParam ? { area_id: parseInt(areaIdParam) } : {}),
    },
    orderBy: { nombre: 'asc' },
    include: {
      area: { select: { id: true, nombre: true } },
      ...(!effectiveTenantId && { tenant: { select: { id: true, nombre: true } } }),
    },
  });
  return Response.json(centros);
});

export const POST = withAdminOverride(
  { roles: ['admin', 'director', 'tesoreria'] },
  async (request, { session, ip, effectiveTenantId }) => {
    if (!effectiveTenantId) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = validateBody(centroCostoSchema, body);
    if (!validation.success) return validation.response;

    const { nombre, codigo, presupuesto_anual, presupuesto_mensual, area_id } = validation.data;
    const db = tenantPrisma(effectiveTenantId);

    // Enforce plan limit (CCs per area)
    const limit = await canCreateCentroCosto(effectiveTenantId, area_id);
    if (!limit.allowed) {
      return Response.json(
        { error: { code: limit.code, message: limit.message } },
        { status: 403 },
      );
    }

    const codigoUpper = codigo.toUpperCase();
    const [byCode, byName] = await Promise.all([
      db.centros_costo.findFirst({ where: { codigo: codigoUpper } }),
      db.centros_costo.findFirst({ where: { nombre: { equals: nombre }, activo: true } }),
    ]);
    if (byCode) {
      return Response.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Ya existe un centro de costo con el código "${codigoUpper}"`,
          },
        },
        { status: 409 },
      );
    }
    if (byName) {
      return Response.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Ya existe un centro de costo con el nombre "${nombre}"`,
          },
        },
        { status: 409 },
      );
    }

    // Validate budget doesn't exceed area budget
    const area = await db.areas.findUnique({
      where: { id: area_id },
      select: { presupuesto_anual: true, presupuesto_mensual: true },
    });
    if (area) {
      const existingCCs = await db.centros_costo.findMany({
        where: { area_id, activo: true },
        select: { presupuesto_anual: true, presupuesto_mensual: true },
      });
      const sumaAnual =
        existingCCs.reduce((s, cc) => s + Number(cc.presupuesto_anual ?? 0), 0) +
        Number(presupuesto_anual ?? 0);
      const sumaMensual =
        existingCCs.reduce((s, cc) => s + Number(cc.presupuesto_mensual ?? 0), 0) +
        Number(presupuesto_mensual ?? 0);
      if (area.presupuesto_anual != null && sumaAnual > Number(area.presupuesto_anual)) {
        return Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `La suma de presupuestos anuales de los centros de costo ($${sumaAnual.toLocaleString('es-AR')}) supera el presupuesto anual del área ($${Number(area.presupuesto_anual).toLocaleString('es-AR')})`,
            },
          },
          { status: 400 },
        );
      }
      if (area.presupuesto_mensual != null && sumaMensual > Number(area.presupuesto_mensual)) {
        return Response.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: `La suma de presupuestos mensuales de los centros de costo ($${sumaMensual.toLocaleString('es-AR')}) supera el presupuesto mensual del área ($${Number(area.presupuesto_mensual).toLocaleString('es-AR')})`,
            },
          },
          { status: 400 },
        );
      }
    }

    const centro = await db.centros_costo.create({
      data: {
        tenant_id: effectiveTenantId,
        nombre,
        codigo: codigoUpper,
        ...(presupuesto_anual !== undefined && { presupuesto_anual }),
        ...(presupuesto_mensual !== undefined && { presupuesto_mensual }),
        area_id,
      },
    });

    await registrarAuditoria({
      tenantId: effectiveTenantId,
      usuarioId: session.userId,
      accion: 'crear_centro_costo',
      entidad: 'centro_costo',
      entidadId: centro.id,
      ipAddress: ip,
    });
    return Response.json(centro, { status: 201 });
  },
);
