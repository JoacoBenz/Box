'use client';

import { Card, Col, Empty, Progress, Row, Table, Tag, Typography } from 'antd';

import { useTheme } from '@/components/ThemeProvider';
import { URGENCIA_COLOR } from '@/lib/constants';
import { BarChartRow, EstadoTags, formatMoney, MEDIO_PAGO_LABEL } from './dashboard-shared';

const { Text } = Typography;

export default function AnalyticsChartsSection({
  data,
  hasAnalytics,
  hasDirector,
  hasOrgAdmin,
  hasCompras,
  hasTesoreria,
  hasAdmin,
  maxAreaTotal,
  maxProvTotal,
  maxMesTrend,
}: {
  data: Record<string, any>;
  hasAnalytics: boolean;
  hasDirector: boolean;
  hasOrgAdmin: boolean;
  hasCompras: boolean;
  hasTesoreria: boolean;
  hasAdmin: boolean;
  maxAreaTotal: number;
  maxProvTotal: number;
  maxMesTrend: number;
}) {
  const { tokens } = useTheme();

  // Determine which analytics charts to show per role
  const showGastoPorArea = !hasDirector && !hasOrgAdmin && hasTesoreria && !hasAdmin;
  const showTendenciaMensual = hasAnalytics && !hasDirector && !hasOrgAdmin && !hasAdmin;
  const showGastoPorMedioPago = hasCompras || (hasTesoreria && !hasAdmin && !hasOrgAdmin);
  const showTopProveedores = hasCompras || (hasTesoreria && !hasAdmin && !hasOrgAdmin);
  const showSolicitudesPorEstado = false; // now handled per-role in their own sections
  const showSolicitudesPorUrgencia = false;

  if (!hasAnalytics) return null;

  return (
    <>
      {/* Row 1: Gasto por Área + Tendencia Mensual */}
      {(showGastoPorArea || showTendenciaMensual) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {showGastoPorArea && (
            <Col xs={24} lg={12}>
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>Gasto por Área</span>
                }
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: '16px 24px' } }}
              >
                {data.gastoPorArea.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div>
                    {data.gastoPorArea.map((item: any, i: number) => (
                      <BarChartRow
                        key={item.area}
                        label={item.area}
                        value={item.total}
                        maxValue={maxAreaTotal}
                        color={tokens.chartPrimaryGradient}
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
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                    Tendencia Mensual (6 meses)
                  </span>
                }
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: '16px 24px' } }}
              >
                {data.tendenciaMensual.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div>
                    {data.tendenciaMensual.map((item: any, i: number) => (
                      <BarChartRow
                        key={item.mes}
                        label={item.mes}
                        value={item.total}
                        maxValue={maxMesTrend}
                        color={tokens.chartSecondaryGradient}
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
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                    Gasto por Medio de Pago
                  </span>
                }
                style={{ borderRadius: 16 }}
              >
                {data.gastoPorMedioPago.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Table
                    dataSource={data.gastoPorMedioPago}
                    rowKey="medioPago"
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: 'Medio',
                        dataIndex: 'medioPago',
                        render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v,
                      },
                      {
                        title: 'Total',
                        dataIndex: 'total',
                        align: 'right' as const,
                        render: (v: number) => <Text strong>{formatMoney(v)}</Text>,
                      },
                      { title: 'Compras', dataIndex: 'cantidad', align: 'center' as const },
                    ]}
                  />
                )}
              </Card>
            </Col>
          )}
          {showTopProveedores && (
            <Col xs={24} lg={12}>
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                    Top 5 Proveedores
                  </span>
                }
                style={{ borderRadius: 16 }}
                styles={{ body: { padding: '16px 24px' } }}
              >
                {data.topProveedores.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div>
                    {data.topProveedores.map((item: any, idx: number) => (
                      <div
                        key={item.proveedor}
                        style={{
                          padding: '12px 0',
                          animation: `staggerIn 0.3s ease-out ${idx * 80}ms both`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 6,
                          }}
                        >
                          <Text>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                background: tokens.rankBg,
                                fontSize: 11,
                                fontWeight: 700,
                                color: tokens.rankText,
                                marginRight: 8,
                              }}
                            >
                              {idx + 1}
                            </span>
                            {item.proveedor}
                          </Text>
                          <Text strong style={{ color: tokens.textPrimary }}>
                            {formatMoney(item.total)}
                          </Text>
                        </div>
                        <Progress
                          percent={Math.round((item.total / maxProvTotal) * 100)}
                          showInfo={false}
                          size="small"
                          strokeColor={{
                            from: tokens.progressStrokeFrom,
                            to: tokens.progressStrokeTo,
                          }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.cantidad} compra{item.cantidad !== 1 ? 's' : ''}
                        </Text>
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
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                    Solicitudes por Estado
                  </span>
                }
                style={{ borderRadius: 16 }}
              >
                {data.solicitudesPorEstado.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <EstadoTags data={data.solicitudesPorEstado} />
                )}
              </Card>
            </Col>
          )}
          {showSolicitudesPorUrgencia && (
            <Col xs={24} lg={showSolicitudesPorEstado ? 12 : 24}>
              <Card
                title={
                  <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                    Solicitudes por Urgencia (año)
                  </span>
                }
                style={{ borderRadius: 16 }}
              >
                {data.solicitudesPorUrgencia.length === 0 ? (
                  <Empty description="Sin datos" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 0' }}>
                    {data.solicitudesPorUrgencia.map((item: any) => (
                      <Tag
                        key={item.urgencia}
                        color={URGENCIA_COLOR[item.urgencia] ?? 'default'}
                        style={{ fontSize: 13, padding: '4px 14px', margin: 0 }}
                      >
                        {item.urgencia.charAt(0).toUpperCase() + item.urgencia.slice(1)}:{' '}
                        <strong>{item.cantidad}</strong>
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
  );
}
