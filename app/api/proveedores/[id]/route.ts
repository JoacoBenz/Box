import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { proveedorSchema } from '@/lib/validators';
import { registrarAuditoria, getClientIp } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const db = tenantPrisma(session.tenantId);

    const proveedor = await db.proveedores.findFirst({ where: { id: parseInt(id) } });
    if (!proveedor) return Response.json({ error: { code: 'NOT_FOUND', message: 'Proveedor no encontrado' } }, { status: 404 });

    return Response.json(proveedor);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['tesoreria', 'compras', 'director', 'admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'No tenés permisos para editar proveedores' } }, { status: 403 });
    }

    const { id } = await params;
    const proveedorId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const existing = await db.proveedores.findFirst({ where: { id: proveedorId } });
    if (!existing) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }, { status: 404 });

    const body = await request.json();
    const result = proveedorSchema.partial().safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const data = result.data;
    const updateData: Record<string, any> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.cuit !== undefined) updateData.cuit = data.cuit || null;
    if (data.datos_bancarios !== undefined) updateData.datos_bancarios = data.datos_bancarios || null;
    if (data.link_pagina !== undefined) updateData.link_pagina = data.link_pagina || null;
    if (data.telefono !== undefined) updateData.telefono = data.telefono || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.direccion !== undefined) updateData.direccion = data.direccion || null;

    const updated = await db.proveedores.update({ where: { id: proveedorId }, data: updateData });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'editar_proveedor', entidad: 'proveedor', entidadId: proveedorId, datosAnteriores: existing, ipAddress: getClientIp(request) });

    return Response.json(updated);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['tesoreria', 'compras', 'director', 'admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'No tenés permisos para desactivar proveedores' } }, { status: 403 });
    }

    const { id } = await params;
    const proveedorId = parseInt(id);
    const db = tenantPrisma(session.tenantId);

    const existing = await db.proveedores.findFirst({ where: { id: proveedorId } });
    if (!existing) return Response.json({ error: { code: 'NOT_FOUND', message: 'No encontrado' } }, { status: 404 });

    await db.proveedores.update({ where: { id: proveedorId }, data: { activo: false } });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'desactivar_proveedor', entidad: 'proveedor', entidadId: proveedorId, ipAddress: getClientIp(request) });

    return Response.json({ message: 'Proveedor desactivado' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
