import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';
async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  // For each non-demo tenant: ensure "Dirección" exists, delete all others, reassign users
  const tenants = await prisma.tenants.findMany({ where: { id: { not: 1 } } });

  for (const t of tenants) {
    const areas = await prisma.areas.findMany({ where: { tenant_id: t.id } });
    let direccion = areas.find((a) => a.nombre === 'Dirección');

    if (!direccion) {
      // Create Dirección if it doesn't exist
      direccion = await prisma.areas.create({ data: { tenant_id: t.id, nombre: 'Dirección' } });
      process.stderr.write(`  Created "Dirección" for ${t.nombre}\n`);
    }

    // Move users from other areas to Dirección
    const otherAreas = areas.filter((a) => a.id !== direccion!.id);
    for (const a of otherAreas) {
      await prisma.usuarios.updateMany({
        where: { area_id: a.id },
        data: { area_id: direccion.id },
      });
      await prisma.areas.update({ where: { id: a.id }, data: { responsable_id: null } });
      await prisma.areas.delete({ where: { id: a.id } });
      process.stderr.write(`  Deleted "${a.nombre}" from ${t.nombre}\n`);
    }

    // Make sure Dirección has a responsable (the first user with director role)
    const director = await prisma.usuarios.findFirst({
      where: { tenant_id: t.id, usuarios_roles: { some: { rol: { nombre: 'director' } } } },
    });
    if (director) {
      await prisma.areas.update({
        where: { id: direccion.id },
        data: { responsable_id: director.id },
      });
    }
  }

  process.stderr.write('✅ Done\n');
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
