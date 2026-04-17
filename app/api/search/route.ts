import { withAdminOverride } from '@/lib/api-handler';

export const GET = withAdminOverride({}, async (request, { db }) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json({ solicitudes: [], proveedores: [], compras: [] });
  }

  const [solicitudes, proveedores] = await Promise.all([
    db.solicitudes.findMany({
      where: {
        OR: [
          { numero: { contains: q, mode: 'insensitive' as const } },
          { titulo: { contains: q, mode: 'insensitive' as const } },
          { descripcion: { contains: q, mode: 'insensitive' as const } },
        ],
      },
      select: {
        id: true,
        numero: true,
        titulo: true,
        estado: true,
        urgencia: true,
      },
      take: 10,
      orderBy: { updated_at: 'desc' },
    }),
    db.proveedores.findMany({
      where: {
        activo: true,
        OR: [
          { nombre: { contains: q, mode: 'insensitive' as const } },
          { cuit: { contains: q, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true, nombre: true, cuit: true },
      take: 5,
    }),
  ]);

  return Response.json({ solicitudes, proveedores });
});
