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
  monto_estimado_total: number | null
  fecha_aprobacion: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function ComprasPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=aprobada&limit=100')
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
      title: 'Monto Est.',
      dataIndex: 'monto_estimado_total',
      key: 'monto_estimado_total',
      width: 130,
      render: (val: number | null) => (val != null ? `$${Number(val).toFixed(2)}` : '—'),
    },
    {
      title: 'Aprobado',
      dataIndex: 'fecha_aprobacion',
      key: 'fecha_aprobacion',
      width: 130,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleDateString('es-AR') : '—',
    },
    {
      title: 'Acción',
      key: 'actions',
      width: 150,
      render: (_, r) => (
        <Link href={`/compras/${r.id}`}>
          <Button size="small" type="primary">Registrar Compra</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Solicitudes Aprobadas — Registrar Compras
      </Title>
      <p style={{ color: '#888', marginBottom: 16 }}>
        Solicitudes aprobadas por dirección listas para procesar la compra.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay solicitudes aprobadas pendientes de compra' }}
      />
    </div>
  )
}
