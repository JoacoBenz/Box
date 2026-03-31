'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button, Card, Col, Row, Tag, Typography, Empty, Progress, Table } from 'antd'
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
  ExclamationCircleOutlined,
  InboxOutlined,
  PercentageOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  AlertOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import DirectorDashboard from './components/DirectorDashboard'

const { Title, Text } = Typography

const ESTADO_COLOR: Record<string, string> = {
  borrador: 'default',
  enviada: 'processing',
  devuelta_resp: 'warning',
  devuelta_dir: 'warning',
  validada: 'cyan',
  aprobada: 'green',
  en_compras: 'processing',
  pago_programado: 'purple',
  rechazada: 'red',
  comprada: 'purple',
  recibida: 'lime',
  recibida_con_obs: 'orange',
  cerrada: 'default',
  anulada: 'default',
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  devuelta_resp: 'Devuelta (Resp.)',
  devuelta_dir: 'Devuelta (Aprob.)',
  validada: 'Validada',
  aprobada: 'Aprobada',
  en_compras: 'En Compras',
  pago_programado: 'Pago Programado',
  rechazada: 'Rechazada',
  comprada: 'Comprada',
  recibida: 'Recibida',
  recibida_con_obs: 'Recibida c/obs',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
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
function useCountUp(rawTarget: number | undefined | null, duration = 800) {
  const target = rawTarget ?? 0
  const [value, setValue] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) ref.current = requestAnimationFrame(tick)
    }
    ref.current = requestAnimationFrame(tick)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [target, duration])

  return value
}

