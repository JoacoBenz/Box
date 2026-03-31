import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(request: Request) {
  const { session, effectiveTenantId } = await getEffectiveTenantId(request);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ solicitudes: [], proveedores: [], compras: [] });
  }

  const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

  const [solicitudes, proveedores] = await Promise.all([
    db.solicitudes.findMany({
      where: {
        OR: [
          { numero: { contains: q, mode: 'insensitive' as any } },
          { titulo: { contains: q, mode: 'insensitive' as any } },
          { descripcion: { contains: q, mode: 'insensitive' as any } },
        ],
      },
      select: {
        id: true, numero: true, titulo: true, estado: true, urgencia: true,
      },
      take: 10,
      orderBy: { updated_at: 'desc' },
    }),
    db.proveedores.findMany({
      where: {
        activo: true,
        OR: [
          { nombre: { contains: q, mode: 'insensitive' as any } },
          { cuit: { contains: q, mode: 'insensitive' as any } },
        ],
      },
      select: { id: true, nombre: true, cuit: true },
      take: 5,
    }),
  ]);

  return NextResponse.json({ solicitudes, proveedores });
}
