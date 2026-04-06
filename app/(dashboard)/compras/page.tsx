'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Button, Typography, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import { URGENCIAS } from '@/types'
import type { UrgenciaSolicitud } from '@/types'
import dayjs from 'dayjs'

const { Title } = Typography

const PRIORIDAD_COLORS: Record<string, string> = {
  urgente: 'red',
  normal: 'blue',
  programado: 'default',
}

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  prioridad_compra: string | null
  dia_pago_programado: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function ComprasPage() {
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=pago_programado&limit=100')
      if (res.ok) {
        const data = await res.json()
        // Sort by dia_pago_programado ascending (nearest date first)
        const sorted = (data.data ?? []).sort((a: Solicitud, b: Solicitud) => {
          const dateA = a.dia_pago_programado ? new Date(a.dia_pago_programado).getTime() : Infinity
          const dateB = b.dia_pago_programado ? new Date(b.dia_pago_programado).getTime() : Infinity
          return dateA - dateB
        })
        setSolicitudes(sorted)
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
      title: 'Prioridad',
      dataIndex: 'prioridad_compra',
      key: 'prioridad',
      width: 110,
      render: (val: string | null) =>
        val ? <Tag color={PRIORIDAD_COLORS[val] ?? 'default'}>{val.charAt(0).toUpperCase() + val.slice(1)}</Tag> : '—',
    },
    {
      title: 'Fecha de Pago',
      dataIndex: 'dia_pago_programado',
      key: 'dia_pago',
      width: 130,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleDateString('es-AR') : '—',
    },
    {
      title: 'Acción',
      key: 'accion',
      width: 160,
      render: (_, r) => {
        const pagoDate = r.dia_pago_programado ? dayjs(r.dia_pago_programado).startOf('day') : null
        const today = dayjs().startOf('day')
        const canRegister = pagoDate && !pagoDate.isAfter(today)

        if (canRegister) {
          return (
            <Button type="primary" size="small" onClick={() => router.push(`/compras/${r.id}`)}>
              Registrar Pago
            </Button>
          )
        }

        return (
          <Tooltip title={`Habilitado el ${pagoDate?.format('DD/MM/YYYY') ?? '—'}`}>
            <Button type="primary" size="small" disabled>
              Registrar Pago
            </Button>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <div className="page-content">
      <Title level={3} style={{ margin: 0, marginBottom: 8, fontWeight: 700, color: 'var(--text-primary)' }}>
        Pagos Programados — Registrar Pagos
      </Title>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Solicitudes con pago programado, ordenadas por fecha de pago. El botón se habilita cuando llega la fecha.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay pagos programados pendientes' }}
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' :
          'urgencia-row-normal'
        }
      />
    </div>
  )
}
