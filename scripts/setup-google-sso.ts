import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const tenant = await prisma.tenants.findFirst({ where: { nombre: { contains: 'Test' } } });
  if (!tenant) { console.log('❌ Tenant "Escuela Test" not found'); return; }
  console.log('✅ Tenant:', tenant.id, tenant.nombre);

  // Enable Google SSO
  for (const [clave, valor] of [['sso_google_habilitado', 'true'], ['sso_dominio', 'gmail.com']] as const) {
    await prisma.configuracion.upsert({
      where: { tenant_id_clave: { tenant_id: tenant.id, clave } },
      update: { valor },
      create: { tenant_id: tenant.id, clave, valor },
    });
    console.log(`✅ ${clave} = ${valor}`);
  }

  // Create or find user
  const area = await prisma.areas.findFirst({ where: { tenant_id: tenant.id } });
  let user = await prisma.usuarios.findFirst({ where: { email: 'joakobenz@gmail.com' } });
  if (user) {
    console.log('✅ User already exists:', user.id);
  } else {
    user = await prisma.usuarios.create({
      data: {
        tenant_id: tenant.id,
        nombre: 'Joaquín Benz',
        email: 'joakobenz@gmail.com',
        password_hash: 'SSO_ONLY',
        area_id: area!.id,
        activo: true,
      },
    });
    console.log('✅ User created:', user.id);
  }

  // Assign admin role
  const rol = await prisma.roles.findFirst({ where: { nombre: 'admin' } });
  if (rol) {
    const existing = await prisma.usuarios_roles.findFirst({ where: { usuario_id: user.id, rol_id: rol.id } });
    if (!existing) {
      await prisma.usuarios_roles.create({ data: { usuario_id: user.id, rol_id: rol.id } });
      console.log('✅ Role assigned: admin');
    } else {
      console.log('✅ Role already assigned: admin');
    }
  }

  console.log('\n🎉 Google SSO ready! Try logging in with joakobenz@gmail.com');
}

main().catch(e => console.error('❌', e)).finally(() => prisma.$disconnect());
