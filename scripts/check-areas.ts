import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';
async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const areas = await prisma.areas.findMany({
    select: { id: true, nombre: true, tenant_id: true, tenant: { select: { nombre: true } } },
    orderBy: [{ tenant_id: 'asc' }, { id: 'asc' }],
  });
  for (const a of areas)
    process.stderr.write(
      `  Tenant ${a.tenant_id} (${a.tenant.nombre}) | Area: ${a.nombre} (ID:${a.id})\n`,
    );
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
