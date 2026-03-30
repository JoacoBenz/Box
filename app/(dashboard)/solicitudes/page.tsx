import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { SessionUser, EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SolicitudesTable from './SolicitudesTable'

interface PageProps {
  searchParams: Promise<{ estado?: string; urgencia?: string }>
}

export default async function SolicitudesPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as unknown as SessionUser

  const { estado, urgencia } = await searchParams

  // Build role-based where clause
  const where: Record<string, unknown> = { tenant_id: user.tenantId }

  if (user.roles.includes('solicitante') && !user.roles.includes('admin') && !user.roles.includes('director') && !user.roles.includes('tesoreria')) {
    where.solicitante_id = Number(user.id)
  } else if (user.roles.includes('responsable_area') && !user.roles.includes('admin') && !user.roles.includes('director') && !user.roles.includes('tesoreria')) {
    if (user.areaId) where.area_id = user.areaId
  }
  // director, tesoreria, admin: see all — no extra filter

  if (estado) where.estado = estado
  if (urgencia) where.urgencia = urgencia

  const solicitudes = await prisma.solicitudes.findMany({
    where,
    include: {
      area: { select: { nombre: true } },
      solicitante: { select: { nombre: true } },
    },
    orderBy: { created_at: 'desc' },
  }).catch(() => [])

  const isSolicitante = user.roles.includes('solicitante')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.3px' }}>Solicitudes de Compra</h1>
        {isSolicitante && (
          <Link href="/solicitudes/nueva">
            <button className="btn-primary-gradient">
              + Nueva Solicitud
            </button>
          </Link>
        )}
      </div>
      <SolicitudesTable
        solicitudes={JSON.parse(JSON.stringify(solicitudes))}
        estadoFilter={estado}
        urgenciaFilter={urgencia}
      />
    </div>
  )
}
