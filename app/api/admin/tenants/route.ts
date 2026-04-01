import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';
import { logApiError } from '@/lib/logger';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return apiError('FORBIDDEN', 'No tenés permisos para ver tenants', 403);
    }

    const tenants = await prisma.tenants.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        estado: true,
        email_contacto: true,
        moneda: true,
        fecha_registro: true,
        desactivado: true,
      },
    });

    // Get stats for all tenants in a single query
    const tenantIds = tenants.map(t => t.id);
    const stats = tenantIds.length > 0
      ? await prisma.$queryRaw<{ tenant_id: number; usuarios: string; areas: string; solicitudes: string; compras: string; proveedores: string }[]>`
          SELECT
            t.id AS tenant_id,
            (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = t.id AND u.activo = true)::text AS usuarios,
            (SELECT COUNT(*) FROM areas a WHERE a.tenant_id = t.id AND a.activo = true)::text AS areas,
            (SELECT COUNT(*) FROM solicitudes s WHERE s.tenant_id = t.id)::text AS solicitudes,
            (SELECT COUNT(*) FROM compras c WHERE c.tenant_id = t.id)::text AS compras,
            (SELECT COUNT(*) FROM proveedores p WHERE p.tenant_id = t.id AND p.activo = true)::text AS proveedores
          FROM tenants t
          WHERE t.id = ANY(${tenantIds}::int[])
        `
      : [];

    const statsMap = new Map(stats.map(s => [s.tenant_id, {
      usuarios: parseInt(s.usuarios),
      areas: parseInt(s.areas),
      solicitudes: parseInt(s.solicitudes),
      compras: parseInt(s.compras),
      proveedores: parseInt(s.proveedores),
    }]));

    const tenantsWithStats = tenants.map(t => ({
      ...t,
      stats: statsMap.get(t.id) ?? { usuarios: 0, areas: 0, solicitudes: 0, compras: 0, proveedores: 0 },
    }));

    return Response.json(tenantsWithStats);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/tenants', 'GET', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!verificarRol(session.roles, ['admin'])) {
      return apiError('FORBIDDEN', 'Sin permisos', 403);
    }

    const body = await request.json();
    const { nombre, email_contacto, moneda } = body;

    if (!nombre?.trim()) return apiError('VALIDATION', 'El nombre es obligatorio', 400);
    if (!email_contacto?.trim()) return apiError('VALIDATION', 'El email de contacto es obligatorio', 400);

    const slug = slugify(nombre.trim());

    const existing = await prisma.tenants.findUnique({ where: { slug } });
    if (existing) return apiError('VALIDATION', 'Ya existe una organización con ese nombre/slug', 400);

    const tenant = await prisma.tenants.create({
      data: {
        nombre: nombre.trim(),
        slug,
        email_contacto: email_contacto.trim(),
        moneda: moneda?.trim() || 'ARS',
        updated_at: new Date(),
      },
    });

    return Response.json(tenant, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    logApiError('/api/admin/tenants', 'POST', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
