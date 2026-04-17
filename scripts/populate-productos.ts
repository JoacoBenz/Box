/**
 * One-time script: populate productos table from existing cerrada solicitudes.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/populate-productos.ts
 */
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get all items from cerrada solicitudes
  const items = await prisma.items_solicitud.findMany({
    where: {
      solicitud: { estado: 'cerrada' },
    },
    include: {
      solicitud: { select: { tenant_id: true, area_id: true } },
    },
  });

  console.log(`Found ${items.length} items from cerrada solicitudes\n`);

  // Group by tenant + normalized name
  const seen = new Map<string, (typeof items)[0]>();
  for (const item of items) {
    const key = `${item.solicitud.tenant_id}:${item.descripcion.trim().toLowerCase()}`;
    // Keep the latest one (by id)
    const existing = seen.get(key);
    if (!existing || item.id > existing.id) {
      seen.set(key, item);
    }
  }

  let created = 0;
  let linked = 0;

  for (const item of seen.values()) {
    const nombre = item.descripcion.trim();
    if (!nombre) continue;

    try {
      const producto = await prisma.productos.upsert({
        where: {
          tenant_id_nombre: { tenant_id: item.solicitud.tenant_id, nombre },
        },
        create: {
          tenant_id: item.solicitud.tenant_id,
          nombre,
          area_id: item.solicitud.area_id,
          unidad_defecto: item.unidad,
          precio_referencia: item.precio_estimado,
          link_producto: item.link_producto,
        },
        update: {
          ...(item.precio_estimado != null ? { precio_referencia: item.precio_estimado } : {}),
          ...(item.solicitud.area_id ? { area_id: item.solicitud.area_id } : {}),
        },
      });

      created++;

      // Backfill producto_id on matching items
      const updated = await prisma.items_solicitud.updateMany({
        where: {
          tenant_id: item.solicitud.tenant_id,
          descripcion: nombre,
          producto_id: null,
        },
        data: { producto_id: producto.id },
      });
      linked += updated.count;

      console.log(
        `  ✅ ${nombre} (tenant ${item.solicitud.tenant_id}) → linked ${updated.count} items`,
      );
    } catch (err: any) {
      console.log(`  ⚠️ ${nombre}: ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Created/updated ${created} productos, linked ${linked} items`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
