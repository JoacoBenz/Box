import { withAdminOverride, validateBody, parseId } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { areaSchema } from '@/lib/validators';

export const PATCH = withAdminOverride(
  { roles: ['admin', 'director'] },
  async (request, { session, db, ip, effectiveTenantId }, params) => {
    const areaId = parseId(params.id);
    if (!areaId)
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
        { status: 400 },
      );

    const area = await db.areas.findFirst({ where: { id: areaId } });
    if (!area)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Área no encontrada' } },
        { status: 404 },
      );

    const body = await request.json();

    // Toggle activo only
    if (typeof body.activo === 'boolean' && Object.keys(body).length === 1) {
      const updated = await db.areas.update({
        where: { id: areaId },
        data: { activo: body.activo },
      });
      await registrarAuditoria({
        tenantId: effectiveTenantId ?? session.tenantId,
        usuarioId: session.userId,
        accion: body.activo ? 'activar_area' : 'desactivar_area',
        entidad: 'area',
        entidadId: areaId,
        ipAddress: ip,
      });
      return Response.json(updated);
    }

    const validation = validateBody(areaSchema, body);
    if (!validation.success) return validation.response;

    const { nombre, responsable_id, presupuesto_anual, presupuesto_mensual } = validation.data;

    if (nombre !== area.nombre) {
      const existing = await db.areas.findFirst({ where: { nombre } });
      if (existing)
        return Response.json(
          { error: { code: 'CONFLICT', message: 'Ya existe un área con ese nombre' } },
          { status: 409 },
        );
    }

    if (responsable_id) {
      const user = await db.usuarios.findFirst({ where: { id: responsable_id, activo: true } });
      if (!user)
        return Response.json(
          { error: { code: 'NOT_FOUND', message: 'Responsable no encontrado' } },
          { status: 404 },
        );
    }

    const updated = await db.areas.update({
      where: { id: areaId },
      data: {
        nombre,
        responsable_id: responsable_id ?? null,
        presupuesto_anual: presupuesto_anual ?? null,
        presupuesto_mensual: presupuesto_mensual ?? null,
      },
    });

    await registrarAuditoria({
      tenantId: effectiveTenantId ?? session.tenantId,
      usuarioId: session.userId,
      accion: 'editar_area',
      entidad: 'area',
      entidadId: areaId,
      datosAnteriores: area,
      datosNuevos: updated,
      ipAddress: ip,
    });

    return Response.json(updated);
  },
);

export const DELETE = withAdminOverride(
  { roles: ['admin', 'director'] },
  async (request, { session, db, ip, effectiveTenantId }, params) => {
    const areaId = parseId(params.id);
    if (!areaId)
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
        { status: 400 },
      );

    const area = await db.areas.findFirst({ where: { id: areaId } });
    if (!area)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'Área no encontrada' } },
        { status: 404 },
      );

    const activeSolicitudes = await db.solicitudes.count({
      where: { area_id: areaId, estado: { notIn: ['rechazada', 'cerrada'] } },
    });
    if (activeSolicitudes > 0) {
      return Response.json(
        {
          error: {
            code: 'CONFLICT',
            message: `No podés desactivar esta área: tiene ${activeSolicitudes} solicitud(es) activa(s)`,
          },
        },
        { status: 409 },
      );
    }

    await db.areas.update({ where: { id: areaId }, data: { activo: false } });
    await registrarAuditoria({
      tenantId: effectiveTenantId ?? session.tenantId,
      usuarioId: session.userId,
      accion: 'desactivar_area',
      entidad: 'area',
      entidadId: areaId,
      ipAddress: ip,
    });

    return Response.json({ message: 'Área desactivada' });
  },
);
