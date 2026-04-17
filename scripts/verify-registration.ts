import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../app/generated/prisma/client';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find pending registrations
  const pending = await prisma.registros_pendientes.findMany();
  console.log('Pending registrations:', pending.length);

  if (pending.length === 0) {
    console.log('No pending registrations found.');
    return;
  }

  for (const p of pending) {
    console.log(
      `  ID: ${p.id} | Email: ${p.email} | Org: ${p.nombre_organizacion} | Verified: ${p.verificado}`,
    );
  }

  // Get the most recent unverified one
  const latest = pending.filter((p) => !p.verificado).sort((a, b) => b.id - a.id)[0];
  if (!latest) {
    console.log('All registrations are already verified.');
    return;
  }

  console.log(`\nSimulating verification for: ${latest.email} (${latest.nombre_organizacion})`);

  // Call the verification logic directly - import from registro/verificar
  // Instead, we just mark it verified and create the tenant manually
  const bcrypt = await import('bcryptjs');

  const slug = latest.nombre_organizacion
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  await prisma.$transaction(async (tx: any) => {
    // Create tenant
    const tenant = await tx.tenants.create({
      data: {
        nombre: latest.nombre_organizacion,
        slug,
        email_contacto: latest.email,
        updated_at: new Date(),
      },
    });
    console.log(`  Tenant created: ${tenant.nombre} (ID: ${tenant.id})`);

    // Create default areas
    const areas = ['Dirección'];
    for (const nombre of areas) {
      await tx.areas.create({
        data: { tenant_id: tenant.id, nombre },
      });
    }
    console.log('  Default areas created');

    // Create user
    const user = await tx.usuarios.create({
      data: {
        tenant_id: tenant.id,
        nombre: latest.nombre_usuario,
        email: latest.email,
        password_hash: latest.password_hash,
        activo: true,
        updated_at: new Date(),
      },
    });
    console.log(`  User created: ${user.nombre} (ID: ${user.id})`);

    // Assign roles
    const roles = await tx.roles.findMany();
    const directorRole = roles.find((r: any) => r.nombre === 'director');
    const solicitanteRole = roles.find((r: any) => r.nombre === 'solicitante');

    if (directorRole) {
      await tx.usuarios_roles.create({
        data: { usuario_id: user.id, rol_id: directorRole.id },
      });
    }
    if (solicitanteRole) {
      await tx.usuarios_roles.create({
        data: { usuario_id: user.id, rol_id: solicitanteRole.id },
      });
    }
    console.log('  Roles assigned: director, solicitante');

    // Mark registration as verified
    await tx.registros_pendientes.update({
      where: { id: latest.id },
      data: { verificado: true },
    });
    console.log('  Registration marked as verified');
  });

  console.log('\n✅ Done! You can now login with:', latest.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
