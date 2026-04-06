import { withAdminOverride, validateBody, parseId } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';

export const PATCH = withAdminOverride({ roles: ['admin', 'director', 'tesoreria'] }, async (request, { session, db, ip, effectiveTenantId }, params) => {
  const centroId = parseId(params.id);
  if (!centroId) return Response.json({ error: { code: 'BAD_REQUEST', message: 'ID inválido' } }, { status: 400 });

  const centro = await db.centros_costo.findFirst({ where: { id: centroId } });
  if (!centro) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }, { status: 404 });

  const body = await request.json();

  // Toggle activo only
  if (typeof body.activo === 'boolean' && Object.keys(body).length === 1) {
    const updated = await db.centros_costo.update({
      where: { id: centroId },
      data: { activo: body.activo },
    });
    await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: body.activo ? 'activar_centro_costo' : 'desactivar_centro_costo', entidad: 'centro_costo', entidadId: centroId, ipAddress: ip });
    return Response.json(updated);
  }

  const validation = validateBody(centroCostoSchema.partial(), body);
  if (!validation.success) return validation.response;

  const { nombre, codigo, presupuesto_anual, presupuesto_mensual, area_id } = validation.data;

  // Duplicate checks on edit (exclude self)
  if (codigo) {
    const codigoUpper = codigo.toUpperCase();
    const dup = await db.centros_costo.findFirst({ where: { codigo: codigoUpper, id: { not: centroId } } });
    if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el código "${codigoUpper}"` } }, { status: 409 });
  }
  if (nombre) {
    const dup = await db.centros_costo.findFirst({ where: { nombre: { equals: nombre }, activo: true, id: { not: centroId } } });
    if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el nombre "${nombre}"` } }, { status: 409 });
  }

  // Validate budget doesn't exceed area budget
  const targetAreaId = area_id ?? centro.area_id;
  if (targetAreaId) {
    const area = await db.areas.findUnique({ where: { id: targetAreaId }, select: { presupuesto_anual: true, presupuesto_mensual: true } });
    if (area) {
      const existingCCs = await db.centros_costo.findMany({ where: { area_id: targetAreaId, activo: true, id: { not: centroId } }, select: { presupuesto_anual: true, presupuesto_mensual: true } });
      const newAnual = presupuesto_anual !== undefined ? Number(presupuesto_anual ?? 0) : Number(centro.presupuesto_anual ?? 0);
      const newMensual = presupuesto_mensual !== undefined ? Number(presupuesto_mensual ?? 0) : Number(centro.presupuesto_mensual ?? 0);
      const sumaAnual = existingCCs.reduce((s, cc) => s + Number(cc.presupuesto_anual ?? 0), 0) + newAnual;
      const sumaMensual = existingCCs.reduce((s, cc) => s + Number(cc.presupuesto_mensual ?? 0), 0) + newMensual;
      if (area.presupuesto_anual != null && sumaAnual > Number(area.presupuesto_anual)) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', message: `La suma de presupuestos anuales de los centros de costo ($${sumaAnual.toLocaleString('es-AR')}) supera el presupuesto anual del área ($${Number(area.presupuesto_anual).toLocaleString('es-AR')})` } }, { status: 400 });
      }
      if (area.presupuesto_mensual != null && sumaMensual > Number(area.presupuesto_mensual)) {
        return Response.json({ error: { code: 'VALIDATION_ERROR', message: `La suma de presupuestos mensuales de los centros de costo ($${sumaMensual.toLocaleString('es-AR')}) supera el presupuesto mensual del área ($${Number(area.presupuesto_mensual).toLocaleString('es-AR')})` } }, { status: 400 });
      }
    }
  }

  const updated = await db.centros_costo.update({
    where: { id: centroId },
    data: {
      ...(nombre && { nombre }),
      ...(codigo && { codigo: codigo.toUpperCase() }),
      ...(presupuesto_anual !== undefined && { presupuesto_anual }),
      ...(presupuesto_mensual !== undefined && { presupuesto_mensual }),
      ...(area_id !== undefined && { area_id }),
    },
  });

  await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: 'editar_centro_costo', entidad: 'centro_costo', entidadId: centroId, datosAnteriores: centro, datosNuevos: updated, ipAddress: ip });
  return Response.json(updated);
});
