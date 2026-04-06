'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Typography, Space, Card, Statistic, Tabs, Button, Descriptions } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeftOutlined, ShoppingCartOutlined, FileTextOutlined, DollarOutlined } from '@ant-design/icons'
import { URGENCIAS, ESTADOS_SOLICITUD } from '@/types'
import type { UrgenciaSolicitud, EstadoSolicitud } from '@/types'

const { Title, Text } = Typography

interface Proveedor {
  id: number
  nombre: string
  cuit: string | null
  email: string | null
  telefono: string | null
}

interface Solicitud {
  id: number
  numero: string
  titulo: string
  estado: string
  urgencia: string
  created_at: string
  solicitante: { nombre: string }
  area: { nombre: string }
}

interface Compra {
  id: number
  solicitud_id: number
  proveedor_nombre: string
  fecha_compra: string
  monto_total: number
  medio_pago: string
  numero_factura: string | null
  observaciones: string | null
  solicitud: { numero: string; titulo: string }
  ejecutado_por: { nombre: string }
}

export default function ProveedorComprasPage() {
  const router = useRouter()
  const params = useParams()
  const proveedorId = params.id as string

  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proveedores/${proveedorId}/compras`)
      if (!res.ok) return
      const data = await res.json()
      setProveedor(data.proveedor)
      setSolicitudes(data.solicitudes)
      setCompras(data.compras)
    } finally {
      setLoading(false)
    }
  }, [proveedorId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const handler = () => { fetchData() }
    window.addEventListener('admin-tenant-change', handler)
    return () => window.removeEventListener('admin-tenant-change', handler)
  }, [fetchData])

  const totalCompras = compras.reduce((sum, c) => sum + Number(c.monto_total), 0)

  const solicitudColumns: ColumnsType<Solicitud> = [
    {
      title: 'Número',
      dataIndex: 'numero',
      key: 'numero',
      width: 130,
      render: (num: string, record) => (
        <a onClick={() => router.push(`/solicitudes/${record.id}`)} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          {num}
        </a>
      ),
    },
    { title: 'Título', dataIndex: 'titulo', key: 'titulo', ellipsis: true },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 140,
      render: (estado: string) => {
        const cfg = ESTADOS_SOLICITUD[estado as EstadoSolicitud]
        return <Tag color={cfg?.color ?? 'default'}>{cfg?.label ?? estado}</Tag>
      },
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      key: 'urgencia',
      width: 110,
      render: (u: string) => {
        const cfg = URGENCIAS[u as UrgenciaSolicitud]
        return <Tag color={cfg?.color ?? 'default'}>{cfg?.label ?? u}</Tag>
      },
    },
    {
      title: 'Área',
      key: 'area',
      width: 140,
      render: (_: unknown, r: Solicitud) => r.area?.nombre ?? '—',
    },
    {
      title: 'Solicitante',
      key: 'solicitante',
      width: 150,
      render: (_: unknown, r: Solicitud) => r.solicitante?.nombre ?? '—',
    },
  ]

  const compraColumns: ColumnsType<Compra> = [
    {
      title: 'Solicitud',
      key: 'solicitud',
      width: 130,
      render: (_: unknown, r: Compra) => (
        <a onClick={() => router.push(`/solicitudes/${r.solicitud_id}`)} style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          {r.solicitud.numero}
        </a>
      ),
    },
    {
      title: 'Descripción',
      key: 'titulo',
      ellipsis: true,
      render: (_: unknown, r: Compra) => r.solicitud.titulo,
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha_compra',
      key: 'fecha',
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString('es-AR'),
    },
    {
      title: 'Monto',
      dataIndex: 'monto_total',
      key: 'monto',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `$ ${Number(v).toLocaleString('es-AR')}`,
    },
    { title: 'Medio de Pago', dataIndex: 'medio_pago', key: 'medio', width: 130 },
    {
      title: 'Factura',
      dataIndex: 'numero_factura',
      key: 'factura',
      width: 120,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Ejecutado por',
      key: 'ejecutado',
      width: 150,
      render: (_: unknown, r: Compra) => r.ejecutado_por?.nombre ?? '—',
    },
  ]

  const urgenciaClass = (record: Solicitud) => {
    const u = record.urgencia as UrgenciaSolicitud
    return `urgencia-row-${u || 'normal'}`
  }

  return (
    <div className="page-content">
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <a onClick={() => router.back()} style={{ color: 'var(--color-primary)', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>
          ← Volver
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ShoppingCartOutlined style={{ fontSize: 28, color: 'var(--color-primary)' }} />
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
            {proveedor?.nombre ?? 'Cargando...'}
          </Title>
          {proveedor && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {[proveedor.cuit, proveedor.email, proveedor.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
            </Text>
          )}
        </div>
      </div>

      <Space size="large" style={{ marginBottom: 24 }}>
        <Card size="middle" style={{ minWidth: 160, borderColor: '#e2e8f0' }}>
          <Statistic
            title={<Text type="secondary" style={{ fontSize: 12 }}>Solicitudes</Text>}
            value={solicitudes.length}
            prefix={<FileTextOutlined style={{ color: 'var(--color-primary)' }} />}
          />
        </Card>
        <Card size="middle" style={{ minWidth: 160, borderColor: '#e2e8f0' }}>
          <Statistic
            title={<Text type="secondary" style={{ fontSize: 12 }}>Compras Registradas</Text>}
            value={compras.length}
            prefix={<ShoppingCartOutlined style={{ color: '#22c55e' }} />}
          />
        </Card>
        <Card size="middle" style={{ minWidth: 180, borderColor: '#e2e8f0' }}>
          <Statistic
            title={<Text type="secondary" style={{ fontSize: 12 }}>Total Comprado</Text>}
            value={totalCompras}
            precision={2}
            prefix={<DollarOutlined style={{ color: '#f59e0b' }} />}
            formatter={(val) => `$ ${Number(val).toLocaleString('es-AR')}`}
          />
        </Card>
      </Space>

      <Tabs
        defaultActiveKey="solicitudes"
        items={[
          {
            key: 'solicitudes',
            label: `Solicitudes (${solicitudes.length})`,
            children: (
              <Table
                rowKey="id"
                columns={solicitudColumns}
                dataSource={solicitudes}
                loading={loading}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                size="middle"
                rowClassName={urgenciaClass}
              />
            ),
          },
          {
            key: 'compras',
            label: `Compras (${compras.length})`,
            children: (
              <Table
                rowKey="id"
                columns={compraColumns}
                dataSource={compras}
                loading={loading}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                size="middle"
              />
            ),
          },
        ]}
      />
    </div>
  )
}
