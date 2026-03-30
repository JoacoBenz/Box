import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { proveedorSchema } from '@/lib/validators';
import { registrarAuditoria } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || '';
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const db = tenantPrisma(session.tenantId);

    const where: any = { activo: true };
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search, mode: 'insensitive' } },
      ];
    }

    const proveedores = await db.proveedores.findMany({
      where,
      take: limit,
      orderBy: { nombre: 'asc' },
    });

    return Response.json(proveedores);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    console.error(error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    const body = await request.json();
    const result = proveedorSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const data = result.data;
    const db = tenantPrisma(session.tenantId);

    // Check duplicate CUIT if provided
    if (data.cuit) {
      const existing = await db.proveedores.findFirst({ where: { cuit: data.cuit, activo: true } });
      if (existing) {
        return Response.json({ error: { code: 'DUPLICATE', message: `Ya existe un proveedor con CUIT ${data.cuit}: ${existing.nombre}` } }, { status: 409 });
      }
    }

    const proveedor = await db.proveedores.create({
      data: {
        nombre: data.nombre,
        cuit: data.cuit || null,
        datos_bancarios: data.datos_bancarios || null,
        link_pagina: data.link_pagina || null,
        telefono: data.telefono || null,
        email: data.email || null,
        direccion: data.direccion || null,
      },
    });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'crear_proveedor', entidad: 'proveedor', entidadId: proveedor.id });

    return Response.json(proveedor, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    console.error(error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
