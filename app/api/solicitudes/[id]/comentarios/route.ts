import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { apiError } from '@/lib/permissions';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, effectiveTenantId } = await getEffectiveTenantId(request);
    const { id } = await params;
    const solicitudId = Number(id);
    if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

    const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : tenantPrisma(session.tenantId);

    const comentarios = await db.comentarios.findMany({
      where: { solicitud_id: solicitudId },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json(comentarios);
  } catch (e: any) {
    if (e.message === 'No autenticado') {
      return apiError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return apiError('INTERNAL', 'Error cargando comentarios', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = Number(id);
    if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

    const body = await request.json();
    const mensaje = body.mensaje?.trim();

    if (!mensaje || mensaje.length < 1) {
      return apiError('VALIDATION', 'El comentario no puede estar vacío', 400);
    }
    if (mensaje.length > 2000) {
      return apiError('VALIDATION', 'El comentario no puede superar los 2000 caracteres', 400);
    }

    const db = tenantPrisma(session.tenantId);

    // Verify solicitud exists
    const solicitud = await db.solicitudes.findFirst({
      where: { id: solicitudId },
    });
    if (!solicitud) return apiError('NOT_FOUND', 'Solicitud no encontrada', 404);

    const comentario = await db.comentarios.create({
      data: {
        solicitud_id: solicitudId,
        usuario_id: session.userId,
        mensaje,
      } as any,
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    // ── Notificaciones en cascada por comentario ──
    // Determine the commenter's highest role in the hierarchy
    const { userId, tenantId, roles } = session;
    const userName = comentario.usuario.nombre;
    const solNumero = solicitud.numero;
    const titulo = `Nuevo comentario en ${solNumero}`;
    const msgTexto = mensaje.length > 80 ? mensaje.substring(0, 80) + '…' : mensaje;
    const notifMensaje = `${userName}: ${msgTexto}`;

    // Role hierarchy (highest to lowest): compras/tesoreria → director → responsable_area → solicitante
    // When someone comments, notify everyone BELOW them in the chain (+ always the solicitante)
    // Also notify the responsable del área of the solicitud
    // Never notify the commenter themselves

    const destinatarios = new Set<number>();

    // Determine commenter's highest role level
    const isCompras = roles.includes('compras');
    const isTesoreria = roles.includes('tesoreria');
    const isAdmin = roles.includes('admin');
    const isDirector = roles.includes('director');
    const isResponsable = roles.includes('responsable_area');

    // Level: compras/tesoreria/admin = 4, director = 3, responsable = 2, solicitante = 1
    let commenterLevel = 1;
    if (isCompras || isTesoreria || isAdmin) commenterLevel = 4;
    else if (isDirector) commenterLevel = 3;
    else if (isResponsable) commenterLevel = 2;

    // 1. Always notify the solicitante (unless they are the commenter)
    if (solicitud.solicitante_id !== userId) {
      destinatarios.add(solicitud.solicitante_id);
    }

    // 2. Notify responsable(s) del área of the solicitud (level 2) if commenter is above them
    if (commenterLevel > 2) {
      const responsables = await prisma.usuarios.findMany({
        where: {
          tenant_id: tenantId,
          area_id: solicitud.area_id,
          activo: true,
          usuarios_roles: { some: { rol: { nombre: 'responsable_area' } } },
        },
        select: { id: true },
      });
      for (const r of responsables) {
        if (r.id !== userId) destinatarios.add(r.id);
      }
    }

    // 3. Notify director(s) if commenter is above them (level 4: tesoreria/compras/admin)
    if (commenterLevel > 3) {
      const directores = await prisma.usuarios.findMany({
        where: {
          tenant_id: tenantId,
          activo: true,
          usuarios_roles: { some: { rol: { nombre: 'director' } } },
        },
        select: { id: true },
      });
      for (const d of directores) {
        if (d.id !== userId) destinatarios.add(d.id);
      }
    }

    // 4. If commenter is solicitante or responsable, notify upward too
    //    responsable comments → solicitante already handled above
    //    solicitante comments → notify responsable(s) of their area
    if (commenterLevel <= 2 && commenterLevel === 1) {
      // Solicitante commenting → notify responsable(s) del área
      const responsables = await prisma.usuarios.findMany({
        where: {
          tenant_id: tenantId,
          area_id: solicitud.area_id,
          activo: true,
          usuarios_roles: { some: { rol: { nombre: 'responsable_area' } } },
        },
        select: { id: true },
      });
      for (const r of responsables) {
        if (r.id !== userId) destinatarios.add(r.id);
      }
    }

    // Create all notifications (fire and forget)
    const notifPromises = Array.from(destinatarios).map((destId) =>
      crearNotificacion({
        tenantId,
        destinatarioId: destId,
        tipo: 'comentario',
        titulo,
        mensaje: notifMensaje,
        solicitudId: solicitudId,
      })
    );
    Promise.all(notifPromises).catch(() => {});

    return NextResponse.json(comentario, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') {
      return apiError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return apiError('INTERNAL', 'Error creando comentario', 500);
  }
}
