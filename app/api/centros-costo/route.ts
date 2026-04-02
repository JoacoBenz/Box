import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';
import { tenantPrisma } from '@/lib/prisma';

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

export const POST = withAdminOverride({ roles: ['admin', 'director', 'tesoreria'] }, async (request, { session, ip, effectiveTenantId }) => {
  if (!effectiveTenantId) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } }, { status: 400 });
  }

  const body = await request.json();
  const validation = validateBody(centroCostoSchema, body);
  if (!validation.success) return validation.response;

  const { nombre, codigo, presupuesto_anual, presupuesto_mensual, area_id } = validation.data;
  const db = tenantPrisma(effectiveTenantId);

  const codigoUpper = codigo.toUpperCase();
  const [byCode, byName] = await Promise.all([
    db.centros_costo.findFirst({ where: { codigo: codigoUpper } }),
    db.centros_costo.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' }, activo: true } }),
  ]);
  if (byCode) {
    return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el código "${codigoUpper}"` } }, { status: 409 });
  }
  if (byName) {
    return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el nombre "${nombre}"` } }, { status: 409 });
  }

  const centro = await db.centros_costo.create({
    data: {
      tenant_id: effectiveTenantId,
      nombre,
      codigo: codigoUpper,
      ...(presupuesto_anual !== undefined && { presupuesto_anual }),
      ...(presupuesto_mensual !== undefined && { presupuesto_mensual }),
      ...(area_id !== undefined && { area_id: area_id ?? null }),
    },
  });

  await registrarAuditoria({ tenantId: effectiveTenantId, usuarioId: session.userId, accion: 'crear_centro_costo', entidad: 'centro_costo', entidadId: centro.id, ipAddress: ip });
  return Response.json(centro, { status: 201 });
});
