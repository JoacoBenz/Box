'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, Col, Row, Typography, Empty, Select, Progress, Table, Tag, Button, App } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as AreaTooltip,
} from 'recharts';
import {
  CheckOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types';
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types';
import { formatMoney } from './dashboard-shared';

const { Text } = Typography;

// ── Shared helpers ──

const DONUT_COLORS_STATIC = [
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
];

function formatMoneyShort(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatMoney(amount);
}

// ── Metric Card with big number + trend ──
function MetricCard({
  title,
  value,
  previousValue,
  subtitle,
  color,
}: {
  title: string;
  value: number | undefined | null;
  previousValue?: number | null;
  subtitle?: string;
  color: string;
}) {
  const { tokens } = useTheme();
  const count = useCountUp(value);
  const current = value ?? 0;
  const prev = previousValue ?? 0;
  const hasTrend = prev > 0 && current > 0;
  const pctChange = hasTrend ? Math.round(((current - prev) / prev) * 100) : null;

  return (
    <Card
      style={{ borderRadius: 16, border: `1px solid ${tokens.borderColor}` }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <Text
        type="secondary"
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {title}
      </Text>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.3, marginTop: 4 }}>
          {formatMoney(count)}
        </div>
        {pctChange !== null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: pctChange > 0 ? '#ef4444' : '#22c55e',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {pctChange > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(pctChange)}%
          </span>
        )}
      </div>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {subtitle}
        </Text>
      )}
    </Card>
  );
}

