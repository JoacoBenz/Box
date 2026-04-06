'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { Table, Tag, Select, Space, Button, Input, Card, Typography, DatePicker } from 'antd'
import { SearchOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import Link from 'next/link'
import dayjs from 'dayjs'

const { Text } = Typography

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  fecha_envio: string | null
  created_at: string
  area: { id: number; nombre: string } | null
  solicitante: { id: number; nombre: string }
}

interface Props {
  roles: string[]
  areas: { id: number; nombre: string }[]
}

export default function SolicitudesTable({ roles, areas }: Props) {
  const { tokens } = useTheme()
  const router = useRouter()
  const canExport = ['director', 'tesoreria', 'compras', 'admin'].some(r => roles.includes(r))
  const isSolicitante = roles.includes('solicitante')

  // Filters
  const [estado, setEstado] = useState<string | undefined>()
  const [solicitanteId, setSolicitanteId] = useState<number | undefined>()
  const [areaId, setAreaId] = useState<number | undefined>()
  const [busqueda, setBusqueda] = useState('')
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState<string | undefined>()
  const [fechaHasta, setFechaHasta] = useState<string | undefined>()
  const searchTimeout = useRef<any>(null)

  // Solicitantes list
  const [solicitantes, setSolicitantes] = useState<{ id: number; nombre: string }[]>([])
  useEffect(() => {
    fetch('/api/usuarios?rol=solicitante').then(r => r.ok ? r.json() : []).then((users: any[]) => {
      setSolicitantes(users.map(u => ({ id: u.id, nombre: u.nombre })))
    }).catch(() => {})
  }, [])

  // Data
  const [data, setData] = useState<Solicitud[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [loading, setLoading] = useState(true)

  // Re-fetch when admin switches tenant
  const [tenantVersion, setTenantVersion] = useState(0)
  useEffect(() => {
    const handler = () => { setTenantVersion(v => v + 1); setPage(1) }
    window.addEventListener('admin-tenant-change', handler)
    return () => window.removeEventListener('admin-tenant-change', handler)
  }, [])

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
      if (solicitanteId) params.set('solicitante_id', String(solicitanteId))
      if (areaId) params.set('area_id', String(areaId))
      if (debouncedBusqueda) params.set('busqueda', debouncedBusqueda)
      if (fechaDesde) params.set('desde', fechaDesde)
      if (fechaHasta) params.set('hasta', fechaHasta)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, estado, solicitanteId, areaId, debouncedBusqueda, fechaDesde, fechaHasta, tenantVersion])

  useEffect(() => { fetchData() }, [fetchData])

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 20)
  }

  const clearFilters = () => {
    setEstado(undefined)
    setSolicitanteId(undefined)
    setAreaId(undefined)
    setFechaDesde(undefined)
    setFechaHasta(undefined)
    setBusqueda('')
    setDebouncedBusqueda('')
    setPage(1)
  }

  const hasFilters = estado || solicitanteId || areaId || debouncedBusqueda || fechaDesde || fechaHasta

  const columns: ColumnsType<Solicitud> = useMemo(() => [
    {
      title: 'Número',
      dataIndex: 'numero',
      key: 'numero',
      width: 140,
      render: (val: string, r: Solicitud) => (
        <a onClick={() => router.push(`/solicitudes/${r.id}`)} style={{ cursor: 'pointer', fontWeight: 600, color: tokens.colorPrimary }}>
          {val}
        </a>
      ),
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      key: 'titulo',
      ellipsis: true,
      render: (val: string) => <Text style={{ color: tokens.textPrimary }}>{val}</Text>,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [router])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: tokens.textPrimary }}>Solicitudes de Compra</h3>
        <Space>
          {canExport && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const params = new URLSearchParams()
                if (estado) params.set('estado', estado)
                if (solicitanteId) params.set('solicitante_id', String(solicitanteId))
                if (areaId) params.set('area_id', String(areaId))
                if (debouncedBusqueda) params.set('q', debouncedBusqueda)
                if (fechaDesde) params.set('desde', fechaDesde)
                if (fechaHasta) params.set('hasta', fechaHasta)
                window.open(`/api/solicitudes/export?${params.toString()}`)
              }}
            >
              Exportar
            </Button>
          )}
          {isSolicitante && (
            <Link href="/solicitudes/nueva">
              <Button type="primary" icon={<PlusOutlined />} style={{ background: tokens.colorPrimary }}>
                Nueva Solicitud
              </Button>
            </Link>
          )}
        </Space>
      </div>

      {/* Filters */}
      <Card size="small" style={{ borderRadius: 12, marginBottom: 16, border: `1px solid ${tokens.borderColor}` }} styles={{ body: { padding: '12px 16px' } }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: tokens.textMuted }} />}
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            allowClear
            style={{ borderRadius: 8, flex: '1 1 180px', minWidth: 120 }}
          />
          <Select
            allowClear
            placeholder="Solicitante"
            style={{ flex: '0 0 160px' }}
            value={solicitanteId}
            onChange={(v) => { setSolicitanteId(v); setPage(1) }}
            options={solicitantes.map(s => ({ value: s.id, label: s.nombre }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            placeholder="Área"
            style={{ flex: '0 0 140px' }}
            value={areaId}
            onChange={(v) => { setAreaId(v); setPage(1) }}
            options={areas.map(a => ({ value: a.id, label: a.nombre }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            placeholder="Estado"
            style={{ flex: '0 0 130px' }}
            value={estado}
            onChange={(v) => { setEstado(v); setPage(1) }}
            options={Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => ({ value: k, label: v.label }))}
          />
          <DatePicker
            placeholder="Desde"
            style={{ flex: '0 0 130px' }}
            format="DD/MM/YYYY"
            value={fechaDesde ? dayjs(fechaDesde) : null}
            onChange={(d: any) => { setFechaDesde(d ? d.format('YYYY-MM-DD') : undefined); setPage(1) }}
          />
          <DatePicker
            placeholder="Hasta"
            style={{ flex: '0 0 130px' }}
            format="DD/MM/YYYY"
            value={fechaHasta ? dayjs(fechaHasta) : null}
            onChange={(d: any) => { setFechaHasta(d ? d.format('YYYY-MM-DD') : undefined); setPage(1) }}
          />
          <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <Space>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{total} resultado{total !== 1 ? 's' : ''}</Text>
              <Button icon={<ReloadOutlined />} onClick={clearFilters} size="small" type="text" style={{ color: tokens.textSecondary }} />
            </Space>
          </div>
        </div>
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
