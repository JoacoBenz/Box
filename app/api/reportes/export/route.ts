import { withAdminOverride } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';
import ExcelJS from 'exceljs';

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
    cell.alignment = { horizontal: 'center' };
  });
}

export const GET = withAdminOverride(
  { roles: ['director', 'compras', 'tesoreria', 'admin'] },
  async (request, { session, effectiveTenantId }) => {
    const ip = getClientIp(request);
    const rl = await checkRateLimitDb(`export-reportes:${ip}`, 5, 60_000);
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
    const desde = searchParams.get('desde') || '';
    const hasta = searchParams.get('hasta') || '';
    const areaId = searchParams.get('area_id') ? parseInt(searchParams.get('area_id')!) : null;
    const tenantId = effectiveTenantId ?? session.tenantId;

    const desdeDate = desde ? new Date(desde) : null;
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;

    // Run all queries in parallel
    const [
      gastosPorProducto,
      gastosPorArea,
      evolucionMensual,
      topProveedores,
      productosMasSolicitados,
    ] = await Promise.all([
      prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(p.nombre, i.descripcion) as producto,
        a.nombre as area,
        SUM(i.cantidad)::numeric as cantidad_total,
        SUM(COALESCE(i.precio_estimado, 0) * i.cantidad)::numeric as gasto_total,
        COUNT(DISTINCT s.id)::int as num_solicitudes,
        MAX(i.precio_estimado)::numeric as ultimo_precio
      FROM items_solicitud i
      JOIN solicitudes s ON s.id = i.solicitud_id
      LEFT JOIN productos p ON p.id = i.producto_id
      LEFT JOIN areas a ON a.id = COALESCE(p.area_id, s.area_id)
      WHERE s.tenant_id = ${tenantId}
        AND s.estado = 'cerrada'
        AND (${desdeDate}::timestamp IS NULL OR s.created_at >= ${desdeDate}::timestamp)
        AND (${hastaDate}::timestamp IS NULL OR s.created_at <= ${hastaDate}::timestamp)
        AND (${areaId}::int IS NULL OR COALESCE(p.area_id, s.area_id) = ${areaId}::int)
      GROUP BY COALESCE(p.nombre, i.descripcion), a.nombre
      ORDER BY gasto_total DESC
      LIMIT 200
    `,
      prisma.$queryRaw<any[]>`
      SELECT
        a.nombre as area,
        SUM(c.monto_total)::numeric as gasto_total,
        COUNT(DISTINCT s.id)::int as num_solicitudes
      FROM solicitudes s
      JOIN areas a ON a.id = s.area_id
      JOIN compras c ON c.solicitud_id = s.id
      WHERE s.tenant_id = ${tenantId}
        AND s.estado = 'cerrada'
        AND (${desdeDate}::date IS NULL OR c.fecha_compra >= ${desdeDate}::date)
        AND (${hastaDate}::date IS NULL OR c.fecha_compra <= ${hastaDate}::date)
        AND (${areaId}::int IS NULL OR s.area_id = ${areaId}::int)
      GROUP BY a.nombre
      ORDER BY gasto_total DESC
    `,
      prisma.$queryRaw<any[]>`
      SELECT
        TO_CHAR(c.fecha_compra, 'YYYY-MM') as mes,
        SUM(c.monto_total)::numeric as gasto_total,
        COUNT(*)::int as num_compras
      FROM compras c
      WHERE c.tenant_id = ${tenantId}
        AND c.fecha_compra >= NOW() - INTERVAL '12 months'
      GROUP BY TO_CHAR(c.fecha_compra, 'YYYY-MM')
      ORDER BY mes ASC
    `,
      prisma.$queryRaw<any[]>`
      SELECT
        c.proveedor_nombre as proveedor,
        SUM(c.monto_total)::numeric as gasto_total,
        COUNT(*)::int as num_compras
      FROM compras c
      WHERE c.tenant_id = ${tenantId}
        AND (${desdeDate}::date IS NULL OR c.fecha_compra >= ${desdeDate}::date)
        AND (${hastaDate}::date IS NULL OR c.fecha_compra <= ${hastaDate}::date)
      GROUP BY c.proveedor_nombre
      ORDER BY gasto_total DESC
      LIMIT 20
    `,
      prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(p.nombre, i.descripcion) as producto,
        a.nombre as area,
        COUNT(DISTINCT s.id)::int as num_solicitudes,
        SUM(i.cantidad)::numeric as cantidad_total
      FROM items_solicitud i
      JOIN solicitudes s ON s.id = i.solicitud_id
      LEFT JOIN productos p ON p.id = i.producto_id
      LEFT JOIN areas a ON a.id = COALESCE(p.area_id, s.area_id)
      WHERE s.tenant_id = ${tenantId}
        AND s.estado NOT IN ('borrador', 'anulada')
        AND (${areaId}::int IS NULL OR COALESCE(p.area_id, s.area_id) = ${areaId}::int)
      GROUP BY COALESCE(p.nombre, i.descripcion), a.nombre
      ORDER BY num_solicitudes DESC
      LIMIT 20
    `,
    ]);

    const num = (v: any) =>
      v != null && typeof v === 'object' && 'toNumber' in v
        ? (v as any).toNumber()
        : typeof v === 'bigint'
          ? Number(v)
          : (v ?? 0);

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Gasto por Producto
    const s1 = workbook.addWorksheet('Gasto por Producto');
    styleHeader(
      s1.addRow([
        'Producto',
        'Área',
        'Cantidad Total',
        'Gasto Total',
        'Solicitudes',
        'Último Precio',
      ]),
    );
    for (const r of gastosPorProducto) {
      s1.addRow([
        r.producto,
        r.area ?? '—',
        num(r.cantidad_total),
        num(r.gasto_total),
        num(r.num_solicitudes),
        num(r.ultimo_precio),
      ]);
    }
    s1.getColumn(1).width = 30;
    s1.getColumn(2).width = 18;
    s1.getColumn(3).width = 16;
    s1.getColumn(4).width = 16;
    s1.getColumn(4).numFmt = '#,##0.00';
    s1.getColumn(5).width = 14;
    s1.getColumn(6).width = 16;
    s1.getColumn(6).numFmt = '#,##0.00';

    // Sheet 2: Gasto por Área
    const s2 = workbook.addWorksheet('Gasto por Área');
    styleHeader(s2.addRow(['Área', 'Gasto Total', 'Solicitudes']));
    for (const r of gastosPorArea) {
      s2.addRow([r.area, num(r.gasto_total), num(r.num_solicitudes)]);
    }
    s2.getColumn(1).width = 22;
    s2.getColumn(2).width = 16;
    s2.getColumn(2).numFmt = '#,##0.00';
    s2.getColumn(3).width = 14;

    // Sheet 3: Top Proveedores
    const s3 = workbook.addWorksheet('Top Proveedores');
    styleHeader(s3.addRow(['Proveedor', 'Gasto Total', 'Nº Compras']));
    for (const r of topProveedores) {
      s3.addRow([r.proveedor, num(r.gasto_total), num(r.num_compras)]);
    }
    s3.getColumn(1).width = 30;
    s3.getColumn(2).width = 16;
    s3.getColumn(2).numFmt = '#,##0.00';
    s3.getColumn(3).width = 14;

    // Sheet 4: Productos Más Solicitados
    const s4 = workbook.addWorksheet('Más Solicitados');
    styleHeader(s4.addRow(['Producto', 'Área', 'Solicitudes', 'Cantidad Total']));
    for (const r of productosMasSolicitados) {
      s4.addRow([r.producto, r.area ?? '—', num(r.num_solicitudes), num(r.cantidad_total)]);
    }
    s4.getColumn(1).width = 30;
    s4.getColumn(2).width = 18;
    s4.getColumn(3).width = 14;
    s4.getColumn(4).width = 16;

    // Sheet 5: Evolución Mensual
    const s5 = workbook.addWorksheet('Evolución Mensual');
    styleHeader(s5.addRow(['Mes', 'Gasto Total', 'Nº Compras']));
    const meses = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    for (const r of evolucionMensual) {
      const [year, month] = (r.mes as string).split('-');
      s5.addRow([`${meses[parseInt(month) - 1]} ${year}`, num(r.gasto_total), num(r.num_compras)]);
    }
    s5.getColumn(1).width = 16;
    s5.getColumn(2).width = 16;
    s5.getColumn(2).numFmt = '#,##0.00';
    s5.getColumn(3).width = 14;

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reportes_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  },
);
