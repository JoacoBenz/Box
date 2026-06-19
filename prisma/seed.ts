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
      precio_ars: 110000,
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
      precio_ars: 110000,
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
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'super@box.com';
  const platformTenant = await prisma.tenants.upsert({
    where: { slug: '__platform__' },
    update: {},
    create: {
      nombre: 'Plataforma',
      slug: '__platform__',
      email_contacto: superAdminEmail,
      moneda: 'ARS',
    },
  });

  const superAdminRole = await prisma.roles.findUnique({ where: { nombre: 'super_admin' } });
  if (!superAdminRole) throw new Error('super_admin role not found');

  // Password: use SUPER_ADMIN_INITIAL_PASSWORD from env if provided; otherwise
  // generate a random 24-char password and print it on stderr so the operator
  // running the seed can capture it. We never log to stdout to avoid CI/build
  // pipelines caching it.
  let superAdminPassword = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
  let generated = false;
  if (!superAdminPassword) {
    const { randomInt } = await import('crypto');
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*?-';
    superAdminPassword = Array.from({ length: 24 }, () => chars[randomInt(chars.length)]).join('');
    generated = true;
  }
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);
  const superAdmin = await prisma.usuarios.upsert({
    where: { tenant_id_email: { tenant_id: platformTenant.id, email: superAdminEmail } },
    update: {},
    create: {
      tenant_id: platformTenant.id,
      nombre: 'Super Admin',
      email: superAdminEmail,
      password_hash: passwordHash,
    },
  });

  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: superAdmin.id, rol_id: superAdminRole.id } },
    update: {},
    create: { usuario_id: superAdmin.id, rol_id: superAdminRole.id },
  });

  if (generated) {
    process.stderr.write(
      `\n\n===================================================================\n` +
        `⚠  Super admin creado con password random. GUARDALA AHORA:\n\n` +
        `   Email:    ${superAdminEmail}\n` +
        `   Password: ${superAdminPassword}\n\n` +
        `   Esta línea NO se vuelve a imprimir. Para fijarla, corré el seed\n` +
        `   con SUPER_ADMIN_INITIAL_PASSWORD=<tu-pw> antes del comando.\n` +
        `===================================================================\n\n`,
    );
  } else {
    console.log(`Platform tenant & super admin seeded for ${superAdminEmail}`);
  }

  // --- Demo tenant (for testing) ---
  const testTenant = await prisma.tenants.upsert({
    where: { slug: 'org-demo' },
    update: { nombre: 'BEXOVAR' },
    create: {
      nombre: 'BEXOVAR',
      slug: 'org-demo',
      email_contacto: 'admin@demo.com',
      moneda: 'ARS',
    },
  });

  const adminRole = await prisma.roles.findUnique({ where: { nombre: 'admin' } });
  const directorRole = await prisma.roles.findUnique({ where: { nombre: 'director' } });
  const solicitanteRole = await prisma.roles.findUnique({ where: { nombre: 'solicitante' } });
  const respAreaRole = await prisma.roles.findUnique({ where: { nombre: 'responsable_area' } });

  if (!adminRole || !directorRole || !solicitanteRole || !respAreaRole)
    throw new Error('Roles not found');

  // Create default area
  const areaDir = await prisma.areas.upsert({
    where: { tenant_id_nombre: { tenant_id: testTenant.id, nombre: 'Administración' } },
    update: {},
    create: { tenant_id: testTenant.id, nombre: 'Administración' },
  });

  // Create admin user
  const adminUser = await prisma.usuarios.upsert({
    where: { tenant_id_email: { tenant_id: testTenant.id, email: 'admin@demo.com' } },
    update: { nombre: 'Martín Acosta' },
    create: {
      tenant_id: testTenant.id,
      nombre: 'Martín Acosta',
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
  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: adminUser.id, rol_id: solicitanteRole.id } },
    update: {},
    create: { usuario_id: adminUser.id, rol_id: solicitanteRole.id },
  });
  // El admin es responsable_id del área — sin este rol no puede validar solicitudes
  await prisma.usuarios_roles.upsert({
    where: { usuario_id_rol_id: { usuario_id: adminUser.id, rol_id: respAreaRole.id } },
    update: {},
    create: { usuario_id: adminUser.id, rol_id: respAreaRole.id },
  });

  // Set area responsable
  await prisma.areas.update({
    where: { id: areaDir.id },
    data: { responsable_id: adminUser.id },
  });

  // Create trial subscription for demo tenant
  const plan = await prisma.planes.findUnique({ where: { nombre: 'box-principal' } });
  if (plan) {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + plan.trial_dias * 24 * 60 * 60 * 1000);
    await prisma.suscripciones.upsert({
      where: { tenant_id: testTenant.id },
      update: { trial_ends_at: trialEndsAt, estado: 'trialing' },
      create: {
        tenant_id: testTenant.id,
        plan_id: plan.id,
        estado: 'trialing',
        trial_starts_at: now,
        trial_ends_at: trialEndsAt,
      },
    });
    console.log('Demo subscription created (14-day trial)');
  }

  console.log('Test tenant seeded. Login: admin@demo.com / admin1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
