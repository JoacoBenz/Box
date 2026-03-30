'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Button, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'

const { Title } = Typography

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  fecha_envio: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function ValidacionesPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=enviada&limit=100')
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
    { title: 'Solicitante', key: 'solicitante', render: (_, r) => r.solicitante?.nombre ?? '—', width: 160 },
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
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 140,
      render: (val: string) => {
        const e = ESTADOS_SOLICITUD[val as EstadoSolicitud]
        return e ? <Tag color={e.color}>{e.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: 'Fecha Envío',
      dataIndex: 'fecha_envio',
      key: 'fecha_envio',
      width: 130,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleDateString('es-AR') : '—',
    },
    {
      title: 'Acción',
      key: 'actions',
      width: 130,
      render: (_, r) => (
        <Link href={`/solicitudes/${r.id}`}>
          <Button size="small" type="primary">Ver y Validar</Button>
        </Link>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Solicitudes Pendientes de Validación
      </Title>
      <p style={{ color: '#888', marginBottom: 16 }}>
        Mostrando solicitudes en estado <Tag color="blue">Enviada</Tag> y{' '}
        <Tag color="orange">Devuelta por Dirección</Tag> de tu área.
      </p>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay solicitudes pendientes de validación' }}
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' : ''
        }
      />
    </div>
  )
}
