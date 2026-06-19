'use client';

import { Card, Col, Row, Tag } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  ApartmentOutlined,
  BankOutlined,
  KeyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

import { MiniStatCard, SectionTitle } from './dashboard-shared';

export default function OrgAdminPanel({ data }: { data: Record<string, any> }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Panel de Administración</SectionTitle>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Usuarios"
            value={data.orgAdmin.usuariosActivos}
            icon={<TeamOutlined />}
            color="blue"
            suffix={` / ${data.orgAdmin.totalUsuarios}`}
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Áreas"
            value={data.orgAdmin.totalAreas}
            icon={<ApartmentOutlined />}
            color="green"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Centros Costo"
            value={data.orgAdmin.totalCentrosCosto}
            icon={<BankOutlined />}
            color="purple"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Invitaciones"
            value={data.orgAdmin.invitacionesActivas}
            icon={<KeyOutlined />}
            color="orange"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Solicitudes Activas"
            value={data.orgAdmin.solicitudesActivas}
            icon={<FileTextOutlined />}
            color="blue"
          />
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <MiniStatCard
            title="Áreas sin Resp."
            value={data.orgAdmin.totalAreas - data.orgAdmin.areasConResponsable}
            icon={<WarningOutlined />}
            color={
              data.orgAdmin.totalAreas - data.orgAdmin.areasConResponsable > 0 ? 'orange' : 'green'
            }
          />
        </Col>
      </Row>
      {data.orgAdmin.ultimasAuditorias?.length > 0 && (
        <Card
          title={<span style={{ fontWeight: 700 }}>Actividad Reciente</span>}
          extra={
            <Link href="/auditoria" style={{ fontSize: 13 }}>
              Ver todo
            </Link>
          }
          style={{ borderRadius: 16 }}
          styles={{ body: { padding: '8px 16px' } }}
        >
          {data.orgAdmin.ultimasAuditorias.map((a: any, i: number) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom:
                  i < data.orgAdmin.ultimasAuditorias.length - 1
                    ? '1px solid var(--border-color)'
                    : 'none',
                fontSize: 13,
              }}
            >
              <span>
                <strong>{a.usuario}</strong>{' '}
                <Tag style={{ fontSize: 11 }}>{a.accion.replace(/_/g, ' ')}</Tag>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {new Date(a.fecha).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
