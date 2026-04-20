import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const tenants = await prisma.tenants.findMany({
    select: { id: true, nombre: true, estado: true, slug: true },
  });
  process.stderr.write('=== TENANTS ===\n');
  for (const t of tenants)
    process.stderr.write(`  ID:${t.id} | ${t.nombre} | estado:${t.estado} | slug:${t.slug}\n`);

  const pending = await prisma.registros_pendientes.findMany({
    select: { id: true, email: true, verificado: true, nombre_organizacion: true },
  });
  process.stderr.write('=== PENDING REGISTRATIONS ===\n');
  for (const p of pending)
    process.stderr.write(
      `  ID:${p.id} | ${p.email} | verified:${p.verificado} | org:${p.nombre_organizacion}\n`,
    );

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
