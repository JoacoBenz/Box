'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, Col, Row, Typography, Empty, Select } from 'antd'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as AreaTooltip,
} from 'recharts'

const { Text } = Typography

// ── Shared helpers ──

const DONUT_COLORS = ['#4f46e5', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)
}

function formatMoneyShort(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return formatMoney(amount)
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

// ── Metric Card with big number ──
function MetricCard({ title, value, subtitle, color }: {
  title: string; value: number | undefined | null; subtitle?: string; color: string
}) {
  const count = useCountUp(value)
  return (
    <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }} styles={{ body: { padding: '20px 24px' } }}>
      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{title}</Text>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.3, marginTop: 4 }}>
        {formatMoney(count)}
      </div>
      {subtitle && <Text type="secondary" style={{ fontSize: 11 }}>{subtitle}</Text>}
    </Card>
  )
}

// ── Custom Donut Tooltip ──
function DonutTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{formatMoney(value)}</div>
    </div>
  )
}

// ── Custom Area Tooltip ──
function TrendTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{formatMoney(payload[0].value)}</div>
      {payload[0].payload.cantidad != null && (
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{payload[0].payload.cantidad} compra{payload[0].payload.cantidad !== 1 ? 's' : ''}</div>
      )}
    </div>
  )
}

// ── Mini Donut Tooltip ──
function MiniDonutTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{formatMoney(value)}</div>
    </div>
  )
}

const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque',
  tarjeta: 'Tarjeta', otro: 'Otro',
}

// ── Main Component ──

interface DirectorDashboardProps {
  data: any
  directorAreaId: number | null
  onAreaChange: (value: number | null) => void
}

export default function DirectorDashboard({ data, directorAreaId, onAreaChange }: DirectorDashboardProps) {
  const gastoPorArea: { name: string; value: number; cantidad: number }[] =
    (data.gastoPorArea ?? []).map((g: any) => ({ name: g.area, value: g.total, cantidad: g.cantidad }))

  const totalGasto = gastoPorArea.reduce((sum, g) => sum + g.value, 0)

  const tendencia: { mes: string; total: number; cantidad: number }[] = data.tendenciaMensual ?? []

  const topProveedores: { name: string; value: number }[] =
    (data.topProveedores ?? []).map((p: any) => ({ name: p.proveedor, value: p.total }))

  const gastoPorMedio: { name: string; value: number }[] =
    (data.gastoPorMedioPago ?? []).map((m: any) => ({ name: MEDIO_PAGO_LABELS[m.medioPago] ?? m.medioPago, value: m.total }))

  const totalMedio = gastoPorMedio.reduce((sum, m) => sum + m.value, 0)

  const areaFilterSelect = (
    <Select
      value={directorAreaId}
      onChange={onAreaChange}
      placeholder="Todas las áreas"
      allowClear
      size="small"
      style={{ minWidth: 160 }}
      options={(data.areasDisponibles ?? []).map((a: any) => ({ value: a.id, label: a.nombre }))}
    />
  )

  return (
    <>
      {/* ── KPI Row: 4 cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <MetricCard title="Gasto del Año" value={data.gastoAnual} color="#4f46e5" />
            <MetricCard title="Gasto del Mes" value={data.gastoMensual} color="#22c55e" />
          </div>
        </Col>
        <Col xs={12} lg={6}>
          <Card title={<span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>Medio de Pago</span>} style={{ borderRadius: 16, height: '100%' }} styles={{ body: { padding: '8px 12px' } }}>
            {gastoPorMedio.length === 0 ? (
              <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ResponsiveContainer width={90} height={90}>
                  <PieChart>
                    <Pie data={gastoPorMedio} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2} strokeWidth={0}>
                      {gastoPorMedio.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                    </Pie>
                    <ReTooltip content={<MiniDonutTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {gastoPorMedio.slice(0, 4).map((m, i) => (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569', marginBottom: 3 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                      <span style={{ fontWeight: 600, color: '#1e293b', flexShrink: 0 }}>{formatMoneyShort(m.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title={<span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>Top Proveedores</span>} style={{ borderRadius: 16, height: '100%' }} styles={{ body: { padding: '8px 12px' } }}>
            {topProveedores.length === 0 ? (
              <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '8px 0' }} />
            ) : (
              <div>
                {topProveedores.slice(0, 4).map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, width: 16, textAlign: 'center' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>{formatMoneyShort(p.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Charts Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Donut: Gasto por Área */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Gasto por Área</span>}
            extra={areaFilterSelect}
            style={{ borderRadius: 16 }}
            styles={{ body: { padding: '16px 24px' } }}
          >
            {gastoPorArea.length === 0 ? (
              <Empty description="Sin datos de gasto" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                <div style={{ position: 'relative' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={gastoPorArea}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {gastoPorArea.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip content={<DonutTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center', pointerEvents: 'none',
                  }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{formatMoneyShort(totalGasto)}</div>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 4 }}>
                  {gastoPorArea.map((g, i) => (
                    <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      {g.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>

        {/* Area Chart: Tendencia Mensual */}
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Tendencia Mensual</span>}
            style={{ borderRadius: 16 }}
            styles={{ body: { padding: '16px 24px' } }}
          >
            {tendencia.length === 0 ? (
              <Empty description="Sin datos de tendencia" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={tendencia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatMoneyShort(v)}
                    width={60}
                  />
                  <AreaTooltip content={<TrendTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    fill="url(#gradientGreen)"
                    dot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

    </>
  )
}
