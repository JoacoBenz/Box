import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    const rateLimit = checkRateLimit(`unirse-codigo:${ip}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return Response.json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos' } }, { status: 429 });
    }

    const codigo = request.nextUrl.searchParams.get('codigo')?.toUpperCase();
    if (!codigo || codigo.length < 4) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Código inválido' } }, { status: 400 });
    }

    const inv = await prisma.codigos_invitacion.findFirst({
      where: { codigo, activo: true, expira_el: { gt: new Date() } },
      include: { tenant: { select: { id: true, nombre: true, estado: true, desactivado: true } } },
    });

    if (!inv || inv.tenant.estado !== 'activo' || inv.tenant.desactivado) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Código inválido o expirado' } }, { status: 404 });
    }

    if (inv.max_usos && inv.usos >= inv.max_usos) {
      return Response.json({ error: { code: 'CONFLICT', message: 'Este código ya alcanzó el máximo de usos' } }, { status: 409 });
    }

    const areas = await prisma.areas.findMany({
      where: { tenant_id: inv.tenant_id, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });

    return Response.json({
      match: true,
      tenant_id: inv.tenant_id,
      tenant_nombre: inv.tenant.nombre,
      areas,
    });
  } catch {
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
