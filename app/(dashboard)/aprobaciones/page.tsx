'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Typography, Button, Modal, App } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import { CheckOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { URGENCIAS } from '@/types'
import type { UrgenciaSolicitud } from '@/types'

const { Title } = Typography

interface SolicitudItem {
  precio_estimado: number | null
  cantidad: number
}

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  updated_at: string
  fecha_validacion: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
  items_solicitud: SolicitudItem[]
}

function calcMonto(items: SolicitudItem[]): number {
  return items.reduce((sum, it) => sum + (it.precio_estimado ? Number(it.precio_estimado) * Number(it.cantidad) : 0), 0)
}

function formatMonto(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function AprobacionesPage() {
  const router = useRouter()
  const { message, modal } = App.useApp()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=validada&limit=100')
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const handler = () => { fetchData() }
    window.addEventListener('admin-tenant-change', handler)
    return () => window.removeEventListener('admin-tenant-change', handler)
  }, [fetchData])

  const handleApprove = useCallback(async (solicitud: Solicitud) => {
    setApprovingId(solicitud.id)
    try {
      const res = await fetch(`/api/solicitudes/${solicitud.id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updated_at: solicitud.updated_at }),
      })
      if (res.ok) {
        message.success(`Solicitud ${solicitud.numero} aprobada`)
        setSolicitudes(prev => prev.filter(s => s.id !== solicitud.id))
        setSelectedRowKeys(prev => prev.filter(k => k !== solicitud.id))
      } else {
        const err = await res.json().catch(() => null)
        Modal.error({ title: 'Error al aprobar', content: err?.error?.message || 'Error desconocido' })
      }
    } catch {
      Modal.error({ title: 'Error', content: 'No se pudo conectar con el servidor' })
    } finally {
      setApprovingId(null)
    }
  }, [message])

  const handleBulkApprove = useCallback(() => {
    const count = selectedRowKeys.length
    if (count === 0) return

    modal.confirm({
      title: `¿Aprobar ${count} solicitud${count > 1 ? 'es' : ''} seleccionada${count > 1 ? 's' : ''}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Aprobar',
      cancelText: 'Cancelar',
      okType: 'primary',
      onOk: async () => {
        setBulkApproving(true)
        try {
          const res = await fetch('/api/solicitudes/aprobar-masivo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys }),
          })
          if (res.ok) {
            const result = await res.json()
            if (result.aprobadas > 0) {
              message.success(`${result.aprobadas} solicitud${result.aprobadas > 1 ? 'es' : ''} aprobada${result.aprobadas > 1 ? 's' : ''}`)
            }
            if (result.errores?.length > 0) {
              Modal.warning({
                title: `${result.errores.length} solicitud${result.errores.length > 1 ? 'es' : ''} no se pudieron aprobar`,
                content: result.errores.map((e: any) => `#${e.id}: ${e.error}`).join('\n'),
              })
            }
            setSelectedRowKeys([])
            fetchData()
          } else {
            const err = await res.json().catch(() => null)
            Modal.error({ title: 'Error', content: err?.error?.message || 'Error desconocido' })
          }
        } catch {
          Modal.error({ title: 'Error', content: 'No se pudo conectar con el servidor' })
        } finally {
          setBulkApproving(false)
        }
      },
    })
  }, [selectedRowKeys, message, modal, fetchData])

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'Número', dataIndex: 'numero', key: 'numero', width: 130,
      render: (val: string, r: Solicitud) => (
        <a onClick={() => router.push(`/solicitudes/${r.id}`)} style={{ cursor: 'pointer' }}>{val}</a>
      ),
    },
    { title: 'Título', dataIndex: 'titulo', key: 'titulo', ellipsis: true },
    {
      title: 'Área',
      key: 'area',
      render: (_, r) => r.area?.nombre ?? '—',
      width: 140,
    },
    {
      title: 'Solicitante',
      key: 'solicitante',
      render: (_, r) => r.solicitante?.nombre ?? '—',
      width: 160,
    },
    {
      title: 'Monto',
      key: 'monto',
      width: 140,
      align: 'right' as const,
      render: (_, r) => formatMonto(calcMonto(r.items_solicitud)),
      sorter: (a, b) => calcMonto(a.items_solicitud) - calcMonto(b.items_solicitud),
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      key: 'urgencia',
      width: 110,
      render: (val: string) => {
        const u = URGENCIAS[val as UrgenciaSolicitud]
        return u ? <Tag color={u.color}>{u.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: '',
      key: 'acciones',
      width: 100,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          loading={approvingId === r.id}
          onClick={(e) => { e.stopPropagation(); handleApprove(r) }}
        >
          Aprobar
        </Button>
      ),
    },
  ]

  return (
    <div className="page-content">
      <Title level={3} style={{ margin: 0, marginBottom: 8, fontWeight: 700, color: 'var(--text-primary)' }}>
        Solicitudes Pendientes de Aprobación
      </Title>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Solicitudes validadas por los responsables de área que requieren su aprobación.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay solicitudes pendientes de aprobación' }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
          getCheckboxProps: (record: Solicitud) => ({
            disabled: record.urgencia === 'urgente' || record.urgencia === 'critica',
            title: record.urgencia === 'urgente' || record.urgencia === 'critica'
              ? 'Las solicitudes urgentes y críticas deben aprobarse individualmente'
              : undefined,
          }),
        }}
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' :
          'urgencia-row-normal'
        }
      />
      {selectedRowKeys.length > 0 && (
        <div style={{
          position: 'sticky',
          bottom: 16,
          display: 'flex',
          justifyContent: 'center',
          marginTop: 16,
        }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={bulkApproving}
            onClick={handleBulkApprove}
            style={{ borderRadius: 8, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            Aprobar seleccionadas ({selectedRowKeys.length})
          </Button>
        </div>
      )}
    </div>
  )
}
