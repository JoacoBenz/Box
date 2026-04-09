import { withAuth } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/app/generated/prisma/client';

export const GET = withAuth({ roles: ['director', 'compras', 'tesoreria', 'admin'] }, async (request, { session, db }) => {
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';
  const categoria = searchParams.get('categoria') || '';

  const tenantId = session.tenantId;

  // Build date filter fragments
  const desdeDate = desde ? new Date(desde) : null;
  const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : null;

  // 1. Gasto por producto — items from cerrada solicitudes
  const gastosPorProducto = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(p.nombre, i.descripcion) as producto,
      p.categoria,
      SUM(i.cantidad)::numeric as cantidad_total,
      SUM(COALESCE(i.precio_estimado, 0) * i.cantidad)::numeric as gasto_total,
      COUNT(DISTINCT s.id)::int as num_solicitudes,
      MAX(i.precio_estimado)::numeric as ultimo_precio
    FROM items_solicitud i
    JOIN solicitudes s ON s.id = i.solicitud_id
    LEFT JOIN productos p ON p.id = i.producto_id
    WHERE s.tenant_id = ${tenantId}
      AND s.estado = 'cerrada'
      AND (${desdeDate}::timestamp IS NULL OR s.created_at >= ${desdeDate}::timestamp)
      AND (${hastaDate}::timestamp IS NULL OR s.created_at <= ${hastaDate}::timestamp)
      AND (${categoria || null}::text IS NULL OR p.categoria = ${categoria || null}::text)
    GROUP BY COALESCE(p.nombre, i.descripcion), p.categoria
    ORDER BY gasto_total DESC
    LIMIT 50
  `;

  // 2. Gasto por categoría
  const gastosPorCategoria = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(p.categoria, 'Sin categoría') as categoria,
      SUM(COALESCE(i.precio_estimado, 0) * i.cantidad)::numeric as gasto_total,
      COUNT(DISTINCT s.id)::int as num_solicitudes
    FROM items_solicitud i
    JOIN solicitudes s ON s.id = i.solicitud_id
    LEFT JOIN productos p ON p.id = i.producto_id
    WHERE s.tenant_id = ${tenantId}
      AND s.estado = 'cerrada'
      AND (${desdeDate}::timestamp IS NULL OR s.created_at >= ${desdeDate}::timestamp)
      AND (${hastaDate}::timestamp IS NULL OR s.created_at <= ${hastaDate}::timestamp)
    GROUP BY COALESCE(p.categoria, 'Sin categoría')
    ORDER BY gasto_total DESC
  `;

  // 3. Gasto por área
  const gastosPorArea = await prisma.$queryRaw<any[]>`
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
    GROUP BY a.nombre
    ORDER BY gasto_total DESC
  `;

  // 4. Evolución mensual (last 12 months)
  const evolucionMensual = await prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(c.fecha_compra, 'YYYY-MM') as mes,
      SUM(c.monto_total)::numeric as gasto_total,
      COUNT(*)::int as num_compras
    FROM compras c
    WHERE c.tenant_id = ${tenantId}
      AND c.fecha_compra >= NOW() - INTERVAL '12 months'
    GROUP BY TO_CHAR(c.fecha_compra, 'YYYY-MM')
    ORDER BY mes ASC
  `;

  // 5. Top proveedores
  const topProveedores = await prisma.$queryRaw<any[]>`
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
    LIMIT 10
  `;

  // 6. Productos más solicitados
  const productosMasSolicitados = await prisma.$queryRaw<any[]>`
    SELECT
      COALESCE(p.nombre, i.descripcion) as producto,
      p.categoria,
      COUNT(DISTINCT s.id)::int as num_solicitudes,
      SUM(i.cantidad)::numeric as cantidad_total
    FROM items_solicitud i
    JOIN solicitudes s ON s.id = i.solicitud_id
    LEFT JOIN productos p ON p.id = i.producto_id
    WHERE s.tenant_id = ${tenantId}
      AND s.estado NOT IN ('borrador', 'anulada')
    GROUP BY COALESCE(p.nombre, i.descripcion), p.categoria
    ORDER BY num_solicitudes DESC
    LIMIT 10
  `;

  // 7. Available categories for filter
  const categorias = await db.productos.findMany({
    where: { activo: true },
    select: { categoria: true },
    distinct: ['categoria'],
  });

  // Serialize Decimal/BigInt values to numbers
  const serialize = (rows: any[]) => rows.map(r => {
    const obj: any = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'bigint') obj[k] = Number(v);
      else if (v != null && typeof v === 'object' && 'toNumber' in v) obj[k] = (v as any).toNumber();
      else obj[k] = v;
    }
    return obj;
  });

  return Response.json({
    gastosPorProducto: serialize(gastosPorProducto),
    gastosPorCategoria: serialize(gastosPorCategoria),
    gastosPorArea: serialize(gastosPorArea),
    evolucionMensual: serialize(evolucionMensual),
    topProveedores: serialize(topProveedores),
    productosMasSolicitados: serialize(productosMasSolicitados),
    categorias: categorias.map(c => c.categoria).filter(Boolean),
  });
});
