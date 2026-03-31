'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Table, Tag, Select, Space, Button, Input, Card, Row, Col, Typography } from 'antd'
import { SearchOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import Link from 'next/link'

const { Text } = Typography

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  monto_estimado_total: number | string | null
  fecha_envio: string | null
  created_at: string
  area: { id: number; nombre: string } | null
  solicitante: { id: number; nombre: string }
}

interface Props {
  roles: string[]
  areas: { id: number; nombre: string }[]
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

export default function SolicitudesTable({ roles, areas }: Props) {
  const router = useRouter()
  const canExport = ['director', 'tesoreria', 'compras', 'admin'].some(r => roles.includes(r))
  const isSolicitante = roles.includes('solicitante')

  // Filters
  const [estado, setEstado] = useState<string | undefined>()
  const [urgencia, setUrgencia] = useState<string | undefined>()
  const [areaId, setAreaId] = useState<number | undefined>()
  const [busqueda, setBusqueda] = useState('')
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('')
  const searchTimeout = useRef<any>(null)

  // Data
  const [data, setData] = useState<Solicitud[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedBusqueda(busqueda)
      setPage(1)
    }, 400)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [busqueda])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      if (estado) params.set('estado', estado)
      if (urgencia) params.set('urgencia', urgencia)
      if (areaId) params.set('area_id', String(areaId))
      if (debouncedBusqueda) params.set('busqueda', debouncedBusqueda)

      const res = await fetch(`/api/solicitudes?${params.toString()}`)
      const json = await res.json()
      setData(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setData([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, estado, urgencia, areaId, debouncedBusqueda])

  useEffect(() => { fetchData() }, [fetchData])

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 20)
  }

  const clearFilters = () => {
    setEstado(undefined)
    setUrgencia(undefined)
    setAreaId(undefined)
    setBusqueda('')
    setDebouncedBusqueda('')
    setPage(1)
  }

  const hasFilters = estado || urgencia || areaId || debouncedBusqueda

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'Número',
      dataIndex: 'numero',
      key: 'numero',
      width: 140,
      render: (val: string, r: Solicitud) => (
        <a onClick={() => router.push(`/solicitudes/${r.id}`)} style={{ cursor: 'pointer', fontWeight: 600, color: '#4f46e5' }}>
          {val}
        </a>
      ),
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true,
      render: (val: string) => <Text style={{ color: '#1e293b' }}>{val}</Text>,
    },
    {
      title: 'Solicitante',
      key: 'solicitante',
      width: 150,
      render: (_, r) => <Text type="secondary" style={{ fontSize: 13 }}>{r.solicitante?.nombre ?? '—'}</Text>,
    },
    {
      title: 'Área',
      key: 'area',
      width: 140,
      render: (_, r) => <Text type="secondary" style={{ fontSize: 13 }}>{r.area?.nombre ?? '—'}</Text>,
    },
    {
      title: 'Monto Est.',
      dataIndex: 'monto_estimado_total',
      key: 'monto',
      width: 130,
      align: 'right' as const,
      render: (val: number | string | null) => {
        if (!val) return <Text type="secondary">—</Text>
        return <Text strong style={{ fontSize: 13 }}>{formatMoney(Number(val))}</Text>
      },
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
      title: 'Fecha',
      key: 'fecha',
      width: 110,
      render: (_, r) => {
        const date = r.fecha_envio || r.created_at
        return date ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(date).toLocaleDateString('es-AR')}</Text> : '—'
      },
    },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Solicitudes de Compra</h3>
        <Space>
          {canExport && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const params = new URLSearchParams()
                if (estado) params.set('estado', estado)
                if (areaId) params.set('area_id', String(areaId))
                window.open(`/api/solicitudes/export?${params.toString()}`)
              }}
            >
              Exportar
            </Button>
          )}
          {isSolicitante && (
            <Link href="/solicitudes/nueva">
              <Button type="primary" icon={<PlusOutlined />} style={{ background: '#4f46e5' }}>
                Nueva Solicitud
              </Button>
            </Link>
          )}
        </Space>
      </div>

      {/* Filters */}
      <Card size="small" style={{ borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} lg={8}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Buscar por número, título o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              allowClear
              placeholder="Estado"
              style={{ width: '100%' }}
              value={estado}
              onChange={(v) => { setEstado(v); setPage(1) }}
              options={Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Select
              allowClear
              placeholder="Urgencia"
              style={{ width: '100%' }}
              value={urgencia}
              onChange={(v) => { setUrgencia(v); setPage(1) }}
              options={Object.entries(URGENCIAS).map(([k, v]) => ({ value: k, label: v.label }))}
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select
              allowClear
              placeholder="Área"
              style={{ width: '100%' }}
              value={areaId}
              onChange={(v) => { setAreaId(v); setPage(1) }}
              options={areas.map(a => ({ value: a.id, label: a.nombre }))}
              showSearch
              optionFilterProp="label"
            />
          </Col>
          <Col xs={12} sm={6} lg={5}>
            <Space>
              {hasFilters && (
                <Button onClick={clearFilters} size="small" type="link" style={{ color: '#64748b' }}>
                  Limpiar filtros
                </Button>
              )}
              <Button icon={<ReloadOutlined />} onClick={fetchData} size="small" type="text" style={{ color: '#64748b' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{total} resultado{total !== 1 ? 's' : ''}</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: (t, range) => `${range[0]}-${range[1]} de ${t}`,
          size: 'small',
        }}
        onChange={handleTableChange}
        size="middle"
        style={{ borderRadius: 12, overflow: 'hidden' }}
        rowClassName={(record: Solicitud) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' :
          'urgencia-row-normal'
        }
        onRow={(record) => ({
          style: { cursor: 'pointer' },
          onClick: (e) => {
            // Don't navigate if clicking on the number link
            if ((e.target as HTMLElement).tagName === 'A') return
            router.push(`/solicitudes/${record.id}`)
          },
        })}
      />
    </div>
  )
}
