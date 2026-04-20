import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Seed roles
  const roleNames = [
    { nombre: 'solicitante', descripcion: 'Crea solicitudes de compra' },
    { nombre: 'responsable_area', descripcion: 'Valida solicitudes de su área' },
    { nombre: 'director', descripcion: 'Aprueba o rechaza gastos' },
    { nombre: 'compras', descripcion: 'Gestiona compras y programa pagos' },
    { nombre: 'tesoreria', descripcion: 'Ejecuta pagos y controla finanzas' },
    { nombre: 'admin', descripcion: 'Administrador de organización' },
    { nombre: 'super_admin', descripcion: 'Administrador de plataforma' },
  ];

  for (const role of roleNames) {
    await prisma.roles.upsert({
      where: { nombre: role.nombre },
      update: {},
      create: role,
    });
  }

  console.log('Roles seeded successfully');

  // --- Seed default billing plan ---
  await prisma.planes.upsert({
    where: { nombre: 'box-principal' },
    update: {
      precio_ars: 152000,
      trial_dias: 14,
      limite_areas: 3,
      limite_cc_por_area: 2,
      limite_responsable_area: 1,
      limite_director: 1,
      limite_tesoreria: 1,
      limite_admin: 1,
      limite_compras: 1,
    },
    create: {
      nombre: 'box-principal',
      precio_ars: 152000,
      trial_dias: 14,
      limite_areas: 3,
      limite_cc_por_area: 2,
      limite_responsable_area: 1,
      limite_director: 1,
      limite_tesoreria: 1,
      limite_admin: 1,
      limite_compras: 1,
    },
  });
  console.log('Default plan (box-principal) seeded');

  // --- Platform tenant (hidden, for super admin only) ---
  const platformTenant = await prisma.tenants.upsert({
    where: { slug: '__platform__' },
    update: {},
    create: {
      nombre: 'Plataforma',
      slug: '__platform__',
      email_contacto: 'super@box.com',
      moneda: 'ARS',
    },
  });

  const superAdminRole = await prisma.roles.findUnique({ where: { nombre: 'super_admin' } });
  if (!superAdminRole) throw new Error('super_admin role not found');

  const passwordHash = await bcrypt.hash('admin1234', 12);
  const superAdmin = await prisma.usuarios.upsert({
    where: { tenant_id_email: { tenant_id: platformTenant.id, email: 'super@box.com' } },
    update: {},
    create: {
      tenant_id: platformTenant.id,
      nombre: 'Super Admin',
      email: 'super@box.com',
      password_hash: passwordHash,
    },
  });

  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: superAdmin.id, rol_id: superAdminRole.id } },
    update: {},
    create: { usuario_id: superAdmin.id, rol_id: superAdminRole.id },
  });

  console.log('Platform tenant & super admin seeded. Login: super@box.com / admin1234');

  // --- Demo tenant (for testing) ---
  const testTenant = await prisma.tenants.upsert({
    where: { slug: 'org-demo' },
    update: {},
    create: {
      nombre: 'Organización Demo',
      slug: 'org-demo',
      email_contacto: 'admin@demo.com',
      moneda: 'ARS',
    },
  });

  const adminRole = await prisma.roles.findUnique({ where: { nombre: 'admin' } });
  const directorRole = await prisma.roles.findUnique({ where: { nombre: 'director' } });

  if (!adminRole || !directorRole) throw new Error('Roles not found');

  // Create default area
  const areaDir = await prisma.areas.upsert({
    where: { tenant_id_nombre: { tenant_id: testTenant.id, nombre: 'Administración' } },
    update: {},
    create: { tenant_id: testTenant.id, nombre: 'Administración' },
  });

  // Create admin user
  const adminUser = await prisma.usuarios.upsert({
    where: { tenant_id_email: { tenant_id: testTenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenant_id: testTenant.id,
      nombre: 'Admin Demo',
      email: 'admin@demo.com',
      password_hash: passwordHash,
      area_id: areaDir.id,
    },
  });

  // Assign roles
  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: adminUser.id, rol_id: adminRole.id } },
    update: {},
    create: { usuario_id: adminUser.id, rol_id: adminRole.id },
  });
  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: adminUser.id, rol_id: directorRole.id } },
    update: {},
    create: { usuario_id: adminUser.id, rol_id: directorRole.id },
  });

  // Set area responsable
  await prisma.areas.update({
    where: { id: areaDir.id },
    data: { responsable_id: adminUser.id },
  });

  console.log('Test tenant seeded. Login: admin@demo.com / admin1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
