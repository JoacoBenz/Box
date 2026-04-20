import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimitDb } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitDb(`unirse-dominio:${ip}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: { code: 'RATE_LIMITED', message: 'Demasiados intentos' } },
        { status: 429 },
      );
    }

    const email = request.nextUrl.searchParams.get('email');
    if (!email || !email.includes('@')) {
      return Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Email inválido' } },
        { status: 400 },
      );
    }

    const domain = email.split('@')[1].toLowerCase();

    // Find tenant with this domain configured and SSO enabled
    const configs = await prisma.configuracion.findMany({
      where: { clave: 'sso_dominio', valor: domain },
    });

    if (configs.length === 0) {
      return Response.json({ match: false });
    }

    // Find the first active tenant with this domain
    for (const config of configs) {
      const tenant = await prisma.tenants.findFirst({
        where: { id: config.tenant_id, estado: 'activo', desactivado: false },
        select: { id: true, nombre: true },
      });

      if (tenant) {
        const areas = await prisma.areas.findMany({
          where: { tenant_id: tenant.id, activo: true },
          select: { id: true, nombre: true },
          orderBy: { nombre: 'asc' },
        });

        return Response.json({
          match: true,
          tenant_id: tenant.id,
          tenant_nombre: tenant.nombre,
          areas,
        });
      }
    }

    return Response.json({ match: false });
  } catch {
    return Response.json(
      { error: { code: 'INTERNAL', message: 'Error interno' } },
      { status: 500 },
    );
  }
}
