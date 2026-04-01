'use client'

import { useState, useEffect } from 'react'
import { Card, Timeline, Typography, Tag, Spin } from 'antd'
import {
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  RollbackOutlined, ShoppingCartOutlined, ClockCircleOutlined,
  InboxOutlined, EditOutlined, StopOutlined, HistoryOutlined
} from '@ant-design/icons'

const { Text } = Typography

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  crear_solicitud:    { label: 'Creada',                color: 'gray',    icon: <EditOutlined /> },
  enviar_solicitud:   { label: 'Enviada',               color: 'blue',    icon: <SendOutlined /> },
  validar_solicitud:  { label: 'Validada',              color: 'cyan',    icon: <CheckCircleOutlined /> },
  aprobar_solicitud:  { label: 'Aprobada',              color: 'green',   icon: <CheckCircleOutlined /> },
  rechazar_solicitud: { label: 'Rechazada',             color: 'red',     icon: <CloseCircleOutlined /> },
  devolver_solicitud: { label: 'Devuelta',              color: 'orange',  icon: <RollbackOutlined /> },
  procesar_compras:   { label: 'Procesada (Compras)',   color: 'blue',    icon: <ShoppingCartOutlined /> },
  programar_pago:     { label: 'Pago Programado',       color: 'purple',  icon: <ClockCircleOutlined /> },
  registrar_compra:   { label: 'Compra Registrada',     color: 'geekblue',icon: <ShoppingCartOutlined /> },
  registrar_recepcion:{ label: 'Recepción Confirmada',  color: 'lime',    icon: <InboxOutlined /> },
  cerrar_solicitud:   { label: 'Cerrada',               color: 'purple',  icon: <CheckCircleOutlined /> },
  anular_solicitud:   { label: 'Anulada',               color: 'default', icon: <StopOutlined /> },
  editar_solicitud:   { label: 'Editada',               color: 'default', icon: <EditOutlined /> },
}

interface TimelineEvent {
  id: number
  accion: string
  usuario: string
  fecha: string
  detalles: any
  datosAnteriores: any
}

export default function TimelineSection({ solicitudId }: { solicitudId: number }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/solicitudes/${solicitudId}/timeline`)
      .then(r => r.json())
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [solicitudId])

  if (loading) return <Card style={{ borderRadius: 16, marginTop: 24 }}><Spin /></Card>
  if (events.length === 0) return null

  const formatDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('es-AR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <Card
      title={<span style={{ fontWeight: 700 }}><HistoryOutlined style={{ marginRight: 8 }} />Historial de Actividad</span>}
      style={{ borderRadius: 16, marginTop: 24 }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Timeline
        items={events.map(e => {
          const config = ACTION_CONFIG[e.accion] ?? { label: e.accion, color: 'default', icon: <ClockCircleOutlined /> }
          const detail = e.detalles?.motivo || e.detalles?.observaciones || e.detalles?.prioridad_compra || null

          return {
            color: config.color,
            dot: config.icon,
            children: (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag color={config.color}>{config.label}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(e.fecha)}</Text>
                </div>
                <Text style={{ fontSize: 13 }}>por <strong>{e.usuario}</strong></Text>
                {detail && (
                  <div style={{ marginTop: 4, padding: '6px 10px', background: '#f8fafc', borderRadius: 6, fontSize: 12 }}>
                    <Text type="secondary">{typeof detail === 'string' ? detail : JSON.stringify(detail)}</Text>
                  </div>
                )}
              </div>
            ),
          }
        })}
      />
    </Card>
  )
}
