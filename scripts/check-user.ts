import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const users = await p.usuarios.findMany({
    where: { email: 'joakobenz@gmail.com' },
    include: { usuarios_roles: { include: { rol: true } } },
  });
  console.log('Found users:', users.length);
  for (const u of users) {
    console.log(`  id=${u.id} tenant=${u.tenant_id} area=${u.area_id} oauth=${u.oauth_provider} roles=${u.usuarios_roles.map(r => r.rol.nombre).join(',')}`);
  }
  if (users.length > 0) {
    // Delete all
    for (const u of users) {
      await p.usuarios_roles.deleteMany({ where: { usuario_id: u.id } });
      await p.usuarios.delete({ where: { id: u.id } });
      console.log(`  DELETED id=${u.id}`);
    }
  } else {
    console.log('  No user found - clean slate');
  }
}

main().catch(e => console.error('Error:', e)).finally(() => p.$disconnect());
