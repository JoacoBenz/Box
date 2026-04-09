import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const p = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  // Check tenants and SSO config
  const tenants = await p.tenants.findMany({
    where: { estado: 'activo', desactivado: false },
    include: { configuracion: true },
  });
  for (const t of tenants) {
    const configs = Object.fromEntries(t.configuracion.map(c => [c.clave, c.valor]));
    console.log(`Tenant ${t.id} "${t.nombre}": sso_google=${configs['sso_google_habilitado']}, domain=${configs['sso_dominio']}`);
  }

  // Check user
  const u = await p.usuarios.findFirst({ where: { email: 'joakobenz@gmail.com' } });
  console.log('User joakobenz@gmail.com:', u ? `exists id=${u.id} area=${u.area_id}` : 'NOT FOUND');
}

main().catch(e => console.error('Error:', e)).finally(() => p.$disconnect());
