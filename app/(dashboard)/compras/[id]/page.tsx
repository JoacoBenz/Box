import { auth } from '@/lib/auth'
import { tenantPrisma } from '@/lib/prisma'
import type { SessionUser } from '@/types'
import { redirect, notFound } from 'next/navigation'
import RegistrarCompraForm from './RegistrarCompraForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RegistrarCompraPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as unknown as SessionUser

  if (!user.roles.includes('tesoreria') && !user.roles.includes('admin')) {
    redirect('/solicitudes')
  }

  const db = tenantPrisma(user.tenantId)

  const solicitud = await db.solicitudes.findFirst({
    where: { id: Number(id), estado: 'aprobada' },
    include: {
      area: { select: { nombre: true } },
      solicitante: { select: { nombre: true } },
    },
  })

  if (!solicitud) notFound()

  return (
    <RegistrarCompraForm solicitud={JSON.parse(JSON.stringify(solicitud))} />
  )
}
