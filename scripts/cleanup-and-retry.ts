import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  // Delete the unverified registration
  const deleted = await prisma.registros_pendientes.deleteMany({
    where: { email: 'joaquinbenz99@gmail.com', verificado: false },
  });
  process.stderr.write(`Deleted ${deleted.count} pending registration(s)\n`);

  // Also clean up the ones that weren't deleted before
  const deleted2 = await prisma.registros_pendientes.deleteMany({
    where: { email: { in: ['jbenz@mta.edu.ar', 'jbenz@bexovar.com'] } },
  });
  process.stderr.write(`Deleted ${deleted2.count} old registration(s)\n`);

  const remaining = await prisma.registros_pendientes.findMany();
  process.stderr.write(`Remaining registrations: ${remaining.length}\n`);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
