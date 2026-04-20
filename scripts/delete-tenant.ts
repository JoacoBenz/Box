import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

  const tenantName = 'Natalia Lust SRL';
  const tenant = await prisma.tenants.findFirst({ where: { nombre: tenantName } });
  if (!tenant) {
    process.stderr.write(`Tenant "${tenantName}" not found\n`);
    return;
  }

  const tid = tenant.id;
  process.stderr.write(`Deleting tenant "${tenantName}" (ID: ${tid})...\n`);

  // Delete in dependency order
  await prisma.usuarios_roles.deleteMany({ where: { usuario: { tenant_id: tid } } });
  await prisma.configuracion.deleteMany({ where: { tenant_id: tid } });
  await prisma.areas.updateMany({ where: { tenant_id: tid }, data: { responsable_id: null } });
  await prisma.log_auditoria.deleteMany({ where: { tenant_id: tid } });
  await prisma.notificaciones.deleteMany({ where: { tenant_id: tid } });
  await prisma.usuarios.deleteMany({ where: { tenant_id: tid } });
  await prisma.areas.deleteMany({ where: { tenant_id: tid } });
  await prisma.tenants.delete({ where: { id: tid } });

  // Also delete the pending registration
  await prisma.registros_pendientes.deleteMany({ where: { email: 'joaquinbenz99@gmail.com' } });

  process.stderr.write(`✅ Tenant "${tenantName}" and related data deleted\n`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
