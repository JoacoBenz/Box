import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';

export const PATCH = withAdminOverride({ roles: ['admin', 'director', 'tesoreria'] }, async (request, { session, db, ip, effectiveTenantId }, params) => {
  const centroId = parseInt(params.id);

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

  const { nombre, codigo, presupuesto_anual, presupuesto_mensual } = validation.data;

  // Duplicate checks on edit (exclude self)
  if (codigo) {
    const codigoUpper = codigo.toUpperCase();
    const dup = await db.centros_costo.findFirst({ where: { codigo: codigoUpper, id: { not: centroId } } });
    if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el código "${codigoUpper}"` } }, { status: 409 });
  }
  if (nombre) {
    const dup = await db.centros_costo.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' }, activo: true, id: { not: centroId } } });
    if (dup) return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el nombre "${nombre}"` } }, { status: 409 });
  }

  const updated = await db.centros_costo.update({
    where: { id: centroId },
    data: {
      ...(nombre && { nombre }),
      ...(codigo && { codigo: codigo.toUpperCase() }),
      ...(presupuesto_anual !== undefined && { presupuesto_anual }),
      ...(presupuesto_mensual !== undefined && { presupuesto_mensual }),
    },
  });

  await registrarAuditoria({ tenantId: effectiveTenantId ?? session.tenantId, usuarioId: session.userId, accion: 'editar_centro_costo', entidad: 'centro_costo', entidadId: centroId, datosAnteriores: centro, datosNuevos: updated, ipAddress: ip });
  return Response.json(updated);
});
