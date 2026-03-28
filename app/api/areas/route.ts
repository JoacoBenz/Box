import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { areaSchema } from '@/lib/validators';

export async function GET() {
  try {
    const session = await getServerSession();
    const db = tenantPrisma(session.tenantId);
    const areas = await db.areas.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      include: { responsable: { select: { id: true, nombre: true } } },
    });
    return Response.json(areas);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo administradores pueden crear áreas' } }, { status: 403 });
    }

    const body = await request.json();
    const result = areaSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const { nombre, responsable_id } = result.data;
    const db = tenantPrisma(session.tenantId);

    // Check name uniqueness
    const existing = await db.areas.findFirst({ where: { nombre } });
    if (existing) {
      return Response.json({ error: { code: 'CONFLICT', message: 'Ya existe un área con ese nombre' } }, { status: 409 });
    }

    // Validate responsable
    if (responsable_id) {
      const user = await db.usuarios.findFirst({ where: { id: responsable_id, activo: true } });
      if (!user) return Response.json({ error: { code: 'NOT_FOUND', message: 'Responsable no encontrado' } }, { status: 404 });
    }

    const area = await db.areas.create({ data: { tenant_id: session.tenantId, nombre, responsable_id: responsable_id ?? null } });

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: 'crear_area', entidad: 'area', entidadId: area.id, datosNuevos: { nombre } });

    return Response.json(area, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
