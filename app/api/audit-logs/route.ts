import { withAuth } from '@/lib/api-handler';
import { apiError } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

const CRITICAL_ACTIONS = [
  'login_fallido',
  'cuenta_bloqueada',
  'rate_limited',
  'editar_usuario',
  'desactivar_usuario',
  'crear_delegacion',
  'desactivar_delegacion',
  'aprobar_solicitud',
  'aprobar_masivo',
  'anular_solicitud',
  'registrar_compra',
  'rechazar_solicitud',
  'configuracion_sso',
  'configuracion_tenant',
];

export const GET = withAuth(
  { roles: ['super_admin', 'admin'] },
  async (request, { session, db }) => {
    const url = new URL(request.url);
    const accion = url.searchParams.get('accion');
    const entidad = url.searchParams.get('entidad');
    const usuario_id = url.searchParams.get('usuario_id');
    const tenant_id = url.searchParams.get('tenant_id');
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    const critico = url.searchParams.get('critico');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));

    const isSuperAdmin = session.roles.includes('super_admin');

    const where: any = {};

    // Access control
    if (!isSuperAdmin) {
      where.tenant_id = session.tenantId;
    } else if (tenant_id) {
      where.tenant_id = Number(tenant_id);
    }
    // super_admin without tenant filter: no tenant_id constraint (sees all)

    if (accion) where.accion = accion;
    if (entidad) where.entidad = entidad;
    if (usuario_id) where.usuario_id = Number(usuario_id);

    if (desde || hasta) {
      where.created_at = {};
      if (desde) where.created_at.gte = new Date(desde);
      if (hasta) where.created_at.lte = new Date(hasta);
    }

    if (critico === 'true') {
      where.accion = { in: CRITICAL_ACTIONS };
    }

    // Always use global prisma — tenant scoping is handled by the where clause
    const client = prisma;

    const [logs, total] = await Promise.all([
      client.log_auditoria.findMany({
        where,
        include: {
          usuario: { select: { nombre: true, email: true } },
          tenant: { select: { nombre: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.log_auditoria.count({ where }),
    ]);

    const data = logs.map((log: any) => ({
      ...log,
      id: Number(log.id),
    }));

    return Response.json({ data, total, page, limit });
  },
);
