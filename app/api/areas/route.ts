import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { areaSchema } from '@/lib/validators';
import { tenantPrisma } from '@/lib/prisma';

export const GET = withAdminOverride({}, async (request, { db, effectiveTenantId }) => {
  const areas = await db.areas.findMany({
    where: { activo: true },
    orderBy: { id: 'asc' },
    include: {
      responsable: { select: { id: true, nombre: true } },
      ...(!effectiveTenantId && { tenant: { select: { id: true, nombre: true } } }),
    },
  });
  return Response.json(areas);
});

export const POST = withAdminOverride(
  { roles: ['admin', 'director'] },
  async (request, { session, ip, effectiveTenantId }) => {
    if (!effectiveTenantId) {
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = validateBody(areaSchema, body);
    if (!validation.success) return validation.response;

    const { nombre, responsable_id, presupuesto_anual, presupuesto_mensual } = validation.data;
    const db = tenantPrisma(effectiveTenantId);

    // Check name uniqueness
    const existing = await db.areas.findFirst({ where: { nombre } });
    if (existing) {
      return Response.json(
        { error: { code: 'CONFLICT', message: 'Ya existe un área con ese nombre' } },
        { status: 409 },
      );
    }

    // Validate responsable
    if (responsable_id) {
      const user = await db.usuarios.findFirst({ where: { id: responsable_id, activo: true } });
      if (!user)
        return Response.json(
          { error: { code: 'NOT_FOUND', message: 'Responsable no encontrado' } },
          { status: 404 },
        );
    }

    const area = await db.areas.create({
      data: {
        tenant_id: effectiveTenantId,
        nombre,
        responsable_id: responsable_id ?? null,
        presupuesto_anual: presupuesto_anual ?? null,
        presupuesto_mensual: presupuesto_mensual ?? null,
      },
    });

    await registrarAuditoria({
      tenantId: effectiveTenantId,
      usuarioId: session.userId,
      accion: 'crear_area',
      entidad: 'area',
      entidadId: area.id,
      datosNuevos: { nombre },
      ipAddress: ip,
    });

    return Response.json(area, { status: 201 });
  },
);
