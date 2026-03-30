'use client'

import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Typography, Spin, Empty, Progress, Space } from 'antd'
import {
  DollarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ApartmentOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import Link from 'next/link'

const { Title, Text } = Typography

const ESTADO_COLOR: Record<string, string> = {
  borrador: 'default',
  enviada: 'processing',
  devuelta_resp: 'warning',
  devuelta_dir: 'warning',
  validada: 'cyan',
  aprobada: 'green',
  rechazada: 'red',
  comprada: 'purple',
  recibida: 'lime',
  recibida_con_obs: 'orange',
  cerrada: 'default',
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  devuelta_resp: 'Devuelta (Resp.)',
  devuelta_dir: 'Devuelta (Dir.)',
  validada: 'Validada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  comprada: 'Comprada',
  recibida: 'Recibida',
  recibida_con_obs: 'Recibida c/obs',
  cerrada: 'Cerrada',
}

const URGENCIA_COLOR: Record<string, string> = {
  baja: 'green',
  normal: 'blue',
  alta: 'orange',
  critica: 'red',
}

const MEDIO_PAGO_LABEL: Record<string, string> = {
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (!data) return <Empty description="Error al cargar el dashboard" />

  const hasAnalytics = data.gastoPorArea !== undefined
  const hasSolicitante = data.misSolicitudes !== undefined
  const hasResponsable = data.pendientesValidar !== undefined
  const hasDirector = data.pendientesAprobar !== undefined
  const hasTesoreria = data.pendientesComprar !== undefined
  const hasAdmin = data.totalUsuarios !== undefined

  const maxAreaTotal = Math.max(...(data.gastoPorArea ?? []).map((a: any) => a.total), 1)
  const maxProvTotal = Math.max(...(data.topProveedores ?? []).map((p: any) => p.total), 1)
  const maxMesTrend = Math.max(...(data.tendenciaMensual ?? []).map((m: any) => m.total), 1)

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.3px' }}>Dashboard</Title>

      {/* ── Analytics Cards (director/tesoreria/admin) ── */}
      {hasAnalytics && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Gasto del Año"
                  value={data.gastoAnual}
                  prefix={<DollarOutlined />}
                  formatter={(v) => formatMoney(Number(v))}
                  styles={{ content: { color: '#1677ff' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Gasto del Mes"
                  value={data.gastoMensual}
                  prefix={<DollarOutlined />}
                  formatter={(v) => formatMoney(Number(v))}
                  styles={{ content: { color: '#52c41a' } }}
                />
              </Card>
            </Col>
            {hasDirector && (
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Pendientes de Aprobar"
                    value={data.pendientesAprobar}
                    prefix={<ClockCircleOutlined />}
                    styles={{ content: { color: data.pendientesAprobar > 0 ? '#faad14' : '#52c41a' } }}
                  />
                </Card>
              </Col>
            )}
            {hasTesoreria && (
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="Pendientes de Compra"
                    value={data.pendientesComprar}
                    prefix={<ShoppingCartOutlined />}
                    styles={{ content: { color: data.pendientesComprar > 0 ? '#faad14' : '#52c41a' } }}
                  />
                </Card>
              </Col>
            )}
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {hasDirector && (
              <>
                <Col xs={12} sm={8} lg={4}>
                  <Card size="small">
                    <Statistic title="Aprobadas (semana)" value={data.aprobadasSemana} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a', fontSize: 20 } }} />
                  </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <Card size="small">
                    <Statistic title="Rechazadas (semana)" value={data.rechazadasSemana} prefix={<CloseCircleOutlined />} styles={{ content: { color: '#ff4d4f', fontSize: 20 } }} />
                  </Card>
                </Col>
              </>
            )}
            {hasTesoreria && (
              <Col xs={12} sm={8} lg={4}>
                <Card size="small">
                  <Statistic title="Recepciones c/obs" value={data.recepcionesConObs} prefix={<WarningOutlined />} styles={{ content: { color: data.recepcionesConObs > 0 ? '#fa8c16' : '#52c41a', fontSize: 20 } }} />
                </Card>
              </Col>
            )}
            {hasAdmin && (
              <>
                <Col xs={12} sm={8} lg={4}>
                  <Card size="small">
                    <Statistic title="Usuarios activos" value={data.totalUsuarios} prefix={<TeamOutlined />} styles={{ content: { fontSize: 20 } }} />
                  </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <Card size="small">
                    <Statistic title="Áreas activas" value={data.totalAreas} prefix={<ApartmentOutlined />} styles={{ content: { fontSize: 20 } }} />
                  </Card>
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <Card size="small">
                    <Statistic title="Solicitudes (mes)" value={data.solicitudesMes} prefix={<FileTextOutlined />} styles={{ content: { fontSize: 20 } }} />
                  </Card>
                </Col>
              </>
            )}
          </Row>

          {/* ── Spending by Area + Monthly Trend ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="Gasto por Área" size="small">
                {data.gastoPorArea.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.gastoPorArea.map((item: any) => (
                      <div key={item.area} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text>{item.area}</Text>
                          <Text strong>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxAreaTotal) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor="#1677ff"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Tendencia Mensual (6 meses)" size="small">
                {data.tendenciaMensual.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.tendenciaMensual.map((item: any) => (
                      <div key={item.mes} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text>{item.mes}</Text>
                          <Text strong>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxMesTrend) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor="#52c41a"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Payment Methods + Top Providers ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="Gasto por Medio de Pago" size="small">
                {data.gastoPorMedioPago.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <Table
                    dataSource={data.gastoPorMedioPago}
                    rowKey="medioPago"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Medio', dataIndex: 'medioPago', render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v },
                      { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => formatMoney(v) },
                      { title: 'Compras', dataIndex: 'cantidad', align: 'center' as const },
                    ]}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Top 5 Proveedores" size="small">
                {data.topProveedores.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.topProveedores.map((item: any, idx: number) => (
                      <div key={item.proveedor} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text><Text strong style={{ marginRight: 8 }}>#{idx + 1}</Text>{item.proveedor}</Text>
                          <Text strong>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxProvTotal) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor="#722ed1"
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Pipeline: Requests by Status + Urgency ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title="Solicitudes por Estado" size="small">
                {data.solicitudesPorEstado.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <Space wrap style={{ padding: '8px 0' }}>
                    {data.solicitudesPorEstado.map((item: any) => (
                      <Tag key={item.estado} color={ESTADO_COLOR[item.estado] ?? 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                        {ESTADO_LABEL[item.estado] ?? item.estado}: <strong>{item.cantidad}</strong>
                      </Tag>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Solicitudes por Urgencia (año)" size="small">
                {data.solicitudesPorUrgencia.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <Space wrap style={{ padding: '8px 0' }}>
                    {data.solicitudesPorUrgencia.map((item: any) => (
                      <Tag key={item.urgencia} color={URGENCIA_COLOR[item.urgencia] ?? 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
                        {item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1)}: <strong>{item.cantidad}</strong>
                      </Tag>
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── Solicitante: My recent requests ── */}
      {hasSolicitante && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {data.recepcionesPendientes > 0 && (
            <Col xs={24} sm={8} lg={6}>
              <Card>
                <Statistic title="Recepciones pendientes" value={data.recepcionesPendientes} prefix={<WarningOutlined />} styles={{ content: { color: '#fa8c16' } }} />
              </Card>
            </Col>
          )}
          <Col xs={24}>
            <Card title="Mis Solicitudes Recientes" size="small">
              {data.misSolicitudes.length === 0 ? <Empty description="No tenés solicitudes activas" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <Table
                  dataSource={data.misSolicitudes}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Número', dataIndex: 'numero', render: (v: string, r: any) => <Link href={`/solicitudes/${r.id}`}>{v}</Link> },
                    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                    { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag> },
                    { title: 'Urgencia', dataIndex: 'urgencia', render: (v: string) => <Tag color={URGENCIA_COLOR[v]}>{v}</Tag> },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Responsable: Area requests ── */}
      {hasResponsable && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8} lg={6}>
            <Card>
              <Statistic title="Pendientes de Validar" value={data.pendientesValidar} prefix={<ClockCircleOutlined />} styles={{ content: { color: data.pendientesValidar > 0 ? '#faad14' : '#52c41a' } }} />
            </Card>
          </Col>
          <Col xs={24}>
            <Card title="Solicitudes del Área" size="small">
              {data.solicitudesArea.length === 0 ? <Empty description="Sin solicitudes en el área" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                <Table
                  dataSource={data.solicitudesArea}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: 'Número', dataIndex: 'numero', render: (v: string, r: any) => <Link href={`/solicitudes/${r.id}`}>{v}</Link> },
                    { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                    { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag> },
                    { title: 'Urgencia', dataIndex: 'urgencia', render: (v: string) => <Tag color={URGENCIA_COLOR[v]}>{v}</Tag> },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Tesorería: Recent purchases ── */}
      {hasTesoreria && data.ultimasCompras?.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24}>
            <Card title="Últimas Compras Registradas" size="small">
              <Table
                dataSource={data.ultimasCompras}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: 'Solicitud', dataIndex: ['solicitud', 'numero'], render: (v: string, r: any) => <Link href={`/solicitudes/${r.solicitud_id}`}>{v}</Link> },
                  { title: 'Proveedor', dataIndex: 'proveedor_nombre', ellipsis: true },
                  { title: 'Monto', dataIndex: 'monto_total', align: 'right' as const, render: (v: any) => formatMoney(Number(v)) },
                  { title: 'Medio', dataIndex: 'medio_pago', render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
