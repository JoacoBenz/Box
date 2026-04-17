import { withAdminOverride, validateBody, parseId } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { proveedorSchema } from '@/lib/validators';

export const GET = withAdminOverride({}, async (request, { db }, params) => {
  const proveedorId = parseId(params.id);
  if (!proveedorId)
    return Response.json(
      { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
      { status: 400 },
    );

  const proveedor = await db.proveedores.findFirst({ where: { id: proveedorId } });
  if (!proveedor)
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Proveedor no encontrado' } },
      { status: 404 },
    );

  return Response.json(proveedor);
});

export const PATCH = withAdminOverride(
  { roles: ['solicitante', 'tesoreria', 'compras', 'director', 'admin', 'responsable_area'] },
  async (request, { session, db, ip, effectiveTenantId }, params) => {
    const proveedorId = parseId(params.id);
    if (!proveedorId)
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
        { status: 400 },
      );

    const existing = await db.proveedores.findFirst({ where: { id: proveedorId } });
    if (!existing)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'No encontrado' } },
        { status: 404 },
      );

    const body = await request.json();
    const validation = validateBody(proveedorSchema.partial(), body);
    if (!validation.success) return validation.response;

    const data = validation.data;
    const updateData: Record<string, any> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.cuit !== undefined) updateData.cuit = data.cuit || null;
    if (data.datos_bancarios !== undefined)
      updateData.datos_bancarios = data.datos_bancarios || null;
    if (data.link_pagina !== undefined) updateData.link_pagina = data.link_pagina || null;
    if (data.telefono !== undefined) updateData.telefono = data.telefono || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.direccion !== undefined) updateData.direccion = data.direccion || null;

    const updated = await db.proveedores.update({ where: { id: proveedorId }, data: updateData });

    await registrarAuditoria({
      tenantId: effectiveTenantId ?? session.tenantId,
      usuarioId: session.userId,
      accion: 'editar_proveedor',
      entidad: 'proveedor',
      entidadId: proveedorId,
      datosAnteriores: existing,
      ipAddress: ip,
    });

    return Response.json(updated);
  },
);

export const DELETE = withAdminOverride(
  { roles: ['tesoreria', 'compras', 'director', 'admin', 'responsable_area'] },
  async (request, { session, db, ip, effectiveTenantId }, params) => {
    const proveedorId = parseId(params.id);
    if (!proveedorId)
      return Response.json(
        { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
        { status: 400 },
      );

    const existing = await db.proveedores.findFirst({ where: { id: proveedorId } });
    if (!existing)
      return Response.json(
        { error: { code: 'NOT_FOUND', message: 'No encontrado' } },
        { status: 404 },
      );

    await db.proveedores.update({ where: { id: proveedorId }, data: { activo: false } });

    await registrarAuditoria({
      tenantId: effectiveTenantId ?? session.tenantId,
      usuarioId: session.userId,
      accion: 'desactivar_proveedor',
      entidad: 'proveedor',
      entidadId: proveedorId,
      ipAddress: ip,
    });

    return Response.json({ message: 'Proveedor desactivado' });
  },
);