// ── Stat Card Component ──
function StatCard({ title, value, icon, color, format, suffix, delay = 0 }: {
  title: string; value: number | undefined | null; icon: React.ReactNode; color: string; format?: 'money' | 'percent'; suffix?: string; delay?: number
}) {
  const count = useCountUp(value)
  return (
    <Card className={`glass-card glass-${color}`} style={{ animationDelay: `${delay}ms` }} styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className={`stat-icon icon-${color}`}>{icon}</div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{title}</Text>
          <div className="count-up" style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {format === 'money' ? formatMoney(count) : format === 'percent' ? `${count}%` : count}{suffix ?? ''}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Mini Stat Card ──
function MiniStatCard({ title, value, icon, color, format, suffix }: {
  title: string; value: number | undefined | null; icon: React.ReactNode; color: string; format?: 'money' | 'percent'; suffix?: string
}) {
  const count = useCountUp(value)
  return (
    <Card className={`glass-card glass-${color}`} size="small" styles={{ body: { padding: '14px 18px' } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className={`stat-icon icon-${color}`} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 14 }}>{icon}</div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</Text>
          <div className="count-up" style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
            {format === 'money' ? formatMoney(count) : format === 'percent' ? `${count}%` : count}{suffix ?? ''}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Pending Action Card ──
function PendingActionCard({ count, label, href, buttonText }: {
  count: number; label: string; href: string; buttonText: string
}) {
  return (
    <Card style={{ borderRadius: 16, borderColor: count > 0 ? '#ff7a45' : '#22c55e', borderWidth: 2 }} styles={{ body: { padding: '20px' } }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#1e293b' }}>{count}</div>
        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{label}</Text>
      </div>
      <Link href={href} style={{ textDecoration: 'none' }}>
        <Button block type="primary" size="large" style={{ fontWeight: 600 }}>{buttonText}</Button>
      </Link>
    </Card>
  )
}

// ── Section Title ──
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16, letterSpacing: '-0.5px' }}>{children}</div>
  )
}

// ── Estado Tags (mini chart) ──
function EstadoTags({ data }: { data: { estado: string; cantidad: number }[] }) {
  if (!data || data.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
      {data.map((item) => (
        <Tag key={item.estado} color={ESTADO_COLOR[item.estado] ?? 'default'} style={{ fontSize: 13, padding: '4px 14px', margin: 0 }}>
          {ESTADO_LABEL[item.estado] ?? item.estado}: <strong>{item.cantidad}</strong>
        </Tag>
      ))}
    </div>
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

// ── Bar chart row helper ──
function BarChartRow({ label, value, maxValue, color, subtext, index }: {
  label: string; value: number; maxValue: number; color: string; subtext: string; index: number
}) {
  return (
    <div style={{ padding: '12px 0', borderBottom: 'none', animation: `staggerIn 0.3s ease-out ${index * 80}ms both` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontWeight: 500 }}>{label}</Text>
        <Text strong style={{ color: '#1e293b' }}>{formatMoney(value)}</Text>
      </div>
      <Progress
        percent={maxValue > 0 ? Math.round((value / maxValue) * 100) : 0}
        showInfo={false}
        size="small"
        strokeColor={color}
      />
      <Text type="secondary" style={{ fontSize: 11 }}>{subtext}</Text>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [directorAreaId, setDirectorAreaId] = useState<number | null>(null)

  const fetchDashboard = useCallback((areaId?: number | null) => {
    const params = new URLSearchParams()
    if (areaId) params.set('directorAreaId', String(areaId))
    const url = `/api/dashboard${params.toString() ? `?${params}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  // Re-fetch when admin switches tenant
  useEffect(() => {
    const handler = () => {
      setLoading(true)
      setDirectorAreaId(null)
      fetchDashboard()
    }
    window.addEventListener('admin-tenant-change', handler)
    return () => window.removeEventListener('admin-tenant-change', handler)
  }, [fetchDashboard])

  const handleDirectorAreaChange = (value: number | null) => {
    setDirectorAreaId(value)
    fetchDashboard(value)
  }

  if (loading) return <DashboardSkeleton />
  if (!data) return <Empty description="Error al cargar el dashboard" />

  // Role detection
  const hasAnalytics = data.gastoPorArea !== undefined
  const hasSolicitante = data.misSolicitudes !== undefined
  const hasResponsable = data.pendientesValidar !== undefined
  const hasDirector = data.pendientesAprobar !== undefined
  const hasCompras = data.solicitudesAprobadas !== undefined || data.solicitudesEnCompras !== undefined
  const hasTesoreria = data.pendientesComprar !== undefined
  const hasAdmin = data.totalUsuarios !== undefined

  // Chart maxes
  const maxAreaTotal = Math.max(...(data.gastoPorArea ?? []).map((a: any) => a.total), 1)
  const maxProvTotal = Math.max(...(data.topProveedores ?? []).map((p: any) => p.total), 1)
  const maxMesTrend = Math.max(...(data.tendenciaMensual ?? []).map((m: any) => m.total), 1)

  // Determine which analytics charts to show per role
  const showGastoPorArea = (!hasDirector) && (hasTesoreria || hasAdmin)
  const showTendenciaMensual = hasAnalytics && !hasDirector
  const showGastoPorMedioPago = hasCompras || hasTesoreria || hasAdmin
  const showTopProveedores = hasCompras || hasTesoreria || hasAdmin
  const showSolicitudesPorEstado = (!hasDirector) && hasAdmin
  const showSolicitudesPorUrgencia = hasAdmin

  // Check if any pending actions exist
  const hasPendingActions = hasResponsable || hasDirector || hasCompras || hasTesoreria ||
    (hasSolicitante && ((data.solicitudesDevueltas ?? 0) > 0 || (data.recepcionesPendientes ?? 0) > 0))

  return (
    <div className="page-content">
      <Greeting />

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── 1. MIS ACCIONES PENDIENTES ─────────────────── */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasPendingActions && (
        <div style={{ marginBottom: 28 }}>
          <SectionTitle>Mis Acciones Pendientes</SectionTitle>
          <Row gutter={[16, 16]}>
            {hasSolicitante && (data.solicitudesDevueltas ?? 0) > 0 && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={data.solicitudesDevueltas}
                  label="Solicitudes Devueltas"
                  href="/solicitudes?estado=devuelta"
                  buttonText="Revisar Devueltas"
                />
              </Col>
            )}
            {hasSolicitante && (data.recepcionesPendientes ?? 0) > 0 && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={data.recepcionesPendientes}
                  label="Recepciones Pendientes"
                  href="/recepciones"
                  buttonText="Ir a Recepciones"
                />
              </Col>
            )}
            {hasResponsable && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={data.pendientesValidar}
                  label="Pendientes de Validar"
                  href="/validaciones"
                  buttonText="Ir a Validaciones"
                />
              </Col>
            )}
            {hasDirector && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={data.pendientesAprobar}
                  label="Pendientes de Aprobar"
                  href="/aprobaciones"
                  buttonText="Ir a Aprobaciones"
                />
              </Col>
            )}
            {hasCompras && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={(data.solicitudesAprobadas ?? 0) + (data.solicitudesEnCompras ?? 0)}
                  label="Pendientes en Compras"
                  href="/gestion-compras"
                  buttonText="Ir a Gestión Compras"
                />
              </Col>
            )}
            {hasTesoreria && (
              <Col xs={24} sm={12} lg={6}>
                <PendingActionCard
                  count={data.pendientesComprar}
                  label="Pendientes de Compra"
                  href="/compras"
                  buttonText="Ir a Compras"
                />
              </Col>
            )}
          </Row>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── 2. MIS MÉTRICAS ────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════ */}
      {(hasSolicitante || hasResponsable || hasCompras || hasTesoreria || hasAdmin || (hasAnalytics && !hasDirector)) && (
      <div style={{ marginBottom: 28 }}>
        <SectionTitle>Mis Métricas</SectionTitle>
        <Row gutter={[16, 16]}>
          {/* === Gasto Año / Mes (shared by analytics roles, director has its own) === */}
          {hasAnalytics && !hasDirector && (
            <>
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="Gasto del Año" value={data.gastoAnual} icon={<DollarOutlined />} color="blue" format="money" />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="Gasto del Mes" value={data.gastoMensual} icon={<DollarOutlined />} color="green" format="money" delay={50} />
              </Col>
            </>
          )}

          {/* === SOLICITANTE metrics === */}
          {hasSolicitante && (
            <>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="En Ejecución" value={data.solicitudesEnEjecucion} icon={<ShoppingCartOutlined />} color="blue" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Este Mes" value={data.solicitudesMesSolicitante} icon={<FileTextOutlined />} color="purple" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Monto Mes" value={data.montoSolicitadoMes} icon={<DollarOutlined />} color="cyan" format="money" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Tasa Aprobación" value={data.tasaAprobacion} icon={<PercentageOutlined />} color="green" suffix="%" />
              </Col>
            </>
          )}

          {/* === RESPONSABLE metrics (hidden for director) === */}
          {hasResponsable && !hasDirector && (
            <>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Área: Este Mes" value={data.solicitudesAreaMes} icon={<FileTextOutlined />} color="blue" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Gasto Área (mes)" value={data.gastoAreaMes} icon={<DollarOutlined />} color="green" format="money" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Gasto Área (año)" value={data.gastoAreaAño} icon={<DollarOutlined />} color="blue" format="money" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Devueltas (área)" value={data.devueltasArea} icon={<ExclamationCircleOutlined />} color={data.devueltasArea > 0 ? 'orange' : 'green'} />
              </Col>
            </>
          )}

          {/* === DIRECTOR metrics are rendered below via DirectorDashboard === */}

          {/* === COMPRAS metrics === */}
          {hasCompras && (
            <>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Aprobadas" value={data.solicitudesAprobadas ?? 0} icon={<CheckCircleOutlined />} color="green" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="En Compras" value={data.solicitudesEnCompras ?? 0} icon={<ShoppingCartOutlined />} color="blue" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Pago Programado" value={data.pagoProgramado} icon={<ClockCircleOutlined />} color="purple" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Tiempo Prom. Pipeline" value={data.tiempoPromedioPipeline} icon={<FieldTimeOutlined />} color="cyan" suffix=" días" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Urgentes Pipeline" value={data.urgentesPipeline} icon={<ThunderboltOutlined />} color={data.urgentesPipeline > 0 ? 'red' : 'green'} />
              </Col>
            </>
          )}

          {/* === TESORERÍA metrics === */}
          {hasTesoreria && (
            <>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Recepciones c/obs" value={data.recepcionesConObs} icon={<WarningOutlined />} color={data.recepcionesConObs > 0 ? 'orange' : 'green'} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Pagos Próximos (7d)" value={data.pagoProgramadoProximo} icon={<ClockCircleOutlined />} color="orange" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Monto Pagos Próx." value={data.montoPagosProximos} icon={<DollarOutlined />} color="orange" format="money" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Sin Recepción" value={data.comprasSinRecepcion} icon={<InboxOutlined />} color={data.comprasSinRecepcion > 0 ? 'red' : 'green'} />
              </Col>
            </>
          )}

          {/* === ADMIN metrics === */}
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
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Pendientes Total" value={data.solicitudesPendientesTotal} icon={<ClockCircleOutlined />} color="orange" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Tasa Rechazo (mes)" value={data.tasaRechazoMes} icon={<CloseCircleOutlined />} color={data.tasaRechazoMes > 20 ? 'red' : 'green'} suffix="%" />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Urgentes Abiertas" value={data.urgentesAbiertas} icon={<ThunderboltOutlined />} color={data.urgentesAbiertas > 0 ? 'red' : 'green'} />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <MiniStatCard title="Stale (>7d)" value={data.staleCount} icon={<AlertOutlined />} color={data.staleCount > 0 ? 'orange' : 'green'} />
              </Col>
            </>
          )}
        </Row>
      </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── 2.5 DIRECTOR DASHBOARD (charts + analytics) ── */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasDirector && (
        <DirectorDashboard
          data={data}
          directorAreaId={directorAreaId}
          onAreaChange={handleDirectorAreaChange}
        />
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── 3. ROLE-SPECIFIC TABLES ────────────────────── */}
      {/* ═══════════════════════════════════════════════════ */}

      {/* Solicitante: Mis Solicitudes por Estado + Recientes */}
      {hasSolicitante && (
        <div style={{ marginBottom: 28 }}>
          {data.misSolicitudesPorEstado?.length > 0 && (
            <Card
              title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Mis Solicitudes por Estado</span>}
              style={{ borderRadius: 16, marginBottom: 16 }}
              styles={{ body: { padding: '12px 20px' } }}
            >
              <EstadoTags data={data.misSolicitudesPorEstado} />
            </Card>
          )}
          <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Mis Solicitudes Recientes</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 20px' } }}>
            {data.misSolicitudes.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 48, height: 48, color: '#94a3b8' }}>
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

      {/* Responsable: Solicitudes del Área (hidden for director) */}
      {hasResponsable && !hasDirector && (
        <div style={{ marginBottom: 28 }}>
          {data.solicitudesAreaPorEstado?.length > 0 && (
            <Card
              title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Solicitudes del Área por Estado</span>}
              style={{ borderRadius: 16, marginBottom: 16 }}
              styles={{ body: { padding: '12px 20px' } }}
            >
              <EstadoTags data={data.solicitudesAreaPorEstado} />
            </Card>
          )}
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

      {/* Compras: Pipeline */}
      {hasCompras && (
        <Card
          title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Pipeline de Compras</span>}
          style={{ borderRadius: 16, marginBottom: 28 }}
          extra={<Link href="/gestion-compras" style={{ color: '#4f46e5', fontWeight: 600 }}>Ver todo <ArrowRightOutlined /></Link>}
        >
          {data.pipeline?.length > 0 ? (
            <Table
              dataSource={data.pipeline}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'N°', dataIndex: 'numero', width: 120, render: (v: string, r: any) => <Link href={`/solicitudes/${r.id}`} style={{ color: '#4f46e5', fontWeight: 600 }}>{v}</Link> },
                { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                { title: 'Estado', dataIndex: 'estado', width: 140, render: (v: string) => <Tag color={ESTADO_COLOR[v] ?? 'default'}>{ESTADO_LABEL[v] ?? v}</Tag> },
                { title: 'Pago', dataIndex: 'dia_pago_programado', width: 110, render: (v: string | null) => v ? new Date(v).toLocaleDateString('es-AR') : '—' },
                { title: 'Monto', dataIndex: 'monto_estimado_total', width: 120, align: 'right' as const, render: (v: any) => v != null ? formatMoney(Number(v)) : '—' },
              ]}
            />
          ) : (
            <Empty description="Sin solicitudes en el pipeline" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      )}

      {/* Tesorería: Recent purchases */}
      {hasTesoreria && data.ultimasCompras?.length > 0 && (
        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Últimas Compras Registradas</span>} style={{ borderRadius: 16, marginBottom: 28 }}>
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

      {/* ═══════════════════════════════════════════════════ */}
      {/* ── 4. ANALYTICS CHARTS (role-filtered) ────────── */}
      {/* ═══════════════════════════════════════════════════ */}
      {hasAnalytics && (
        <>
          {/* Row 1: Gasto por Área + Tendencia Mensual */}
          {(showGastoPorArea || showTendenciaMensual) && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {showGastoPorArea && (
                <Col xs={24} lg={12}>
                  <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Gasto por Área</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                    {data.gastoPorArea.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                      <div>
                        {data.gastoPorArea.map((item: any, i: number) => (
                          <BarChartRow
                            key={item.area}
                            label={item.area}
                            value={item.total}
                            maxValue={maxAreaTotal}
                            color="linear-gradient(90deg, #4f46e5, #7c3aed)"
                            subtext={`${item.cantidad} compra${item.cantidad !== 1 ? 's' : ''}`}
                            index={i}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              )}
              {showTendenciaMensual && (
                <Col xs={24} lg={12}>
                  <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Tendencia Mensual (6 meses)</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                    {data.tendenciaMensual.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                      <div>
                        {data.tendenciaMensual.map((item: any, i: number) => (
                          <BarChartRow
                            key={item.mes}
                            label={item.mes}
                            value={item.total}
                            maxValue={maxMesTrend}
                            color="linear-gradient(90deg, #22c55e, #16a34a)"
                            subtext={`${item.cantidad} compra${item.cantidad !== 1 ? 's' : ''}`}
                            index={i}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              )}
            </Row>
          )}

          {/* Row 2: Gasto por Medio de Pago + Top Proveedores */}
          {(showGastoPorMedioPago || showTopProveedores) && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {showGastoPorMedioPago && (
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
              )}
              {showTopProveedores && (
                <Col xs={24} lg={12}>
                  <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Top 5 Proveedores</span>} style={{ borderRadius: 16 }} styles={{ body: { padding: '16px 24px' } }}>
                    {data.topProveedores.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                      <div>
                        {data.topProveedores.map((item: any, idx: number) => (
                          <div key={item.proveedor} style={{ padding: '12px 0', animation: `staggerIn 0.3s ease-out ${idx * 80}ms both` }}>
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
              )}
            </Row>
          )}

          {/* Row 3: Solicitudes por Estado + Urgencia */}
          {(showSolicitudesPorEstado || showSolicitudesPorUrgencia) && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              {showSolicitudesPorEstado && (
                <Col xs={24} lg={showSolicitudesPorUrgencia ? 12 : 24}>
                  <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Solicitudes por Estado</span>} style={{ borderRadius: 16 }}>
                    {data.solicitudesPorEstado.length === 0 ? <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
                      <EstadoTags data={data.solicitudesPorEstado} />
                    )}
                  </Card>
                </Col>
              )}
              {showSolicitudesPorUrgencia && (
                <Col xs={24} lg={showSolicitudesPorEstado ? 12 : 24}>
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
              )}
            </Row>
          )}
        </>
      )}
    </div>
  )
}
