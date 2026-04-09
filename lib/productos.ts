import { prisma } from './prisma';

/**
 * Auto-create or update productos from a solicitud's items when it reaches 'cerrada'.
 * - New products: created from item descripcion, unidad, precio_estimado, area from solicitud
 * - Existing products: precio_referencia updated with latest price
 * - Items get linked to their producto via producto_id
 */
export async function sincronizarProductos(tenantId: number, solicitudId: number) {
  // Fetch solicitud to get area_id
  const solicitud = await prisma.solicitudes.findUnique({
    where: { id: solicitudId },
    select: { area_id: true },
  });

  const items = await prisma.items_solicitud.findMany({
    where: { solicitud_id: solicitudId, tenant_id: tenantId },
  });

  for (const item of items) {
    const nombreNormalizado = item.descripcion.trim();
    if (!nombreNormalizado) continue;

    try {
      // Upsert: create if not exists, update precio_referencia if exists
      const producto = await prisma.productos.upsert({
        where: {
          tenant_id_nombre: { tenant_id: tenantId, nombre: nombreNormalizado },
        },
        create: {
          tenant_id: tenantId,
          nombre: nombreNormalizado,
          area_id: solicitud?.area_id ?? null,
          unidad_defecto: item.unidad,
          precio_referencia: item.precio_estimado,
          link_producto: item.link_producto,
        },
        update: {
          // Update reference price with the latest purchase price
          ...(item.precio_estimado != null ? { precio_referencia: item.precio_estimado } : {}),
          // Update link if provided and product didn't have one
          ...(item.link_producto ? { link_producto: item.link_producto } : {}),
          // Update area if changed
          ...(solicitud?.area_id ? { area_id: solicitud.area_id } : {}),
        },
      });

      // Link item to product if not already linked
      if (!item.producto_id) {
        await prisma.items_solicitud.update({
          where: { id: item.id },
          data: { producto_id: producto.id },
        });
      }
    } catch {
      // Ignore individual product errors (e.g., race condition on unique constraint)
      continue;
    }
  }
}
