import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verificarRol, apiError } from '@/lib/permissions';

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

    // Get stats for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (t) => {
        const [usuarios, areas, solicitudes, compras, proveedores] = await Promise.all([
          prisma.usuarios.count({ where: { tenant_id: t.id, activo: true } }),
          prisma.areas.count({ where: { tenant_id: t.id, activo: true } }),
          prisma.solicitudes.count({ where: { tenant_id: t.id } }),
          prisma.compras.count({ where: { tenant_id: t.id } }),
          prisma.proveedores.count({ where: { tenant_id: t.id, activo: true } }),
        ]);
        return {
          ...t,
          stats: { usuarios, areas, solicitudes, compras, proveedores },
        };
      })
    );

    return Response.json(tenantsWithStats);
  } catch (error: any) {
    if (error.message === 'No autenticado') return apiError('UNAUTHORIZED', 'No autenticado', 401);
    console.error('Error fetching tenants:', error);
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
    console.error('Error creating tenant:', error);
    return apiError('INTERNAL', 'Error interno', 500);
  }
}
