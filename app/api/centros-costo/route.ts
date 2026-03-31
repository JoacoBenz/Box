import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria, getClientIp } from '@/lib/audit';
import { centroCostoSchema } from '@/lib/validators';

export async function GET() {
  try {
    const session = await getServerSession();
    const db = tenantPrisma(session.tenantId);
    const centros = await db.centros_costo.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });
    return Response.json(centros);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin', 'tesoreria'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permisos para crear centros de costo' } }, { status: 403 });
    }

    const body = await request.json();
    const result = centroCostoSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const db = tenantPrisma(session.tenantId);
    const codigoUpper = result.data.codigo.toUpperCase();
    const [byCode, byName] = await Promise.all([
      db.centros_costo.findFirst({ where: { codigo: codigoUpper } }),
      db.centros_costo.findFirst({ where: { nombre: { equals: result.data.nombre, mode: 'insensitive' }, activo: true } }),
    ]);
    if (byCode) {
      return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el código "${codigoUpper}"` } }, { status: 409 });
    }
    if (byName) {
      return Response.json({ error: { code: 'CONFLICT', message: `Ya existe un centro de costo con el nombre "${result.data.nombre}"` } }, { status: 409 });
    }

    const centro = await db.centros_costo.create({
      data: {
        tenant_id: session.tenantId,
        nombre: result.data.nombre,
        codigo: result.data.codigo.toUpperCase(),
      },
    });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'crear_centro_costo', entidad: 'centro_costo', entidadId: centro.id, ipAddress: getClientIp(request) });
    return Response.json(centro, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
