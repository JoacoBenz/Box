import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// TEMPORARY endpoint to create test orgs — DELETE after testing
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-test-secret');
  if (secret !== 'box-test-2026') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const roles = await prisma.roles.findMany();
  const directorRole = roles.find(r => r.nombre === 'director');
  const solicitanteRole = roles.find(r => r.nombre === 'solicitante');
  if (!directorRole || !solicitanteRole) {
    return Response.json({ error: 'Roles not found. Run seed.' }, { status: 500 });
  }

  const passwordHash = await bcrypt.hash('Test1234!!', 12);

  const orgs = [
    { nombre: 'Test Google SSO', slug: 'test-google-sso', domain: 'gmail.com', email: 'testgoogle@gmail.com', userName: 'Admin Google' },
    { nombre: 'Test Microsoft SSO', slug: 'test-microsoft-sso', domain: 'outlook.com', email: 'testmicrosoft@outlook.com', userName: 'Admin Microsoft' },
  ];

  const results = [];

  for (const org of orgs) {
    // Skip if already exists
    const existing = await prisma.tenants.findUnique({ where: { slug: org.slug } });
    if (existing) {
      results.push({ org: org.nombre, status: 'already exists', tenantId: existing.id });
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenants.create({
        data: { nombre: org.nombre, slug: org.slug, email_contacto: org.email, moneda: 'ARS', estado: 'activo' },
      });

      const area = await tx.areas.create({
        data: { tenant_id: tenant.id, nombre: 'Dirección' },
      });

      const usuario = await tx.usuarios.create({
        data: {
          tenant_id: tenant.id,
          nombre: org.userName,
          email: org.email,
          password_hash: passwordHash,
          area_id: area.id,
        },
      });

      await tx.usuarios_roles.createMany({
        data: [
          { usuario_id: usuario.id, rol_id: directorRole.id },
          { usuario_id: usuario.id, rol_id: solicitanteRole.id },
        ],
      });

      await tx.areas.update({
        where: { id: area.id },
        data: { responsable_id: usuario.id },
      });

      await tx.configuracion.createMany({
        data: [
          { tenant_id: tenant.id, clave: 'moneda', valor: 'ARS' },
          { tenant_id: tenant.id, clave: 'umbral_aprobacion_responsable', valor: '0' },
          { tenant_id: tenant.id, clave: 'umbral_aprobacion_director', valor: '999999999' },
          { tenant_id: tenant.id, clave: 'sso_dominio', valor: org.domain },
          { tenant_id: tenant.id, clave: 'sso_google_habilitado', valor: 'true' },
          { tenant_id: tenant.id, clave: 'sso_microsoft_habilitado', valor: 'true' },
        ],
      });

      return { tenant, usuario };
    });

    results.push({ org: org.nombre, status: 'created', tenantId: result.tenant.id, userId: result.usuario.id });
  }

  return Response.json({ results });
}
