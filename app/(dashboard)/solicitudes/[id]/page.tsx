import { prisma } from '@/lib/prisma'
import { auth, getServerSession } from '@/lib/auth'
import { getTenantConfigBool } from '@/lib/tenant-config'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import { redirect, notFound } from 'next/navigation'
import { Card, Tag, Descriptions } from 'antd'
import Link from 'next/link'
import SolicitudActionButtons from './SolicitudActionButtons'
import ItemsTable from './ItemsTable'
import TimelineSection from './TimelineSection'
import ComentariosSection from './ComentariosSection'
import { getServerTenantId } from '@/lib/tenant-override'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SolicitudDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = (session as any).user
  const tenantId = await getServerTenantId({ tenantId: user.tenantId, roles: user.roles ?? [] })
  const sessionUserId: number = Number(user.id)
  const sessionRoles: string[] = user.roles ?? []
  const sessionAreaId: number | null = user.areaId ?? null

  const solicitud = await prisma.solicitudes.findFirst({
    where: { id: Number(id), ...(tenantId ? { tenant_id: tenantId } : {}) },
    include: {
      area: true,
      solicitante: { select: { id: true, nombre: true, email: true } },
      proveedor: true,
      validado_por: { select: { id: true, nombre: true, email: true } },
      aprobado_por: { select: { id: true, nombre: true, email: true } },
      rechazado_por: { select: { id: true, nombre: true, email: true } },
      items_solicitud: true,
      compras: {
        include: {
          ejecutado_por: { select: { id: true, nombre: true, email: true } },
        },
      },
      recepciones: {
        include: {
          receptor: { select: { id: true, nombre: true, email: true } },
        },
      },
    },
  })

  if (!solicitud) notFound()

  // Check if session user is the designated responsable of this solicitud's area
  const isAreaResponsable = solicitud.area?.responsable_id === sessionUserId
  const skipValidacion = !(await getTenantConfigBool(tenantId ?? user.tenantId, 'requiere_validacion_responsable', true))

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
    link_producto: item.link_producto ?? null,
  }))

  const STATUS_BG: Record<string, string> = {
    borrador: '#f1f5f9',
    enviada: '#eff6ff',
    devuelta_resp: '#fffbeb',
    devuelta_dir: '#fffbeb',
    validada: '#ecfeff',
    aprobada: '#f0fdf4',
    rechazada: '#fef2f2',
    comprada: '#faf5ff',
    recibida: '#f7fee7',
    recibida_con_obs: '#fff7ed',
    cerrada: '#f1f5f9',
  }

  return (
    <div className="page-content" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Hero Header with status color strip */}
      <div style={{
        background: STATUS_BG[estado] ?? '#f1f5f9',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        border: '1px solid rgba(0,0,0,0.04)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <Link href="/solicitudes" style={{ color: '#4f46e5', fontWeight: 500, textDecoration: 'none' }}>
                ← Volver a Solicitudes
              </Link>
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{solicitud.titulo}</h3>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{solicitud.numero}</span>
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
            isAreaResponsable={isAreaResponsable}
            skipValidacion={skipValidacion}
            updatedAt={solicitud.updated_at.toISOString()}
          />
        </div>
      </div>

      {/* Main info */}
      <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Detalle de la Solicitud</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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
          {!solicitud.proveedor && solicitud.proveedor_sugerido && (
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

      {/* Proveedor info (read-only) */}
      {solicitud.proveedor && (
        <Card
          title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Proveedor</span>}
          style={{ marginBottom: 24, borderRadius: 16 }}
        >
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Nombre">{solicitud.proveedor.nombre}</Descriptions.Item>
            {solicitud.proveedor.cuit && (
              <Descriptions.Item label="CUIT">{solicitud.proveedor.cuit}</Descriptions.Item>
            )}
            {solicitud.proveedor.telefono && (
              <Descriptions.Item label="Teléfono">{solicitud.proveedor.telefono}</Descriptions.Item>
            )}
            {solicitud.proveedor.email && (
              <Descriptions.Item label="Email">{solicitud.proveedor.email}</Descriptions.Item>
            )}
            {solicitud.proveedor.direccion && (
              <Descriptions.Item label="Dirección" span={2}>{solicitud.proveedor.direccion}</Descriptions.Item>
            )}
            {solicitud.proveedor.datos_bancarios && (
              <Descriptions.Item label="Datos Bancarios" span={2}>
                <span style={{ whiteSpace: 'pre-line' }}>{solicitud.proveedor.datos_bancarios}</span>
              </Descriptions.Item>
            )}
            {solicitud.proveedor.link_pagina && (
              <Descriptions.Item label="Web" span={2}>
                <a href={solicitud.proveedor.link_pagina} target="_blank" rel="noopener noreferrer">
                  {solicitud.proveedor.link_pagina}
                </a>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* Items */}
      <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Ítems Solicitados</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
        <ItemsTable items={items} />
      </Card>

      {/* Compra info */}
      {solicitud.compras.length > 0 && (
        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Información de Compra</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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
        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Recepciones</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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
      <TimelineSection solicitudId={solicitud.id} />

      {/* Comentarios */}
      <ComentariosSection solicitudId={solicitud.id} />
    </div>
  )
}
