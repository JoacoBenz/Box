import { withAuth } from '@/lib/api-handler';

export const GET = withAuth({}, async (request, { db }) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const areaId = searchParams.get('area_id');
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

  const where: any = { activo: true };

  if (q) {
    where.OR = [
      { nombre: { contains: q, mode: 'insensitive' as const } },
      { area: { nombre: { contains: q, mode: 'insensitive' as const } } },
    ];
  }

  if (areaId) {
    where.area_id = parseInt(areaId);
  }

  const productos = await db.productos.findMany({
    where,
    take: limit,
    orderBy: { nombre: 'asc' },
    select: {
      id: true,
      nombre: true,
      area: { select: { id: true, nombre: true } },
      unidad_defecto: true,
      precio_referencia: true,
      link_producto: true,
    },
  });

  return Response.json(productos);
});
