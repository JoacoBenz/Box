/**
 * Seed script: creates "Escuela Test" organization with areas and one user per role.
 * Run: npx tsx prisma/seed-test-org.ts
 */
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const PASSWORD = 'Testing123!';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Get all roles
  const roles = await prisma.roles.findMany();
  const roleMap = Object.fromEntries(roles.map(r => [r.nombre, r.id]));

  if (!roleMap.solicitante || !roleMap.director) {
    throw new Error('Roles not found. Run prisma/seed.ts first.');
  }

  // 1. Create tenant
  const tenant = await prisma.tenants.upsert({
    where: { slug: 'escuela-test' },
    update: {},
    create: {
      nombre: 'Escuela Test',
      slug: 'escuela-test',
      email_contacto: 'admin@escuelatest.com',
      moneda: 'ARS',
      estado: 'activo',
    },
  });

  console.log(`Tenant: ${tenant.nombre} (id: ${tenant.id})`);

  // 2. Create areas
  const areasData = [
    { nombre: 'Dirección', tenant_id: tenant.id },
    { nombre: 'Administración', tenant_id: tenant.id },
    { nombre: 'Docentes', tenant_id: tenant.id },
    { nombre: 'Mantenimiento', tenant_id: tenant.id },
  ];

  const areas: Record<string, { id: number; nombre: string }> = {};
  for (const a of areasData) {
    const area = await prisma.areas.upsert({
      where: { tenant_id_nombre: { tenant_id: tenant.id, nombre: a.nombre } },
      update: {},
      create: a,
    });
    areas[a.nombre] = area;
  }

  console.log(`Areas: ${Object.keys(areas).join(', ')}`);

  // 3. Create configuration
  const configs = [
    { clave: 'moneda', valor: 'ARS' },
    { clave: 'umbral_aprobacion_responsable', valor: '0' },
    { clave: 'umbral_aprobacion_director', valor: '999999999' },
    { clave: 'sso_dominio', valor: 'escuelatest.com' },
    { clave: 'sso_google_habilitado', valor: 'true' },
    { clave: 'sso_microsoft_habilitado', valor: 'false' },
    { clave: 'requiere_validacion_responsable', valor: 'true' },
  ];

  for (const c of configs) {
    await prisma.configuracion.upsert({
      where: { tenant_id_clave: { tenant_id: tenant.id, clave: c.clave } },
      update: { valor: c.valor },
      create: { tenant_id: tenant.id, ...c },
    });
  }

  // 4. Create users — one per role
  const usersData = [
    { nombre: 'Ana Directora',     email: 'directora@escuelatest.com',    area: 'Dirección',       roles: ['director', 'solicitante'] },
    { nombre: 'Carlos Admin',      email: 'admin@escuelatest.com',        area: 'Administración',  roles: ['admin', 'solicitante'] },
    { nombre: 'María Responsable', email: 'responsable@escuelatest.com',  area: 'Docentes',        roles: ['responsable_area', 'solicitante'] },
    { nombre: 'Pedro Compras',     email: 'compras@escuelatest.com',      area: 'Administración',  roles: ['compras', 'solicitante'] },
    { nombre: 'Laura Tesorería',   email: 'tesoreria@escuelatest.com',    area: 'Administración',  roles: ['tesoreria', 'solicitante'] },
    { nombre: 'Juan Solicitante',  email: 'solicitante@escuelatest.com',  area: 'Docentes',        roles: ['solicitante'] },
    { nombre: 'Luis Mantenimiento', email: 'mantenimiento@escuelatest.com', area: 'Mantenimiento', roles: ['solicitante'] },
  ];

  for (const u of usersData) {
    const area = areas[u.area];
    if (!area) throw new Error(`Area "${u.area}" not found`);

    const user = await prisma.usuarios.upsert({
      where: { tenant_id_email: { tenant_id: tenant.id, email: u.email } },
      update: {},
      create: {
        tenant_id: tenant.id,
        nombre: u.nombre,
        email: u.email,
        password_hash: passwordHash,
        area_id: area.id,
      },
    });

    // Assign roles
    for (const roleName of u.roles) {
      const rolId = roleMap[roleName];
      if (!rolId) throw new Error(`Role "${roleName}" not found`);
      await prisma.usuarios_roles.upsert({
        where: { usuario_id_rol_id: { usuario_id: user.id, rol_id: rolId } },
        update: {},
        create: { usuario_id: user.id, rol_id: rolId },
      });
    }

    // Set area responsable
    if (u.roles.includes('responsable_area')) {
      await prisma.areas.update({ where: { id: area.id }, data: { responsable_id: user.id } });
    }
    if (u.roles.includes('director')) {
      await prisma.areas.update({ where: { id: areas['Dirección'].id }, data: { responsable_id: user.id } });
    }

    console.log(`  ${u.nombre} <${u.email}> → [${u.roles.join(', ')}] (${u.area})`);
  }

  console.log('\n✓ Test org seeded successfully!');
  console.log(`\nPassword for all users: ${PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
