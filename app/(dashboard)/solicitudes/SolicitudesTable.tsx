'use client'

import { Table, Tag, Button, Select, Space } from 'antd'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import type { ColumnsType } from 'antd/es/table'

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  fecha_envio: string | null
  created_at: string
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

interface Props {
  solicitudes: Solicitud[]
  estadoFilter?: string
  urgenciaFilter?: string
}

export default function SolicitudesTable({ solicitudes, estadoFilter, urgenciaFilter }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  function updateFilter(key: string, value: string | undefined) {
    const params = new URLSearchParams()
    if (key !== 'estado' && estadoFilter) params.set('estado', estadoFilter)
    if (key !== 'urgencia' && urgenciaFilter) params.set('urgencia', urgenciaFilter)
    if (value) params.set(key, value)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'Número',
      dataIndex: 'numero',
      key: 'numero',
      width: 130,
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true,
    },
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
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 180,
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
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Button size="small" type="link" onClick={() => router.push(`/solicitudes/${r.id}`)}>
          Ver
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Filtrar por estado"
          style={{ width: 200 }}
          value={estadoFilter || undefined}
          onChange={(v) => updateFilter('estado', v)}
          options={Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => ({ value: k, label: v.label }))}
        />
        <Select
          allowClear
          placeholder="Filtrar por urgencia"
          style={{ width: 170 }}
          value={urgenciaFilter || undefined}
          onChange={(v) => updateFilter('urgencia', v)}
          options={Object.entries(URGENCIAS).map(([k, v]) => ({ value: k, label: v.label }))}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={solicitudes}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' : ''
        }
      />
    </div>
  )
}
