'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Button, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { URGENCIAS } from '@/types'
import type { UrgenciaSolicitud } from '@/types'

const { Title } = Typography

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function RecepcionesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=comprada&limit=100')
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const columns: ColumnsType<Solicitud> = [
    { title: 'Número', dataIndex: 'numero', key: 'numero', width: 130 },
    { title: 'Título', dataIndex: 'titulo', key: 'titulo', ellipsis: true },
    {
      title: 'Área',
      key: 'area',
      render: (_, r) => r.area?.nombre ?? '—',
      width: 140,
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
      title: 'Acción',
      key: 'actions',
      width: 170,
      render: (_, r) => (
        <Link href={`/solicitudes/${r.id}`}>
          <Button size="small" type="primary" style={{ background: '#52c41a' }}>
            Confirmar Recepción
          </Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Recepciones Pendientes
      </Title>
      <p style={{ color: '#888', marginBottom: 16 }}>
        Estas solicitudes ya fueron compradas y esperan su confirmación de recepción.
        Haga clic en <strong>Confirmar Recepción</strong> para ir al detalle y confirmar.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay recepciones pendientes' }}
      />
    </div>
  )
}
