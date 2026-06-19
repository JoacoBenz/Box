'use client';

import { Button, Card, Col, Row, Tag, Typography, Table } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';

import { useTheme } from '@/components/ThemeProvider';
import { BarChartRow } from './dashboard-shared';

const { Text } = Typography;

export default function PlatformAdminPanel({ data }: { data: Record<string, any> }) {
  const { tokens } = useTheme();
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Pending approvals banner */}
      {data.adminPlatform.orgPendientes > 0 && (
        <Card
          style={{
            borderRadius: 16,
            marginBottom: 16,
            background: tokens.adminBannerBg,
            border: `1px solid ${tokens.adminBannerBorder}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 15, color: tokens.adminBannerText }}>
              {data.adminPlatform.orgPendientes}{' '}
              {data.adminPlatform.orgPendientes !== 1
                ? 'organizaciones pendientes'
                : 'organización pendiente'}{' '}
              de aprobación
            </Text>
            <Link href="/gestion/aprobaciones-org">
              <Button
                type="primary"
                style={{
                  background: tokens.adminBannerBtn,
                  borderColor: tokens.adminBannerBtn,
                  fontWeight: 600,
                }}
              >
                Revisar Aprobaciones
              </Button>
            </Link>
          </div>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Orgs ranked by users */}
        {data.adminPlatform.orgsTopUso?.length > 0 && (
          <Col xs={24} lg={14}>
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Organizaciones por Uso
                </span>
              }
              style={{ borderRadius: 16 }}
              extra={
                <Link
                  href="/gestion/tenants"
                  style={{ color: tokens.colorPrimary, fontWeight: 600 }}
                >
                  Ver todas <ArrowRightOutlined />
                </Link>
              }
            >
              <Table
                dataSource={data.adminPlatform.orgsTopUso}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: 'Organización', dataIndex: 'org', ellipsis: true },
                  {
                    title: 'Usuarios',
                    dataIndex: 'usuarios',
                    width: 90,
                    align: 'center' as const,
                    render: (v: number) => (
                      <Tag color={v > 5 ? 'blue' : v > 0 ? 'cyan' : 'default'}>{v}</Tag>
                    ),
                  },
                  {
                    title: 'Último acceso',
                    dataIndex: 'ultimoAcceso',
                    width: 140,
                    render: (v: string | null) =>
                      v ? new Date(v).toLocaleDateString('es-AR') : '—',
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {/* Growth charts */}
        <Col xs={24} lg={10}>
          {data.adminPlatform.crecimientoOrgs?.length > 0 && (
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Crecimiento Orgs (6 meses)
                </span>
              }
              style={{ borderRadius: 16, marginBottom: 16 }}
              styles={{ body: { padding: '16px 24px' } }}
            >
              {data.adminPlatform.crecimientoOrgs.map((item: any, i: number) => (
                <BarChartRow
                  key={item.mes}
                  label={item.mes}
                  value={item.cantidad}
                  maxValue={Math.max(
                    ...data.adminPlatform.crecimientoOrgs.map((r: any) => r.cantidad),
                    1,
                  )}
                  color={tokens.chartPrimaryGradient}
                  subtext={`${item.cantidad} org${item.cantidad !== 1 ? 's' : ''}`}
                  index={i}
                  formatValue={(v) => String(v)}
                />
              ))}
            </Card>
          )}
          {data.adminPlatform.crecimientoUsuarios?.length > 0 && (
            <Card
              title={
                <span style={{ fontWeight: 700, color: tokens.textPrimary }}>
                  Crecimiento Usuarios (6 meses)
                </span>
              }
              style={{ borderRadius: 16 }}
              styles={{ body: { padding: '16px 24px' } }}
            >
              {data.adminPlatform.crecimientoUsuarios.map((item: any, i: number) => (
                <BarChartRow
                  key={item.mes}
                  label={item.mes}
                  value={item.cantidad}
                  maxValue={Math.max(
                    ...data.adminPlatform.crecimientoUsuarios.map((r: any) => r.cantidad),
                    1,
                  )}
                  color={tokens.chartSecondaryGradient}
                  subtext={`${item.cantidad} usuario${item.cantidad !== 1 ? 's' : ''}`}
                  index={i}
                  formatValue={(v) => String(v)}
                />
              ))}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