// ── Custom Donut Tooltip ──
function DonutTooltipContent({ active, payload }: any) {
  const { tokens } = useTheme();
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      style={{
        background: tokens.bgInput,
        border: `1px solid ${tokens.borderColor}`,
        borderRadius: 10,
        padding: '10px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary }}>
        {formatMoney(value)}
      </div>
    </div>
  );
}

// ── Custom Area Tooltip ──
function TrendTooltipContent({ active, payload, label }: any) {
  const { tokens } = useTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: tokens.bgInput,
        border: `1px solid ${tokens.borderColor}`,
        borderRadius: 10,
        padding: '10px 16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontSize: 12, color: tokens.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: tokens.textPrimary }}>
        {formatMoney(payload[0].value)}
      </div>
      {payload[0].payload.cantidad != null && (
        <div style={{ fontSize: 11, color: tokens.textMuted }}>
          {payload[0].payload.cantidad} compra{payload[0].payload.cantidad !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ── Mini Donut Tooltip ──
function MiniDonutTooltipContent({ active, payload }: any) {
  const { tokens } = useTheme();
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div
      style={{
        background: tokens.bgInput,
        border: `1px solid ${tokens.borderColor}`,
        borderRadius: 10,
        padding: '8px 14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontSize: 11, color: tokens.textSecondary, marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary }}>
        {formatMoney(value)}
      </div>
    </div>
  );
}

const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

const PIPELINE_STAGES: EstadoSolicitud[] = [
  'enviada',
  'validada',
  'aprobada',
  'en_compras',
  'pago_programado',
  'abonada',
];

// ── Main Component ──

interface DirectorDashboardProps {
  data: any;
  directorAreaId: number | null;
  onAreaChange: (value: number | null) => void;
  onRefresh?: () => void;
}

export default function DirectorDashboard({
  data,
  directorAreaId,
  onAreaChange,
  onRefresh,
}: DirectorDashboardProps) {
  const { tokens } = useTheme();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const DONUT_COLORS = [tokens.colorPrimary, tokens.colorSecondary, ...DONUT_COLORS_STATIC];

  const [approvingId, setApprovingId] = useState<number | null>(null);

  const gastoPorArea: { name: string; value: number; cantidad: number }[] = (
    data.gastoPorArea ?? []
  ).map((g: any) => ({ name: g.area, value: g.total, cantidad: g.cantidad }));

  const totalGasto = gastoPorArea.reduce((sum, g) => sum + g.value, 0);

  const tendencia: { mes: string; total: number; cantidad: number }[] = data.tendenciaMensual ?? [];

  const topProveedores: { name: string; value: number }[] = (data.topProveedores ?? []).map(
    (p: any) => ({ name: p.proveedor, value: p.total }),
  );

  const gastoPorMedio: { name: string; value: number }[] = (data.gastoPorMedioPago ?? []).map(
    (m: any) => ({ name: MEDIO_PAGO_LABELS[m.medioPago] ?? m.medioPago, value: m.total }),
  );

  const totalMedio = gastoPorMedio.reduce((sum, m) => sum + m.value, 0);

  const resumenPresupuesto: any[] = data.resumenPresupuesto ?? [];
  const pipelineData: { estado: string; cantidad: number }[] = data.pipeline ?? [];
  const topPendientes: any[] = data.topPendientes ?? [];
  const tiempoCiclo = data.tiempoCiclo ?? { totalDias: 0, aprobacionDias: 0, pagoDias: 0 };

  // Budget widget: sort by max usage %, show critical first
  const budgetSorted = [...resumenPresupuesto]
    .filter((r: any) => r.presupuestoMensual !== null || r.presupuestoAnual !== null)
    .sort((a: any, b: any) => {
      const maxA = Math.max(a.porcentajeMensual ?? 0, a.porcentajeAnual ?? 0);
      const maxB = Math.max(b.porcentajeMensual ?? 0, b.porcentajeAnual ?? 0);
      return maxB - maxA;
    });

  const handleApprove = useCallback(
    async (solicitud: any) => {
      setApprovingId(solicitud.id);
      try {
        const res = await fetch(`/api/solicitudes/${solicitud.id}/aprobar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updated_at: solicitud.updated_at }),
        });
        if (res.ok) {
          const result = await res.json();
          message.success(`Solicitud ${solicitud.numero} aprobada`);
          if (result.presupuestoAlerta) {
            const isExceeded = result.presupuestoAlerta.porcentaje >= 100;
            modal[isExceeded ? 'warning' : 'info']({
              title: isExceeded ? 'Presupuesto excedido' : 'Alerta de presupuesto',
              content: result.presupuestoAlerta.mensaje,
            });
          }
          onRefresh?.();
        } else {
          const err = await res.json().catch(() => null);
          modal.error({
            title: 'Error al aprobar',
            content: err?.error?.message || 'Error desconocido',
          });
        }
      } catch {
        modal.error({ title: 'Error', content: 'No se pudo conectar con el servidor' });
      } finally {
        setApprovingId(null);
      }
    },
    [message, modal, onRefresh],
  );

  function calcMonto(items: any[]) {
    return (items ?? []).reduce(
      (sum: number, it: any) =>
        sum + (it.precio_estimado ? Number(it.precio_estimado) * Number(it.cantidad) : 0),
      0,
    );
  }

  const areaFilterSelect = (
    <Select
      value={directorAreaId}
      onChange={onAreaChange}
      placeholder="Todas las areas"
      allowClear
      size="small"
      style={{ minWidth: 160 }}
      options={(data.areasDisponibles ?? []).map((a: any) => ({ value: a.id, label: a.nombre }))}
    />
  );

  // Pipeline total for percentage calc
  const pipelineTotal = pipelineData.reduce((s, p) => s + p.cantidad, 0);

  return (
    <>
      {/* ── KPI Row: 4 cards with trends ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <MetricCard
            title="Gasto del Ano"
            value={data.gastoAnual}
            previousValue={data.gastoAnualAnterior}
            subtitle="vs ano anterior"
            color={tokens.colorPrimary}
          />
        </Col>
        <Col xs={12} lg={6}>
          <MetricCard
            title="Gasto del Mes"
            value={data.gastoMensual}
            previousValue={data.gastoMesAnterior}
            subtitle="vs mes anterior"
            color="#22c55e"
          />
        </Col>
        <Col xs={12} lg={6}>
          <Card
            style={{ borderRadius: 16, border: `1px solid ${tokens.borderColor}` }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              Tiempo Promedio
            </Text>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
                marginTop: 4,
              }}
            >
              <ClockCircleOutlined style={{ fontSize: 18, color: tokens.colorPrimary }} />
              <span style={{ fontSize: 26, fontWeight: 800, color: tokens.colorPrimary }}>
                {tiempoCiclo.totalDias}
              </span>
              <span style={{ fontSize: 13, color: tokens.textSecondary, fontWeight: 500 }}>
                dias
              </span>
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
              {tiempoCiclo.aprobacionDias}d aprobacion + {tiempoCiclo.pagoDias}d pago
            </div>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card
            style={{ borderRadius: 16, border: `1px solid ${tokens.borderColor}` }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Text
              type="secondary"
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}
            >
              Pendientes
            </Text>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
              {data.pendientesAprobar ?? 0}
            </div>
            <div style={{ fontSize: 11, color: tokens.textMuted }}>
              {data.urgentesPendientesDir > 0 && (
                <Tag color="red" style={{ fontSize: 10, marginRight: 4 }}>
                  {data.urgentesPendientesDir} urgente{data.urgentesPendientesDir > 1 ? 's' : ''}
                </Tag>
              )}
              por aprobar
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Pipeline Widget ── */}
      {pipelineData.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Pipeline de Solicitudes
                </span>
              }
              extra={areaFilterSelect}
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '16px 24px' } }}
            >
              <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
                {PIPELINE_STAGES.map((stage, idx) => {
                  const match = pipelineData.find((p) => p.estado === stage);
                  const count = match?.cantidad ?? 0;
                  const estadoInfo = ESTADOS_SOLICITUD[stage];
                  const isLast = idx === PIPELINE_STAGES.length - 1;
                  return (
                    <div
                      key={stage}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '12px 8px',
                        position: 'relative',
                        borderRight: isLast ? 'none' : `1px dashed ${tokens.borderColor}`,
                      }}
                    >
                      <div style={{ fontSize: 28, fontWeight: 800, color: tokens.textPrimary }}>
                        {count}
                      </div>
                      <Tag
                        color={estadoInfo?.color ?? 'default'}
                        style={{ fontSize: 10, marginTop: 4 }}
                      >
                        {estadoInfo?.label ?? stage}
                      </Tag>
                      {pipelineTotal > 0 && (
                        <div style={{ fontSize: 10, color: tokens.textMuted, marginTop: 4 }}>
                          {Math.round((count / pipelineTotal) * 100)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Top Pending Approvals (inline) ── */}
      {topPendientes.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Pendientes de Aprobacion
                </span>
              }
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => router.push('/aprobaciones')}
                  icon={<RightOutlined />}
                  iconPosition="end"
                >
                  Ver todas
                </Button>
              }
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '8px 16px' } }}
            >
              {topPendientes.map((s: any) => {
                const u = URGENCIAS[s.urgencia as UrgenciaSolicitud];
                const monto = calcMonto(s.items_solicitud);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 8px',
                      borderBottom: `1px solid ${tokens.borderColor}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text
                          strong
                          style={{
                            fontSize: 13,
                            color: tokens.colorPrimary,
                            cursor: 'pointer',
                          }}
                          onClick={() => router.push(`/solicitudes/${s.id}`)}
                        >
                          {s.numero}
                        </Text>
                        {u && (
                          <Tag color={u.color} style={{ fontSize: 10, margin: 0 }}>
                            {u.label}
                          </Tag>
                        )}
                      </div>
                      <Text
                        style={{
                          fontSize: 13,
                          color: tokens.textPrimary,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.titulo}
                      </Text>
                      <Text style={{ fontSize: 11, color: tokens.textMuted }}>
                        {s.solicitante?.nombre} — {s.area?.nombre}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: tokens.textPrimary }}>
                        {monto > 0 ? formatMoney(monto) : '—'}
                      </div>
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      loading={approvingId === s.id}
                      onClick={() => handleApprove(s)}
                      style={{ borderRadius: 8, flexShrink: 0 }}
                    >
                      Aprobar
                    </Button>
                  </div>
                );
              })}
            </Card>
          </Col>
        </Row>
      )}

      {/* ── Charts Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Donut: Gasto por Area */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>Gasto por Area</span>
            }
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
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: tokens.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Total
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tokens.textPrimary }}>
                      {formatMoneyShort(totalGasto)}
                    </div>
                  </div>
                </div>
                {/* Legend */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px 16px',
                    justifyContent: 'center',
                    marginTop: 4,
                  }}
                >
                  {gastoPorArea.map((g, i) => (
                    <div
                      key={g.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: tokens.textSecondary,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: DONUT_COLORS[i % DONUT_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
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
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>Tendencia Mensual</span>
            }
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
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.borderSubtle} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 12, fill: tokens.textMuted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: tokens.textMuted }}
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
                    dot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: tokens.bgInput }}
                    activeDot={{ r: 6, fill: '#22c55e', strokeWidth: 2, stroke: tokens.bgInput }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Small cards row: Medio de Pago + Top Proveedores ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary, fontSize: 13 }}>
                Medio de Pago
              </span>
            }
            style={{ borderRadius: 16 }}
            styles={{ body: { padding: '8px 12px' } }}
          >
            {gastoPorMedio.length === 0 ? (
              <Empty
                description="Sin datos"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: '8px 0' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={gastoPorMedio}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {gastoPorMedio.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip content={<MiniDonutTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {gastoPorMedio.slice(0, 5).map((m, i) => (
                    <div
                      key={m.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: tokens.textSecondary,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: DONUT_COLORS[i % DONUT_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.name}
                      </span>
                      <span style={{ fontWeight: 600, color: tokens.textPrimary, flexShrink: 0 }}>
                        {formatMoneyShort(m.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary, fontSize: 13 }}>
                Top Proveedores
              </span>
            }
            style={{ borderRadius: 16 }}
            styles={{ body: { padding: '12px 16px' } }}
          >
            {topProveedores.length === 0 ? (
              <Empty
                description="Sin datos"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ margin: '8px 0' }}
              />
            ) : (
              <div>
                {topProveedores.slice(0, 5).map((p, i) => (
                  <div
                    key={p.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: tokens.textMuted,
                        fontWeight: 600,
                        width: 16,
                        textAlign: 'center',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: tokens.textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: tokens.colorSecondary,
                        flexShrink: 0,
                      }}
                    >
                      {formatMoneyShort(p.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Presupuesto por Area (sorted by urgency) ── */}
      {budgetSorted.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Presupuesto por Area
                </span>
              }
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '12px 24px' } }}
            >
              <Table
                rowKey="areaId"
                dataSource={budgetSorted}
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Area',
                    dataIndex: 'areaNombre',
                    key: 'areaNombre',
                    width: 180,
                  },
                  {
                    title: 'Presup. Mensual',
                    key: 'mensual',
                    width: 140,
                    render: (_, r: any) =>
                      r.presupuestoMensual !== null ? formatMoney(r.presupuestoMensual) : '—',
                  },
                  {
                    title: 'Gastado (mes)',
                    key: 'gastoMes',
                    width: 130,
                    render: (_, r: any) => formatMoney(r.gastoMensual),
                  },
                  {
                    title: 'Uso Mensual',
                    key: 'pctMensual',
                    width: 180,
                    render: (_, r: any) => {
                      if (r.presupuestoMensual === null) return <Tag>Sin presupuesto</Tag>;
                      const pct = r.porcentajeMensual;
                      const color = pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
                      return (
                        <Progress
                          percent={Math.min(pct, 100)}
                          size="small"
                          strokeColor={color}
                          format={() => `${pct}%`}
                        />
                      );
                    },
                  },
                  {
                    title: 'Presup. Anual',
                    key: 'anual',
                    width: 140,
                    render: (_, r: any) =>
                      r.presupuestoAnual !== null ? formatMoney(r.presupuestoAnual) : '—',
                  },
                  {
                    title: 'Gastado (ano)',
                    key: 'gastoAnio',
                    width: 130,
                    render: (_, r: any) => formatMoney(r.gastoAnual),
                  },
                  {
                    title: 'Uso Anual',
                    key: 'pctAnual',
                    width: 180,
                    render: (_, r: any) => {
                      if (r.presupuestoAnual === null) return <Tag>Sin presupuesto</Tag>;
                      const pct = r.porcentajeAnual;
                      const color = pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
                      return (
                        <Progress
                          percent={Math.min(pct, 100)}
                          size="small"
                          strokeColor={color}
                          format={() => `${pct}%`}
                        />
                      );
                    },
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </>
  );
}
