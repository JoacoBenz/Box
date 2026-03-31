import { auth } from '@/lib/auth'
import type { SessionUser } from '@/types'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getServerTenantId } from '@/lib/tenant-override'
import SolicitudesTable from './SolicitudesTable'

export default async function SolicitudesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as unknown as SessionUser
  const effectiveTenantId = await getServerTenantId({ tenantId: user.tenantId, roles: user.roles as string[] })
  const tid = effectiveTenantId ?? user.tenantId

  const areas = await prisma.areas.findMany({
    where: { tenant_id: tid, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  }).catch(() => [])

  return (
    <div className="page-content">
      <SolicitudesTable
        roles={user.roles as string[]}
        areas={areas}
      />
    </div>
  )
}
