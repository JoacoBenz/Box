import { prisma } from './prisma';
import { logNotificationError } from './logger';

interface NotificationData {
  tenantId: number;
  destinatarioId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  solicitudId?: number;
}

export async function crearNotificacion(data: NotificationData): Promise<void> {
  try {
    await prisma.notificaciones.create({
      data: {
        tenant_id: data.tenantId,
        usuario_destino_id: data.destinatarioId,
        tipo: data.tipo,
        titulo: data.titulo,
        mensaje: data.mensaje,
        solicitud_id: data.solicitudId,
        leida: false,
      },
    });
  } catch (error) {
    logNotificationError('crearNotificacion', error, data.destinatarioId, data.solicitudId);
  }
}

export async function notificarAdmins(titulo: string, mensaje: string): Promise<void> {
  try {
    const admins = await prisma.usuarios.findMany({
      where: {
        activo: true,
        usuarios_roles: { some: { rol: { nombre: 'admin' } } },
      },
      select: { id: true, tenant_id: true },
    });

    if (admins.length === 0) return;

    await prisma.notificaciones.createMany({
      data: admins.map((u) => ({
        tenant_id: u.tenant_id,
        usuario_destino_id: u.id,
        tipo: 'nueva_organizacion',
        titulo,
        mensaje,
        leida: false,
      })),
    });
  } catch (error) {
    logNotificationError('notificarAdmins', error);
  }
}

/**
 * Looks up the area's responsable and notifies them if they exist and aren't excluded.
 * Used across workflow handlers (rechazar, devolver, anular, aprobar) to avoid
 * repeating the area lookup + conditional notification logic.
 */
export async function notificarResponsableArea(opts: {
  tenantId: number;
  areaId: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  solicitudId: number;
  excludeIds?: number[];
}): Promise<void> {
  const area = await prisma.areas.findFirst({
    where: { id: opts.areaId, tenant_id: opts.tenantId },
    select: { responsable_id: true },
  });
  if (!area?.responsable_id) return;
  if (opts.excludeIds?.includes(area.responsable_id)) return;

  await crearNotificacion({
    tenantId: opts.tenantId,
    destinatarioId: area.responsable_id,
    tipo: opts.tipo,
    titulo: opts.titulo,
    mensaje: opts.mensaje,
    solicitudId: opts.solicitudId,
  });
}

export async function notificarPorRol(
  tenantId: number,
  rolNombre: string,
  titulo: string,
  mensaje: string,
  solicitudId?: number,
): Promise<void> {
  try {
    const usuarios = await prisma.usuarios.findMany({
      where: {
        tenant_id: tenantId,
        activo: true,
        usuarios_roles: {
          some: { rol: { nombre: rolNombre } },
        },
      },
      select: { id: true },
    });

    if (usuarios.length === 0) return;

    await prisma.notificaciones.createMany({
      data: usuarios.map((u) => ({
        tenant_id: tenantId,
        usuario_destino_id: u.id,
        tipo: `notif_${rolNombre}`,
        titulo,
        mensaje,
        solicitud_id: solicitudId,
        leida: false,
      })),
    });
  } catch (error) {
    logNotificationError(`notificarPorRol:${rolNombre}`, error, undefined, solicitudId);
  }
}
