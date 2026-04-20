import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';
async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });
  const existing = await prisma.roles.findFirst({ where: { nombre: 'compras' } });
  if (existing) {
    process.stderr.write('Role "compras" already exists (ID:' + existing.id + ')\n');
  } else {
    const role = await prisma.roles.create({ data: { nombre: 'compras' } });
    process.stderr.write('Created role "compras" (ID:' + role.id + ')\n');
  }
  const all = await prisma.roles.findMany();
  for (const r of all) process.stderr.write('  ID:' + r.id + ' | ' + r.nombre + '\n');
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
