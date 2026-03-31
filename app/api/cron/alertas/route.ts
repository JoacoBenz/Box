import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { crearNotificacion, notificarPorRol } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const hace24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const hace5dias = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

  let alertas = 0;

  try {
    // Alerta 1: Compras registradas hace >24hs sin recepción
    const comprasSinRecepcion = await prisma.compras.findMany({
      where: {
        created_at: { lt: hace24h },
        solicitud: { estado: 'comprada' },
      },
      include: {
        solicitud: { select: { id: true, titulo: true, tenant_id: true, solicitante_id: true } },
      },
    });

    for (const compra of comprasSinRecepcion) {
      const sol = compra.solicitud;
      await crearNotificacion({
        tenantId: sol.tenant_id,
        destinatarioId: sol.solicitante_id,
        tipo: 'alerta_recepcion_pendiente',
        titulo: 'Recepción pendiente',
        mensaje: `Han pasado más de 24hs desde la compra de "${sol.titulo}". Confirmá la recepción cuando recibas el pedido.`,
        solicitudId: sol.id,
      });

      // Also notify tesoreria/compras
      await notificarPorRol(sol.tenant_id, 'tesoreria', 'Recepción sin confirmar', `"${sol.titulo}" fue comprado hace más de 24hs y aún no tiene recepción confirmada.`, sol.id);

      alertas++;
    }

    // Alerta 2: Solicitudes en estado 'comprada' hace >5 días sin recepción
    const solicitudesCompradas = await prisma.solicitudes.findMany({
      where: {
        estado: 'comprada',
        updated_at: { lt: hace5dias },
      },
      select: { id: true, titulo: true, tenant_id: true, solicitante_id: true },
    });

    for (const sol of solicitudesCompradas) {
      await crearNotificacion({
        tenantId: sol.tenant_id,
        destinatarioId: sol.solicitante_id,
        tipo: 'alerta_recepcion_vencida',
        titulo: 'Recepción vencida',
        mensaje: `La solicitud "${sol.titulo}" lleva más de 5 días en estado "Comprada" sin confirmar recepción. Por favor confirmá o reportá si hubo algún problema.`,
        solicitudId: sol.id,
      });
      alertas++;
    }

    return Response.json({ ok: true, alertas_enviadas: alertas });
  } catch (error) {
    console.error('Error en cron alertas:', error);
    return Response.json({ error: 'Error interno' }, { status: 500 });
  }
}
