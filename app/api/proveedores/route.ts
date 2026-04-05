import { withAdminOverride, validateBody } from '@/lib/api-handler';
import { registrarAuditoria } from '@/lib/audit';
import { proveedorSchema } from '@/lib/validators';
import { tenantPrisma } from '@/lib/prisma';

export const GET = withAdminOverride({}, async (request, { db, effectiveTenantId }) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

  const where: any = { activo: true };
  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: 'insensitive' as const } },
      { cuit: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const proveedores = await db.proveedores.findMany({
    where,
    take: limit,
    orderBy: { nombre: 'asc' },
  });

  return Response.json(proveedores);
});

export const POST = withAdminOverride({ roles: ['solicitante', 'tesoreria', 'compras', 'director', 'admin', 'responsable_area'] }, async (request, { session, ip, effectiveTenantId }) => {
  if (!effectiveTenantId) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: 'Seleccioná una organización antes de crear' } }, { status: 400 });
  }

  const body = await request.json();
  const validation = validateBody(proveedorSchema, body);
  if (!validation.success) return validation.response;

  const data = validation.data;
  const db = tenantPrisma(effectiveTenantId);

  // Check duplicate CUIT if provided
  if (data.cuit) {
    const existing = await db.proveedores.findFirst({ where: { cuit: data.cuit, activo: true } });
    if (existing) {
      return Response.json({ error: { code: 'DUPLICATE', message: `Ya existe un proveedor con CUIT ${data.cuit}: ${existing.nombre}` } }, { status: 409 });
    }
  }

  const proveedor = await db.proveedores.create({
    data: {
      tenant_id: effectiveTenantId,
      nombre: data.nombre,
      cuit: data.cuit || null,
      datos_bancarios: data.datos_bancarios || null,
      link_pagina: data.link_pagina || null,
      telefono: data.telefono || null,
      email: data.email || null,
      direccion: data.direccion || null,
    },
  });

  await registrarAuditoria({ tenantId: effectiveTenantId, usuarioId: session.userId, accion: 'crear_proveedor', entidad: 'proveedor', entidadId: proveedor.id, ipAddress: ip });

  return Response.json(proveedor, { status: 201 });
});
