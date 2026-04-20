import { auth } from '@/lib/auth';
import { tenantPrisma, prisma } from '@/lib/prisma';
import type { SessionUser } from '@/types';
import { redirect, notFound } from 'next/navigation';
import RegistrarCompraForm from './RegistrarCompraForm';
import { getServerTenantId } from '@/lib/tenant-override';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RegistrarCompraPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as unknown as SessionUser;

  if (!user.roles.includes('tesoreria') && !user.roles.includes('admin')) {
    redirect('/solicitudes');
  }

  const effectiveTenantId = await getServerTenantId({
    tenantId: user.tenantId,
    roles: user.roles as string[],
  });
  const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

  const solicitud = await db.solicitudes.findFirst({
    where: { id: Number(id), estado: 'pago_programado' },
    include: {
      area: { select: { nombre: true } },
      solicitante: { select: { nombre: true } },
      proveedor: true,
      items_solicitud: { select: { cantidad: true, precio_estimado: true } },
    },
  });

  if (!solicitud) notFound();

  const archivos = await prisma.archivos.findMany({
    where: { entidad: 'solicitud', entidad_id: solicitud.id },
    orderBy: { created_at: 'desc' },
  });

  return (
    <RegistrarCompraForm
      solicitud={JSON.parse(JSON.stringify(solicitud))}
      archivos={JSON.parse(JSON.stringify(archivos))}
    />
  );
}
