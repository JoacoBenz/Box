import { prisma } from '@/lib/prisma'
import { auth, getServerSession } from '@/lib/auth'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import { redirect, notFound } from 'next/navigation'
import { Card, Tag, Descriptions, Timeline } from 'antd'
import Link from 'next/link'
import SolicitudActionButtons from './SolicitudActionButtons'
import ItemsTable from './ItemsTable'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SolicitudDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = (session as any).user
  const tenantId: number = user.tenantId
  const sessionUserId: number = Number(user.id)
  const sessionRoles: string[] = user.roles ?? []
  const sessionAreaId: number | null = user.areaId ?? null

  const solicitud = await prisma.solicitudes.findFirst({
    where: { id: Number(id), tenant_id: tenantId },
    include: {
      area: true,
      solicitante: true,
      validado_por: true,
      aprobado_por: true,
      rechazado_por: true,
      items_solicitud: true,
      compras: {
        include: {
          ejecutado_por: true,
        },
      },
      recepciones: {
        include: {
          receptor: true,
        },
      },
    },
  })

  if (!solicitud) notFound()

  const estado = solicitud.estado as EstadoSolicitud
  const urgencia = solicitud.urgencia as UrgenciaSolicitud
  const estadoInfo = ESTADOS_SOLICITUD[estado]
  const urgenciaInfo = URGENCIAS[urgencia]

  const items = solicitud.items_solicitud.map((item) => ({
    id: item.id,
    descripcion: item.descripcion,
    cantidad: Number(item.cantidad),
    unidad: item.unidad,
    precio_estimado: item.precio_estimado != null ? Number(item.precio_estimado) : null,
  }))

  // Build timeline items
  const timelineItems: { color: string; content: React.ReactNode }[] = [
    {
      color: 'blue',
      content: (
        <>
          <strong>Creada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(solicitud.created_at).toLocaleString('es-AR')} — {solicitud.solicitante.nombre}
          </div>
        </>
      ),
    },
  ]

  if (solicitud.fecha_envio) {
    timelineItems.push({
      color: 'blue',
      content: (
        <>
          <strong>Enviada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(solicitud.fecha_envio).toLocaleString('es-AR')}
          </div>
        </>
      ),
    })
  }

  if (solicitud.fecha_validacion) {
    timelineItems.push({
      color: 'cyan',
      content: (
        <>
          <strong>Validada por Responsable</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(solicitud.fecha_validacion).toLocaleString('es-AR')}
            {solicitud.validado_por ? ` — ${solicitud.validado_por.nombre}` : ''}
          </div>
        </>
      ),
    })
  }

  if (solicitud.fecha_aprobacion) {
    timelineItems.push({
      color: 'green',
      content: (
        <>
          <strong>Aprobada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(solicitud.fecha_aprobacion).toLocaleString('es-AR')}
            {solicitud.aprobado_por ? ` — ${solicitud.aprobado_por.nombre}` : ''}
          </div>
        </>
      ),
    })
  }

  if (solicitud.fecha_rechazo) {
    timelineItems.push({
      color: 'red',
      content: (
        <>
          <strong>Rechazada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(solicitud.fecha_rechazo).toLocaleString('es-AR')}
            {solicitud.rechazado_por ? ` — ${solicitud.rechazado_por.nombre}` : ''}
          </div>
          {solicitud.motivo_rechazo && (
            <div style={{ marginTop: 4, color: '#c53030', fontSize: 12 }}>
              Motivo: {solicitud.motivo_rechazo}
            </div>
          )}
        </>
      ),
    })
  }

  if (solicitud.compras.length > 0) {
    const compra = solicitud.compras[0]
    timelineItems.push({
      color: 'geekblue',
      content: (
        <>
          <strong>Compra Registrada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(compra.created_at).toLocaleString('es-AR')}
            {compra.ejecutado_por ? ` — ${compra.ejecutado_por.nombre}` : ''}
          </div>
        </>
      ),
    })
  }

  if (solicitud.recepciones.length > 0) {
    const rec = solicitud.recepciones[0]
    timelineItems.push({
      color: 'lime',
      content: (
        <>
          <strong>Recepción Confirmada</strong>
          <div style={{ fontSize: 12, color: '#888' }}>
            {new Date(rec.created_at).toLocaleString('es-AR')}
            {rec.receptor ? ` — ${rec.receptor.nombre}` : ''}
          </div>
        </>
      ),
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
            <Link href="/solicitudes" style={{ color: '#1677ff' }}>
              ← Volver a Solicitudes
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{solicitud.titulo}</h1>
          <div style={{ marginTop: 8 }}>
            <span style={{ color: '#888', marginRight: 8 }}>{solicitud.numero}</span>
            {estadoInfo && <Tag color={estadoInfo.color}>{estadoInfo.label}</Tag>}
            {urgenciaInfo && <Tag color={urgenciaInfo.color}>{urgenciaInfo.label}</Tag>}
          </div>
        </div>

        {/* Action buttons — client component */}
        <SolicitudActionButtons
          solicitudId={solicitud.id}
          estado={estado}
          solicitanteId={solicitud.solicitante_id}
          solicitudAreaId={solicitud.area_id ?? null}
          sessionUserId={sessionUserId}
          sessionRoles={sessionRoles}
          sessionAreaId={sessionAreaId}
        />
      </div>

      {/* Main info */}
      <Card title="Detalle de la Solicitud" style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Solicitante">{solicitud.solicitante.nombre}</Descriptions.Item>
          <Descriptions.Item label="Área">{solicitud.area?.nombre ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Fecha Creación">
            {new Date(solicitud.created_at).toLocaleDateString('es-AR')}
          </Descriptions.Item>
          <Descriptions.Item label="Fecha Envío">
            {solicitud.fecha_envio
              ? new Date(solicitud.fecha_envio).toLocaleDateString('es-AR')
              : '—'}
          </Descriptions.Item>
          {solicitud.proveedor_sugerido && (
            <Descriptions.Item label="Proveedor Sugerido" span={2}>
              {solicitud.proveedor_sugerido}
            </Descriptions.Item>
          )}
          {solicitud.monto_estimado_total != null && (
            <Descriptions.Item label="Monto Estimado" span={2}>
              ${Number(solicitud.monto_estimado_total).toFixed(2)}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Descripción" span={2}>
            {solicitud.descripcion}
          </Descriptions.Item>
          <Descriptions.Item label="Justificación" span={2}>
            {solicitud.justificacion}
          </Descriptions.Item>
          {solicitud.observaciones_responsable && (
            <Descriptions.Item label="Obs. Responsable" span={2}>
              <span style={{ color: '#d46b08' }}>{solicitud.observaciones_responsable}</span>
            </Descriptions.Item>
          )}
          {solicitud.observaciones_director && (
            <Descriptions.Item label="Obs. Dirección" span={2}>
              <span style={{ color: '#d46b08' }}>{solicitud.observaciones_director}</span>
            </Descriptions.Item>
          )}
          {solicitud.motivo_rechazo && (
            <Descriptions.Item label="Motivo Rechazo" span={2}>
              <span style={{ color: '#cf1322' }}>{solicitud.motivo_rechazo}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Items */}
      <Card title="Ítems Solicitados" style={{ marginBottom: 24 }}>
        <ItemsTable items={items} />
      </Card>

      {/* Compra info */}
      {solicitud.compras.length > 0 && (
        <Card title="Información de Compra" style={{ marginBottom: 24 }}>
          {solicitud.compras.map((compra) => (
            <Descriptions key={compra.id} column={2} bordered size="small">
              <Descriptions.Item label="Proveedor">{compra.proveedor_nombre}</Descriptions.Item>
              <Descriptions.Item label="Fecha Compra">
                {compra.fecha_compra
                  ? new Date(compra.fecha_compra).toLocaleDateString('es-AR')
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Monto Total">
                ${Number(compra.monto_total).toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="Medio de Pago">{compra.medio_pago}</Descriptions.Item>
              {compra.numero_factura && (
                <Descriptions.Item label="N° Factura">{compra.numero_factura}</Descriptions.Item>
              )}
              {compra.referencia_bancaria && (
                <Descriptions.Item label="Referencia Bancaria">
                  {compra.referencia_bancaria}
                </Descriptions.Item>
              )}
              {compra.observaciones && (
                <Descriptions.Item label="Observaciones" span={2}>
                  {compra.observaciones}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Registrado por">
                {compra.ejecutado_por?.nombre ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          ))}
        </Card>
      )}

      {/* Recepciones */}
      {solicitud.recepciones.length > 0 && (
        <Card title="Recepciones" style={{ marginBottom: 24 }}>
          {solicitud.recepciones.map((rec) => (
            <Descriptions key={rec.id} column={2} bordered size="small">
              <Descriptions.Item label="Confirmado por">
                {rec.receptor?.nombre ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Fecha">
                {new Date(rec.created_at).toLocaleDateString('es-AR')}
              </Descriptions.Item>
              {rec.observaciones && (
                <Descriptions.Item label="Observaciones" span={2}>
                  {rec.observaciones}
                </Descriptions.Item>
              )}
              {!rec.conforme && (
                <Descriptions.Item label="Problemas" span={2}>
                  <Tag color="orange">Recibida con observaciones</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          ))}
        </Card>
      )}

      {/* Timeline */}
      <Card title="Historial">
        <Timeline items={timelineItems} />
      </Card>
    </div>
  )
}
