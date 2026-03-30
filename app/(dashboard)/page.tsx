'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, Col, Row, Tag, Typography, Empty, Progress, Table } from 'antd'
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
  ArrowRightOutlined,
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
  urgente: 'orange',
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

// ── Count-up hook ──
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [target, duration])

  return value
}

// ── Stat Card Component ──
function StatCard({ title, value, icon, color, format, delay = 0 }: {
  title: string; value: number; icon: React.ReactNode; color: string; format?: 'money'; delay?: number
}) {
  const count = useCountUp(value)
  return (
    <Card className={`glass-card glass-${color}`} style={{ animationDelay: `${delay}ms` }} styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className={`stat-icon icon-${color}`}>{icon}</div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{title}</Text>
          <div className="count-up" style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {format === 'money' ? formatMoney(count) : count}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Mini Stat Card ──
function MiniStatCard({ title, value, icon, color }: {
  title: string; value: number; icon: React.ReactNode; color: string
}) {
  const count = useCountUp(value)
  return (
    <Card className={`glass-card glass-${color}`} size="small" styles={{ body: { padding: '14px 18px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className={`stat-icon icon-${color}`} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>{icon}</div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</Text>
          <div className="count-up" style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{count}</div>
        </div>
      </div>
    </Card>
  )
}

// ── Greeting ──
function Greeting() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>
        {greeting} 👋
      </div>
      <Text type="secondary" style={{ fontSize: 14, textTransform: 'capitalize' }}>{date}</Text>
    </div>
  )
}

// ── Loading Skeleton ──
function DashboardSkeleton() {
  return (
    <div className="page-content" style={{ padding: 4 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ width: 240, height: 32, background: '#e2e8f0', borderRadius: 8, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ width: 180, height: 16, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(i => (
          <Col key={i} xs={24} sm={12} lg={6}>
            <div style={{ height: 100, background: '#e2e8f0', borderRadius: 16, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 100}ms` }} />
          </Col>
        ))}
      </Row>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
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

  if (loading) return <DashboardSkeleton />
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
    <div className="page-content">
      <Greeting />

      {/* ── Analytics Cards (director/tesoreria/admin) ── */}
      {hasAnalytics && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Gasto del Año" value={data.gastoAnual} icon={<DollarOutlined />} color="blue" format="money" />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard title="Gasto del Mes" value={data.gastoMensual} icon={<DollarOutlined />} color="green" format="money" delay={50} />
            </Col>
            {hasDirector && (
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="Pendientes de Aprobar" value={data.pendientesAprobar} icon={<ClockCircleOutlined />} color={data.pendientesAprobar > 0 ? 'orange' : 'green'} delay={100} />
              </Col>
            )}
            {hasTesoreria && (
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="Pendientes de Compra" value={data.pendientesComprar} icon={<ShoppingCartOutlined />} color={data.pendientesComprar > 0 ? 'orange' : 'green'} delay={150} />
              </Col>
            )}
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {hasDirector && (
              <>
                <Col xs={12} sm={8} lg={4}>
                  <MiniStatCard title="Aprobadas (semana)" value={data.aprobadasSemana} icon={<CheckCircleOutlined />} color="green" />
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <MiniStatCard title="Rechazadas (semana)" value={data.rechazadasSemana} icon={<CloseCircleOutlined />} color="red" />
                </Col>
              </>
            )}
            {hasTesoreria && (
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Recepciones c/obs" value={data.recepcionesConObs} icon={<WarningOutlined />} color={data.recepcionesConObs > 0 ? 'orange' : 'green'} />
              </Col>
            )}
            {hasAdmin && (
              <>
                <Col xs={12} sm={8} lg={4}>
                  <MiniStatCard title="Usuarios activos" value={data.totalUsuarios} icon={<TeamOutlined />} color="cyan" />
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <MiniStatCard title="Áreas activas" value={data.totalAreas} icon={<ApartmentOutlined />} color="purple" />
                </Col>
                <Col xs={12} sm={8} lg={4}>
                  <MiniStatCard title="Solicitudes (mes)" value={data.solicitudesMes} icon={<FileTextOutlined />} color="blue" />
                </Col>
              </>
            )}
          </Row>

          {/* ── Spending by Area + Monthly Trend ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Gasto por Área</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                {data.gastoPorArea.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.gastoPorArea.map((item: any, i: number) => (
                      <div key={item.area} style={{ padding: '12px 0', borderBottom: i < data.gastoPorArea.length - 1 ? '1px solid #f1f5f9' : 'none', animation: `staggerIn 0.3s ease-out ${i * 80}ms both` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: 500 }}>{item.area}</Text>
                          <Text strong style={{ color: '#1e293b' }}>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxAreaTotal) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor={{ from: '#4f46e5', to: '#7c3aed' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Tendencia Mensual (6 meses)</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                {data.tendenciaMensual.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.tendenciaMensual.map((item: any, i: number) => (
                      <div key={item.mes} style={{ padding: '12px 0', borderBottom: i < data.tendenciaMensual.length - 1 ? '1px solid #f1f5f9' : 'none', animation: `staggerIn 0.3s ease-out ${i * 80}ms both` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontWeight: 500 }}>{item.mes}</Text>
                          <Text strong style={{ color: '#1e293b' }}>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxMesTrend) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor={{ from: '#22c55e', to: '#16a34a' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
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
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Gasto por Medio de Pago</span>} style={{ borderRadius: 16 }}>
                {data.gastoPorMedioPago.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <Table
                    dataSource={data.gastoPorMedioPago}
                    rowKey="medioPago"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Medio', dataIndex: 'medioPago', render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v },
                      { title: 'Total', dataIndex: 'total', align: 'right' as const, render: (v: number) => <Text strong>{formatMoney(v)}</Text> },
                      { title: 'Compras', dataIndex: 'cantidad', align: 'center' as const },
                    ]}
                  />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Top 5 Proveedores</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                {data.topProveedores.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div>
                    {data.topProveedores.map((item: any, idx: number) => (
                      <div key={item.proveedor} style={{ padding: '12px 0', borderBottom: idx < data.topProveedores.length - 1 ? '1px solid #f1f5f9' : 'none', animation: `staggerIn 0.3s ease-out ${idx * 80}ms both` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b', marginRight: 8 }}>{idx + 1}</span>
                            {item.proveedor}
                          </Text>
                          <Text strong style={{ color: '#1e293b' }}>{formatMoney(item.total)}</Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxProvTotal) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor={{ from: '#8b5cf6', to: '#a855f7' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>{item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}</Text>
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
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Solicitudes por Estado</span>} style={{ borderRadius: 16 }}>
                {data.solicitudesPorEstado.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
                    {data.solicitudesPorEstado.map((item: any) => (
                      <Tag key={item.estado} color={ESTADO_COLOR[item.estado] ?? 'default'} style={{ fontSize: 13, padding: '4px 14px', margin: 0 }}>
                        {ESTADO_LABEL[item.estado] ?? item.estado}: <strong>{item.cantidad}</strong>
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Solicitudes por Urgencia (año)</span>} style={{ borderRadius: 16 }}>
                {data.solicitudesPorUrgencia.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
                    {data.solicitudesPorUrgencia.map((item: any) => (
                      <Tag key={item.urgencia} color={URGENCIA_COLOR[item.urgencia] ?? 'default'} style={{ fontSize: 13, padding: '4px 14px', margin: 0 }}>
                        {item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1)}: <strong>{item.cantidad}</strong>
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── Solicitante: My recent requests as cards ── */}
      {hasSolicitante && (
        <div style={{ marginBottom: 24 }}>
          {data.recepcionesPendientes > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={8} lg={6}>
                <StatCard title="Recepciones pendientes" value={data.recepcionesPendientes} icon={<WarningOutlined />} color="orange" />
              </Col>
            </Row>
          )}
          <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Mis Solicitudes Recientes</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {data.misSolicitudes.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <Text type="secondary">No tenés solicitudes activas</Text>
              </div>
            ) : (
              <div>
                {data.misSolicitudes.map((sol: any, i: number) => (
                  <Link key={sol.id} href={`/solicitudes/${sol.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div
                      className={`solicitud-card urgencia-${sol.urgencia}`}
                      style={{ animation: `staggerIn 0.3s ease-out ${i * 60}ms both` }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>{sol.numero}</Text>
                          <Tag color={ESTADO_COLOR[sol.estado]} style={{ margin: 0 }}>{ESTADO_LABEL[sol.estado] ?? sol.estado}</Tag>
                        </div>
                        <Text style={{ fontWeight: 500, color: '#1e293b' }}>{sol.titulo}</Text>
                      </div>
                      <ArrowRightOutlined style={{ color: '#94a3b8', fontSize: 14 }} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Responsable: Area requests ── */}
      {hasResponsable && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} lg={6}>
              <StatCard title="Pendientes de Validar" value={data.pendientesValidar} icon={<ClockCircleOutlined />} color={data.pendientesValidar > 0 ? 'orange' : 'green'} />
            </Col>
          </Row>
          <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Solicitudes del Área</span>} style={{ borderRadius: 16 }}>
            {data.solicitudesArea.length === 0 ? <Empty description="Sin solicitudes en el área" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
              <Table
                dataSource={data.solicitudesArea}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: 'Número', dataIndex: 'numero', render: (v: string, r: any) => <Link href={`/solicitudes/${r.id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>{v}</Link> },
                  { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                  { title: 'Estado', dataIndex: 'estado', render: (v: string) => <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag> },
                  { title: 'Urgencia', dataIndex: 'urgencia', render: (v: string) => <Tag color={URGENCIA_COLOR[v]}>{v}</Tag> },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {/* ── Tesorería: Recent purchases ── */}
      {hasTesoreria && data.ultimasCompras?.length > 0 && (
        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Últimas Compras Registradas</span>} style={{ borderRadius: 16, marginBottom: 24 }}>
          <Table
            dataSource={data.ultimasCompras}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              { title: 'Solicitud', dataIndex: ['solicitud', 'numero'], render: (v: string, r: any) => <Link href={`/solicitudes/${r.solicitud_id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>{v}</Link> },
              { title: 'Proveedor', dataIndex: 'proveedor_nombre', ellipsis: true },
              { title: 'Monto', dataIndex: 'monto_total', align: 'right' as const, render: (v: any) => <Text strong>{formatMoney(Number(v))}</Text> },
              { title: 'Medio', dataIndex: 'medio_pago', render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
