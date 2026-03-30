import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { verificarRol } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { solicitudSchema } from '@/lib/validators';

async function generarNumeroSolicitud(tenantId: number): Promise<string> {
  const año = new Date().getFullYear();
  const prefijo = `SC-${año}-`;
  const result = await prisma.$queryRaw<{ numero: string }[]>`
    SELECT numero FROM solicitudes
    WHERE tenant_id = ${tenantId} AND numero LIKE ${prefijo + '%'}
    ORDER BY numero DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `;
  let secuencia = 1;
  if (result.length > 0) {
    const partes = result[0].numero.split('-');
    secuencia = parseInt(partes[2], 10) + 1;
  }
  return `${prefijo}${secuencia.toString().padStart(4, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '20'));
    const skip = (page - 1) * limit;
    const estado = searchParams.get('estado') || undefined;
    const urgencia = searchParams.get('urgencia') || undefined;
    const areaId = searchParams.get('area_id') ? parseInt(searchParams.get('area_id')!) : undefined;
    const busqueda = searchParams.get('busqueda') || undefined;
    const orden = searchParams.get('orden') || 'created_at';
    const direccion = (searchParams.get('direccion') || 'desc') as 'asc' | 'desc';

    const db = tenantPrisma(session.tenantId);

    const where: any = {};

    // Role-based visibility filter
    if (session.roles.includes('director') || session.roles.includes('tesoreria') || session.roles.includes('admin')) {
      // sees all
    } else if (session.roles.includes('responsable_area')) {
      // Find all areas where this user is the designated responsable
      const areasResponsable = await db.areas.findMany({
        where: { responsable_id: session.userId, activo: true },
        select: { id: true },
      });
      const areaIds = areasResponsable.map(a => a.id);
      if (areaIds.length > 0) {
        // Show requests from areas they're responsible for, plus their own
        where.OR = [
          { area_id: { in: areaIds } },
          { solicitante_id: session.userId },
        ];
      } else {
        where.solicitante_id = session.userId;
      }
    } else {
      where.solicitante_id = session.userId;
    }

    if (estado) where.estado = estado;
    if (urgencia) where.urgencia = urgencia;
    if (areaId) where.area_id = areaId;
    if (busqueda) where.OR = [{ titulo: { contains: busqueda, mode: 'insensitive' } }, { descripcion: { contains: busqueda, mode: 'insensitive' } }];

    const [data, total] = await Promise.all([
      db.solicitudes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orden]: direccion },
        include: {
          solicitante: { select: { id: true, nombre: true } },
          area: { select: { id: true, nombre: true } },
        },
      }),
      db.solicitudes.count({ where }),
    ]);

    return Response.json({ data, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    console.error(error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['solicitante'])) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Solo solicitantes pueden crear solicitudes' } }, { status: 403 });
    }
    if (!session.areaId) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Tu cuenta no tiene un área asignada. Contactá al administrador.' } }, { status: 400 });
    }

    const body = await request.json();
    const enviar = body.enviar === true || body.accion === 'enviar';
    const result = solicitudSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } }, { status: 400 });
    }

    const { titulo, descripcion, justificacion, urgencia, proveedor_sugerido, items } = result.data;

    const montoTotal = items.reduce((acc, item) => {
      return acc + (item.precio_estimado ? Number(item.precio_estimado) * Number(item.cantidad) : 0);
    }, 0);

    const solicitud = await prisma.$transaction(async (tx) => {
      const numero = await generarNumeroSolicitud(session.tenantId);
      const estado = enviar ? 'enviada' : 'borrador';

      const nueva = await tx.solicitudes.create({
        data: {
          tenant_id: session.tenantId,
          numero,
          titulo,
          descripcion,
          justificacion,
          urgencia,
          proveedor_sugerido: proveedor_sugerido ?? null,
          solicitante_id: session.userId,
          area_id: session.areaId!,
          estado,
          fecha_envio: enviar ? new Date() : null,
          monto_estimado_total: montoTotal > 0 ? montoTotal : null,
        },
      });

      await tx.items_solicitud.createMany({
        data: items.map(item => ({
          tenant_id: session.tenantId,
          solicitud_id: nueva.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad ?? 'unidades',
          precio_estimado: item.precio_estimado ?? null,
        })),
      });

      return nueva;
    });

    if (enviar) {
      // Find area responsable — require one to exist
      const area = await prisma.areas.findFirst({ where: { id: session.areaId!, tenant_id: session.tenantId } });
      if (!area?.responsable_id) {
        // No responsable assigned: notify admins and keep as enviada (don't skip validation)
        await notificarPorRol(session.tenantId, 'director', 'Área sin responsable', `La solicitud "${titulo}" fue enviada pero el área no tiene responsable asignado. Asigná uno para que pueda ser validada.`, solicitud.id);
      } else {
        await crearNotificacion({
          tenantId: session.tenantId,
          destinatarioId: area.responsable_id,
          tipo: 'solicitud_enviada',
          titulo: `Nueva solicitud de validar`,
          mensaje: `${session.nombre} solicita: ${titulo}`,
          solicitudId: solicitud.id,
        });
      }
    }

    await registrarAuditoria({ tenantId: session.tenantId, usuarioId: session.userId, accion: enviar ? 'enviar_solicitud' : 'crear_borrador', entidad: 'solicitud', entidadId: solicitud.id });

    return Response.json(solicitud, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    console.error(error);
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
