import { withAdminOverride } from '@/lib/api-handler';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import ExcelJS from 'exceljs';

export const GET = withAdminOverride(
  { roles: ['director', 'tesoreria', 'compras', 'admin'] },
  async (request, { db }) => {
    const ip = getClientIp(request);
    const rl = await checkRateLimitDb(`export:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return Response.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Demasiadas exportaciones. Intentá de nuevo en un minuto.',
          },
        },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const areaId = searchParams.get('area_id');
    const solicitanteId = searchParams.get('solicitante_id');
    const q = searchParams.get('q');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');

    const where: any = {};
    if (estado) where.estado = { in: estado.split(',') };
    if (areaId) where.area_id = parseInt(areaId);
    if (solicitanteId) where.solicitante_id = parseInt(solicitanteId);
    if (q) {
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' as const } },
        { titulo: { contains: q, mode: 'insensitive' as const } },
      ];
    }
    if (desde || hasta) {
      where.created_at = {};
      if (desde) where.created_at.gte = new Date(desde + 'T00:00:00');
      if (hasta) where.created_at.lte = new Date(hasta + 'T23:59:59');
    }

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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Solicitudes');

    const headers = [
      'Número',
      'Título',
      'Estado',
      'Urgencia',
      'Área',
      'Solicitante',
      'Centro de Costo',
      'Monto Compra',
      'Proveedor',
      'Fecha Envío',
      'Fecha Aprobación',
      'Fecha Compra',
      'Creado',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center' };
    });

    for (const s of solicitudes as any[]) {
      sheet.addRow([
        s.numero,
        s.titulo || '',
        s.estado,
        s.urgencia,
        s.area?.nombre ?? '',
        s.solicitante?.nombre ?? '',
        s.centro_costo ? `${s.centro_costo.codigo} - ${s.centro_costo.nombre}` : '',
        s.compras[0]?.monto_total ? Number(s.compras[0].monto_total) : null,
        s.compras[0]?.proveedor_nombre ?? '',
        s.fecha_envio ? new Date(s.fecha_envio) : null,
        s.fecha_aprobacion ? new Date(s.fecha_aprobacion) : null,
        s.compras[0]?.fecha_compra ? new Date(s.compras[0].fecha_compra) : null,
        new Date(s.created_at),
      ]);
    }

    // Format columns
    sheet.columns.forEach((col) => {
      col.width = 18;
    });
    sheet.getColumn(2).width = 30; // Título
    sheet.getColumn(8).numFmt = '#,##0.00'; // Monto
    [10, 11, 12, 13].forEach((i) => {
      sheet.getColumn(i).numFmt = 'dd/mm/yyyy';
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="solicitudes_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  },
);
