'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Select, DatePicker, Space, Typography, Tag, Empty, Spin, Row, Col, Statistic, Button } from 'antd'
import { BarChartOutlined, ShoppingOutlined, RiseOutlined, DownloadOutlined } from '@ant-design/icons'
import { useTheme } from '@/components/ThemeProvider'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface ReportData {
  gastosPorProducto: any[]
  gastosPorArea: any[]
  evolucionMensual: any[]
  topProveedores: any[]
  productosMasSolicitados: any[]
  areas: { id: number; nombre: string }[]
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return '$0'
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ReportesPage() {
  const { tokens } = useTheme()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [areaId, setAreaId] = useState<number | undefined>(undefined)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateRange[0]) params.set('desde', dateRange[0].format('YYYY-MM-DD'))
      if (dateRange[1]) params.set('hasta', dateRange[1].format('YYYY-MM-DD'))
      if (areaId) params.set('area_id', String(areaId))

      const res = await fetch(`/api/reportes?${params}`)
      if (res.ok) {
        setData(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [dateRange, areaId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalGasto = data?.gastosPorArea?.reduce((sum, r) => sum + Number(r.gasto_total || 0), 0) ?? 0
  const totalCompras = data?.topProveedores?.reduce((sum, r) => sum + Number(r.num_compras || 0), 0) ?? 0
  const totalProductos = data?.productosMasSolicitados?.length ?? 0

  const buildExportParams = () => {
    const params = new URLSearchParams()
    if (dateRange[0]) params.set('desde', dateRange[0].format('YYYY-MM-DD'))
    if (dateRange[1]) params.set('hasta', dateRange[1].format('YYYY-MM-DD'))
    if (areaId) params.set('area_id', String(areaId))
    return params.toString()
  }

  return (
    <div className="page-content" style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 8, fontWeight: 700, color: tokens.textPrimary }}>
        <BarChartOutlined style={{ marginRight: 8 }} />
        Reportes
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Análisis de gastos y solicitudes de compra
      </Text>

      <Card style={{ borderRadius: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <Space size={16} wrap>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Período</Text>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates ? [dates[0], dates[1]] : [null, null])}
                format="DD/MM/YYYY"
                placeholder={['Desde', 'Hasta']}
              />
            </div>
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Área</Text>
              <Select
                allowClear
                placeholder="Todas las áreas"
                value={areaId}
                onChange={(val) => setAreaId(val)}
                style={{ width: 200 }}
                options={(data?.areas ?? []).map(a => ({ value: a.id, label: a.nombre }))}
              />
            </div>
          </Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => window.open(`/api/reportes/export?${buildExportParams()}`)}
            disabled={loading || !data}
          >
            Descargar Excel
          </Button>
        </div>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !data ? (
        <Empty description="No se pudieron cargar los reportes" />
      ) : (
        <>
          {/* Summary cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12 }}>
                <Statistic
                  title="Gasto Total"
                  value={totalGasto}
                  prefix="$"
                  precision={2}
                  styles={{ content: { color: tokens.colorPrimary, fontWeight: 700 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12 }}>
                <Statistic
                  title="Total Compras"
                  value={totalCompras}
                  prefix={<ShoppingOutlined />}
                  styles={{ content: { fontWeight: 700 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card style={{ borderRadius: 12 }}>
                <Statistic
                  title="Productos Diferentes"
                  value={totalProductos}
                  prefix={<RiseOutlined />}
                  styles={{ content: { fontWeight: 700 } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Gasto por producto */}
          <Card
            title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Gasto por Producto</span>}
            style={{ borderRadius: 12, marginBottom: 24 }}
          >
            <Table
              dataSource={data.gastosPorProducto}
              rowKey="producto"
              size="small"
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Producto', dataIndex: 'producto', key: 'producto', ellipsis: true },
                {
                  title: 'Área', dataIndex: 'area', key: 'area', width: 130,
                  render: (v: string) => v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
                },
                {
                  title: 'Cantidad Total', dataIndex: 'cantidad_total', key: 'cantidad_total', width: 120, align: 'right' as const,
                  render: (v: number) => Number(v).toLocaleString('es-AR'),
                },
                {
                  title: 'Gasto Total', dataIndex: 'gasto_total', key: 'gasto_total', width: 150, align: 'right' as const,
                  render: (v: number) => formatMoney(v),
                  sorter: (a: any, b: any) => Number(a.gasto_total) - Number(b.gasto_total),
                  defaultSortOrder: 'descend' as const,
                },
                {
                  title: 'Solicitudes', dataIndex: 'num_solicitudes', key: 'num_solicitudes', width: 100, align: 'center' as const,
                },
                {
                  title: 'Último Precio', dataIndex: 'ultimo_precio', key: 'ultimo_precio', width: 130, align: 'right' as const,
                  render: (v: number) => formatMoney(v),
                },
              ]}
            />
          </Card>

          {/* Gasto por área + Top proveedores */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Gasto por Área</span>}
                style={{ borderRadius: 12, height: '100%' }}
              >
                <Table
                  dataSource={data.gastosPorArea}
                  rowKey="area"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Área', dataIndex: 'area', key: 'area' },
                    {
                      title: 'Gasto Total', dataIndex: 'gasto_total', key: 'gasto_total', align: 'right' as const,
                      render: (v: number) => formatMoney(v),
                    },
                    { title: 'Solicitudes', dataIndex: 'num_solicitudes', key: 'num_solicitudes', align: 'center' as const },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Top Proveedores</span>}
                style={{ borderRadius: 12, height: '100%' }}
              >
                <Table
                  dataSource={data.topProveedores}
                  rowKey="proveedor"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: 'Proveedor', dataIndex: 'proveedor', key: 'proveedor', ellipsis: true },
                    {
                      title: 'Gasto Total', dataIndex: 'gasto_total', key: 'gasto_total', align: 'right' as const,
                      render: (v: number) => formatMoney(v),
                    },
                    { title: 'Compras', dataIndex: 'num_compras', key: 'num_compras', align: 'center' as const },
                  ]}
                />
              </Card>
            </Col>
          </Row>

          {/* Productos más solicitados */}
          <Card
            title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Productos Más Solicitados</span>}
            style={{ borderRadius: 12, marginBottom: 24 }}
          >
            <Table
              dataSource={data.productosMasSolicitados}
              rowKey="producto"
              size="small"
              pagination={false}
              columns={[
                { title: 'Producto', dataIndex: 'producto', key: 'producto', ellipsis: true },
                {
                  title: 'Área', dataIndex: 'area', key: 'area', width: 130,
                  render: (v: string) => v ? <Tag>{v}</Tag> : '—',
                },
                { title: 'Solicitudes', dataIndex: 'num_solicitudes', key: 'num_solicitudes', align: 'center' as const },
                {
                  title: 'Cantidad Total', dataIndex: 'cantidad_total', key: 'cantidad_total', align: 'right' as const,
                  render: (v: number) => Number(v).toLocaleString('es-AR'),
                },
              ]}
            />
          </Card>

          {/* Evolución mensual */}
          <Card
            title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Evolución Mensual de Gastos</span>}
            style={{ borderRadius: 12, marginBottom: 24 }}
          >
            {data.evolucionMensual.length === 0 ? (
              <Empty description="Sin datos de evolución mensual" />
            ) : (
              <Table
                dataSource={data.evolucionMensual}
                rowKey="mes"
                size="small"
                pagination={false}
                columns={[
                  {
                    title: 'Mes', dataIndex: 'mes', key: 'mes',
                    render: (v: string) => {
                      const [year, month] = v.split('-')
                      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
                      return `${meses[parseInt(month) - 1]} ${year}`
                    },
                  },
                  {
                    title: 'Gasto Total', dataIndex: 'gasto_total', key: 'gasto_total', align: 'right' as const,
                    render: (v: number) => formatMoney(v),
                  },
                  { title: 'Nº Compras', dataIndex: 'num_compras', key: 'num_compras', align: 'center' as const },
                ]}
              />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
