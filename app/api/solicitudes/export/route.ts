import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['director', 'tesoreria', 'compras', 'admin'])) {
      return apiError('FORBIDDEN', 'No tenés permisos para exportar', 403);
    }

    const db = tenantPrisma(session.tenantId);
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');

    const where: any = {};
    if (estado) where.estado = { in: estado.split(',') };

    const solicitudes = await db.solicitudes.findMany({
      where,
      include: {
        area: { select: { nombre: true } },
        solicitante: { select: { nombre: true } },
        centro_costo: { select: { nombre: true, codigo: true } },
        compras: { select: { monto_total: true, fecha_compra: true, proveedor_nombre: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 5000,
    });

    // Build CSV
    const headers = [
      'Número', 'Título', 'Estado', 'Urgencia', 'Área', 'Solicitante',
      'Centro de Costo', 'Monto Estimado', 'Monto Compra', 'Proveedor',
      'Fecha Envío', 'Fecha Aprobación', 'Fecha Compra', 'Creado'
    ];

    const rows = solicitudes.map((s: any) => [
      s.numero,
      `"${(s.titulo || '').replace(/"/g, '""')}"`,
      s.estado,
      s.urgencia,
      s.area?.nombre ?? '',
      s.solicitante?.nombre ?? '',
      s.centro_costo ? `${s.centro_costo.codigo} - ${s.centro_costo.nombre}` : '',
      s.monto_estimado_total ?? '',
      s.compras[0]?.monto_total ?? '',
      s.compras[0]?.proveedor_nombre ?? '',
      s.fecha_envio ? new Date(s.fecha_envio).toLocaleDateString('es-AR') : '',
      s.fecha_aprobacion ? new Date(s.fecha_aprobacion).toLocaleDateString('es-AR') : '',
      s.compras[0]?.fecha_compra ? new Date(s.compras[0].fecha_compra).toLocaleDateString('es-AR') : '',
      new Date(s.created_at).toLocaleDateString('es-AR'),
    ]);

    // UTF-8 BOM for Excel compatibility
    const bom = '\uFEFF';
    const csv = bom + headers.join(',') + '\n' + rows.map((r: any[]) => r.join(',')).join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="solicitudes_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e: any) {
    if (e.message === 'No autenticado') {
      return apiError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return apiError('INTERNAL', 'Error exportando solicitudes', 500);
  }
}
