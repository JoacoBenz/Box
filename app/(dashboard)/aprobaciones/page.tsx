'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter } from 'next/navigation'
import { URGENCIAS } from '@/types'
import type { UrgenciaSolicitud } from '@/types'

const { Title } = Typography

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  fecha_validacion: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function AprobacionesPage() {
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

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
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' :
          'urgencia-row-normal'
        }
      />
    </div>
  )
}
