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
      centro_costo: { select: { id: true, nombre: true, codigo: true } },
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

  // Fetch all archivos: from solicitud, compras, and recepciones
  const compraIds = solicitud.compras.map((c) => c.id)
  const recepcionIds = solicitud.recepciones.map((r) => r.id)
  const tenantFilter = tenantId ? { tenant_id: tenantId } : {}

  const allArchivosRaw = await prisma.archivos.findMany({
    where: {
      ...tenantFilter,
      OR: [
        { entidad: 'solicitud', entidad_id: solicitud.id },
        ...(compraIds.length > 0 ? [{ entidad: 'compra', entidad_id: { in: compraIds } }] : []),
        ...(recepcionIds.length > 0 ? [{ entidad: 'recepcion', entidad_id: { in: recepcionIds } }] : []),
      ],
    },
    include: { subido_por: { select: { nombre: true } } },
    orderBy: { created_at: 'asc' },
  })

  // Convert BigInt/Date fields to serializable types for RSC
  const archivosSerializados = allArchivosRaw.map((a) => ({
    id: a.id,
    entidad: a.entidad,
    nombre_archivo: a.nombre_archivo,
    tamanio_bytes: a.tamanio_bytes ? Number(a.tamanio_bytes) : null,
    created_at: a.created_at.toISOString(),
    subido_por: a.subido_por,
  }))

  const archivosSolicitud = archivosSerializados.filter((a) => a.entidad === 'solicitud')
  const archivosCompra = archivosSerializados.filter((a) => a.entidad === 'compra')
  const archivosRecepcion = archivosSerializados.filter((a) => a.entidad === 'recepcion')

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
    borrador: 'var(--status-bg-borrador)',
    enviada: 'var(--status-bg-enviada)',
    devuelta_resp: 'var(--status-bg-devuelta)',
    devuelta_dir: 'var(--status-bg-devuelta)',
    validada: 'var(--status-bg-validada)',
    aprobada: 'var(--status-bg-aprobada)',
    rechazada: 'var(--status-bg-rechazada)',
    abonada: 'var(--status-bg-abonada)',
    recibida: 'var(--status-bg-recibida)',
    recibida_con_obs: 'var(--status-bg-recibida-obs)',
    cerrada: 'var(--status-bg-cerrada)',
  }

  return (
    <div className="page-content" style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Hero Header with status color strip */}
      <div style={{
        background: STATUS_BG[estado] ?? '#f1f5f9',
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 24,
        border: '1px solid var(--hero-border)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <Link href="/solicitudes" style={{ color: 'var(--color-primary)', fontWeight: 500, textDecoration: 'none' }}>
                ← Volver a Solicitudes
              </Link>
            </div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{solicitud.titulo}</h3>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>{solicitud.numero}</span>
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
      <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Detalle de la Solicitud</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Solicitante">{solicitud.solicitante.nombre}</Descriptions.Item>
          <Descriptions.Item label="Área">{solicitud.area?.nombre ?? '—'}</Descriptions.Item>
          {solicitud.centro_costo && (
            <Descriptions.Item label="Centro de Costo" span={2}>
              <Tag color="blue">{solicitud.centro_costo.codigo}</Tag> {solicitud.centro_costo.nombre}
            </Descriptions.Item>
          )}
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
          <Descriptions.Item label="Descripción" span={2}>
            {solicitud.descripcion}
          </Descriptions.Item>
          <Descriptions.Item label="Justificación" span={2}>
            {solicitud.justificacion}
          </Descriptions.Item>
          {solicitud.observaciones_responsable && (
            <Descriptions.Item label="Obs. Responsable" span={2}>
              <span style={{ color: 'var(--color-observation)' }}>{solicitud.observaciones_responsable}</span>
            </Descriptions.Item>
          )}
          {solicitud.observaciones_director && (
            <Descriptions.Item label="Obs. Dirección" span={2}>
              <span style={{ color: 'var(--color-observation)' }}>{solicitud.observaciones_director}</span>
            </Descriptions.Item>
          )}
          {solicitud.motivo_rechazo && (
            <Descriptions.Item label="Motivo Rechazo" span={2}>
              <span style={{ color: 'var(--color-rejection)' }}>{solicitud.motivo_rechazo}</span>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Proveedor info (read-only) */}
      {solicitud.proveedor && (
        <Card
          title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Proveedor</span>}
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
      <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Ítems Solicitados</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
        <ItemsTable items={items} />
        {(() => {
          const total = items.reduce((acc, item) => acc + (item.precio_estimado != null ? item.precio_estimado * item.cantidad : 0), 0)
          return total > 0 ? (
            <div style={{
              marginTop: 12,
              padding: '12px 16px',
              background: 'var(--total-estimated-bg)',
              borderRadius: 8,
              border: '1px solid var(--total-estimated-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ fontWeight: 600, color: 'var(--total-estimated-text)', fontSize: 15 }}>Total Estimado:</span>
              <span style={{ fontWeight: 700, color: 'var(--total-estimated-text)', fontSize: 17 }}>
                ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ) : null
        })()}
      </Card>

      {/* Archivos adjuntos — all stages */}
      {archivosSerializados.length > 0 && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📎</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Documentos Adjuntos</span>
              <Tag style={{ marginLeft: 4 }}>{archivosSerializados.length}</Tag>
            </div>
          }
          style={{ marginBottom: 24, borderRadius: 16 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {archivosSolicitud.length > 0 && (
              <ArchivoGroup label="Solicitud" color="var(--color-primary)" bg="var(--archivo-solicitud-bg)" archivos={archivosSolicitud} />
            )}
            {archivosCompra.length > 0 && (
              <ArchivoGroup label="Comprobante de Pago" color="var(--archivo-compra-color)" bg="var(--archivo-compra-bg)" archivos={archivosCompra} />
            )}
            {archivosRecepcion.length > 0 && (
              <ArchivoGroup label="Recepción / Remito" color="var(--archivo-recepcion-color)" bg="var(--archivo-recepcion-bg)" archivos={archivosRecepcion} />
            )}
          </div>
        </Card>
      )}

      {/* Compra info */}
      {solicitud.compras.length > 0 && (
        <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Información de Compra</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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
        <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Recepciones</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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

/* ---------- Archivo helpers ---------- */

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  doc: '📝',
  docx: '📝',
  xls: '📊',
  xlsx: '📊',
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_ICONS[ext] ?? '📎'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ArchivoRow {
  id: number
  nombre_archivo: string
  tamanio_bytes: number | null
  created_at: string
  subido_por: { nombre: string } | null
}

function ArchivoGroup({ label, color, bg, archivos }: { label: string; color: string; bg: string; archivos: ArchivoRow[] }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 3, height: 16, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 13, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {archivos.map((a) => (
          <a
            key={a.id}
            href={`/api/archivos/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: bg,
              borderRadius: 10,
              border: `1px solid ${color}20`,
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
            }}
            >
              <span style={{ fontSize: 22, lineHeight: 1 }}>{getFileIcon(a.nombre_archivo)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.nombre_archivo}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {a.subido_por?.nombre ?? 'Usuario'}
                  {' · '}
                  {new Date(a.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {a.tamanio_bytes ? ` · ${formatBytes(Number(a.tamanio_bytes))}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color, whiteSpace: 'nowrap' }}>Descargar ↓</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
