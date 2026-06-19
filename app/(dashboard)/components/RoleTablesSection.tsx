'use client';

import { Card, Empty, Table, Tag, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';

import { useTheme } from '@/components/ThemeProvider';
import { ESTADO_COLOR, ESTADO_LABEL, URGENCIA_COLOR, urgenciaLabel } from '@/lib/constants';
import { EstadoTags, formatMoney, MEDIO_PAGO_LABEL } from './dashboard-shared';

const { Text } = Typography;

export default function RoleTablesSection({
  data,
  hasSolicitante,
  hasResponsable,
  hasDirector,
  hasCompras,
  hasTesoreria,
}: {
  data: Record<string, any>;
  hasSolicitante: boolean;
  hasResponsable: boolean;
  hasDirector: boolean;
  hasCompras: boolean;
  hasTesoreria: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <>
      {/* Solicitante: Mis Solicitudes por Estado + Recientes */}
      {hasSolicitante && (
        <div style={{ marginBottom: 28 }}>
          {data.misSolicitudesPorEstado?.length > 0 && (
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Mis Solicitudes por Estado
                </span>
              }
              style={{ borderRadius: 16, marginBottom: 16 }}
              styles={{ body: { padding: '12px 20px' } }}
            >
              <EstadoTags data={data.misSolicitudesPorEstado} />
            </Card>
          )}
          <Card
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                Mis Solicitudes Recientes
              </span>
            }
            style={{ borderRadius: 16 }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            {data.misSolicitudes.length === 0 ? (
              <div className="empty-state">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ width: 48, height: 48, color: tokens.textMuted }}
                >
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
                  <Link
                    key={sol.id}
                    href={`/solicitudes/${sol.id}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div
                      className={`solicitud-card urgencia-${sol.urgencia}`}
                      style={{ animation: `staggerIn 0.3s ease-out ${i * 60}ms both` }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            marginBottom: 4,
                          }}
                        >
                          <Text
                            style={{ fontSize: 13, color: tokens.colorPrimary, fontWeight: 600 }}
                          >
                            {sol.numero}
                          </Text>
                          <Tag color={ESTADO_COLOR[sol.estado]} style={{ margin: 0 }}>
                            {ESTADO_LABEL[sol.estado] ?? sol.estado}
                          </Tag>
                        </div>
                        <Text style={{ fontWeight: 500, color: tokens.textPrimary }}>
                          {sol.titulo}
                        </Text>
                      </div>
                      <ArrowRightOutlined style={{ color: tokens.textMuted, fontSize: 14 }} />
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
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Solicitudes del Área por Estado
                </span>
              }
              style={{ borderRadius: 16, marginBottom: 16 }}
              styles={{ body: { padding: '12px 20px' } }}
            >
              <EstadoTags data={data.solicitudesAreaPorEstado} />
            </Card>
          )}
          <Card
            title={
              <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                Solicitudes del Área
              </span>
            }
            style={{ borderRadius: 16 }}
          >
            {data.solicitudesArea.length === 0 ? (
              <Empty
                description="Sin solicitudes en el área"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                dataSource={data.solicitudesArea}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: 'Número',
                    dataIndex: 'numero',
                    render: (v: string, r: any) => (
                      <Link
                        href={`/solicitudes/${r.id}`}
                        style={{ color: tokens.colorPrimary, fontWeight: 600 }}
                      >
                        {v}
                      </Link>
                    ),
                  },
                  { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                  {
                    title: 'Estado',
                    dataIndex: 'estado',
                    render: (v: string) => (
                      <Tag color={ESTADO_COLOR[v]}>{ESTADO_LABEL[v] ?? v}</Tag>
                    ),
                  },
                  {
                    title: 'Urgencia',
                    dataIndex: 'urgencia',
                    render: (v: string) => <Tag color={URGENCIA_COLOR[v]}>{urgenciaLabel(v)}</Tag>,
                  },
                ]}
              />
            )}
          </Card>
        </div>
      )}

      {/* Compras: Pipeline */}
      {hasCompras && (
        <Card
          title={
            <span style={{ fontWeight: 700, color: tokens.textPrimary }}>Pipeline de Compras</span>
          }
          style={{ borderRadius: 16, marginBottom: 28 }}
          extra={
            <Link href="/gestion-compras" style={{ color: tokens.colorPrimary, fontWeight: 600 }}>
              Ver todo <ArrowRightOutlined />
            </Link>
          }
        >
          {data.pipeline?.length > 0 ? (
            <Table
              dataSource={data.pipeline}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'N°',
                  dataIndex: 'numero',
                  width: 120,
                  render: (v: string, r: any) => (
                    <Link
                      href={`/solicitudes/${r.id}`}
                      style={{ color: tokens.colorPrimary, fontWeight: 600 }}
                    >
                      {v}
                    </Link>
                  ),
                },
                { title: 'Título', dataIndex: 'titulo', ellipsis: true },
                {
                  title: 'Estado',
                  dataIndex: 'estado',
                  width: 140,
                  render: (v: string) => (
                    <Tag color={ESTADO_COLOR[v] ?? 'default'}>{ESTADO_LABEL[v] ?? v}</Tag>
                  ),
                },
                {
                  title: 'Pago',
                  dataIndex: 'dia_pago_programado',
                  width: 110,
                  render: (v: string | null) => (v ? new Date(v).toLocaleDateString('es-AR') : '—'),
                },
              ]}
            />
          ) : (
            <Empty
              description="Sin solicitudes en el pipeline"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>
      )}

      {/* Tesorería: Recent purchases */}
      {hasTesoreria && data.ultimasCompras?.length > 0 && (
        <Card
          title={
            <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
              Últimas Compras Registradas
            </span>
          }
          style={{ borderRadius: 16, marginBottom: 28 }}
        >
          <Table
            dataSource={data.ultimasCompras}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Solicitud',
                dataIndex: ['solicitud', 'numero'],
                render: (v: string, r: any) => (
                  <Link
                    href={`/solicitudes/${r.solicitud_id}`}
                    style={{ color: tokens.colorPrimary, fontWeight: 600 }}
                  >
                    {v}
                  </Link>
                ),
              },
              { title: 'Proveedor', dataIndex: 'proveedor_nombre', ellipsis: true },
              {
                title: 'Monto',
                dataIndex: 'monto_total',
                align: 'right' as const,
                render: (v: any) => <Text strong>{formatMoney(Number(v))}</Text>,
              },
              {
                title: 'Medio',
                dataIndex: 'medio_pago',
                render: (v: string) => MEDIO_PAGO_LABEL[v] ?? v,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}
