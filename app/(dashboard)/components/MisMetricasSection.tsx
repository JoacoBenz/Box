'use client';

import { Col, Row } from 'antd';
import {
  DollarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  PercentageOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  AlertOutlined,
  GlobalOutlined,
  UserAddOutlined,
} from '@ant-design/icons';

import { MiniStatCard, SectionTitle, StatCard } from './dashboard-shared';

export default function MisMetricasSection({
  data,
  hasAnalytics,
  hasSolicitante,
  hasResponsable,
  hasDirector,
  hasCompras,
  hasTesoreria,
  hasAdmin,
  hasOrgAdmin,
}: {
  data: Record<string, any>;
  hasAnalytics: boolean;
  hasSolicitante: boolean;
  hasResponsable: boolean;
  hasDirector: boolean;
  hasCompras: boolean;
  hasTesoreria: boolean;
  hasAdmin: boolean;
  hasOrgAdmin: boolean;
}) {
  if (
    !(
      hasSolicitante ||
      hasResponsable ||
      hasCompras ||
      hasTesoreria ||
      hasAdmin ||
      (hasAnalytics && !hasDirector && !hasOrgAdmin)
    )
  )
    return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <SectionTitle>Mis Métricas</SectionTitle>
      <Row gutter={[16, 16]}>
        {/* === Gasto Año / Mes (shared by analytics roles, director/admin have their own) === */}
        {hasAnalytics && !hasDirector && !hasOrgAdmin && (
          <>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Gasto del Año"
                value={data.gastoAnual}
                icon={<DollarOutlined />}
                color="blue"
                format="money"
              />
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Gasto del Mes"
                value={data.gastoMensual}
                icon={<DollarOutlined />}
                color="green"
                format="money"
                delay={50}
              />
            </Col>
          </>
        )}

        {/* === SOLICITANTE metrics === */}
        {hasSolicitante && (
          <>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="En Ejecución"
                value={data.solicitudesEnEjecucion}
                icon={<ShoppingCartOutlined />}
                color="blue"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Este Mes"
                value={data.solicitudesMesSolicitante}
                icon={<FileTextOutlined />}
                color="purple"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Tasa Aprobación"
                value={data.tasaAprobacion}
                icon={<PercentageOutlined />}
                color="green"
                suffix="%"
              />
            </Col>
          </>
        )}

        {/* === RESPONSABLE metrics (hidden for director) === */}
        {hasResponsable && !hasDirector && (
          <>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Área: Este Mes"
                value={data.solicitudesAreaMes}
                icon={<FileTextOutlined />}
                color="blue"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Gasto Área (mes)"
                value={data.gastoAreaMes}
                icon={<DollarOutlined />}
                color="green"
                format="money"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Gasto Área (año)"
                value={data.gastoAreaAño}
                icon={<DollarOutlined />}
                color="blue"
                format="money"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Devueltas (área)"
                value={data.devueltasArea}
                icon={<ExclamationCircleOutlined />}
                color={data.devueltasArea > 0 ? 'orange' : 'green'}
              />
            </Col>
          </>
        )}

        {/* === DIRECTOR metrics are rendered below via DirectorDashboard === */}

        {/* === COMPRAS metrics === */}
        {hasCompras && (
          <>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Aprobadas"
                value={data.solicitudesAprobadas ?? 0}
                icon={<CheckCircleOutlined />}
                color="green"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="En Compras"
                value={data.solicitudesEnCompras ?? 0}
                icon={<ShoppingCartOutlined />}
                color="blue"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Pago Programado"
                value={data.pagoProgramado}
                icon={<ClockCircleOutlined />}
                color="purple"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Tiempo Prom. Pipeline"
                value={data.tiempoPromedioPipeline}
                icon={<FieldTimeOutlined />}
                color="cyan"
                suffix=" días"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Urgentes Pipeline"
                value={data.urgentesPipeline}
                icon={<ThunderboltOutlined />}
                color={data.urgentesPipeline > 0 ? 'red' : 'green'}
              />
            </Col>
          </>
        )}

        {/* === TESORERÍA metrics === */}
        {hasTesoreria && (
          <>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Recepciones c/obs"
                value={data.recepcionesConObs}
                icon={<WarningOutlined />}
                color={data.recepcionesConObs > 0 ? 'orange' : 'green'}
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Pagos Próximos (7d)"
                value={data.pagoProgramadoProximo}
                icon={<ClockCircleOutlined />}
                color="orange"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Sin Recepción"
                value={data.comprasSinRecepcion}
                icon={<InboxOutlined />}
                color={data.comprasSinRecepcion > 0 ? 'red' : 'green'}
              />
            </Col>
          </>
        )}

        {/* === ADMIN platform metrics (6 key metrics, single row) === */}
        {hasAdmin && (
          <>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Orgs Activas"
                value={data.adminPlatform.orgActivas}
                icon={<GlobalOutlined />}
                color="green"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Pendientes Aprob."
                value={data.adminPlatform.orgPendientes}
                icon={<ClockCircleOutlined />}
                color={data.adminPlatform.orgPendientes > 0 ? 'orange' : 'green'}
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Orgs Dormidas (30d)"
                value={data.adminPlatform.orgsDormidas}
                icon={<AlertOutlined />}
                color={data.adminPlatform.orgsDormidas > 0 ? 'orange' : 'green'}
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Usuarios Plataforma"
                value={data.adminPlatform.totalUsuariosPlataforma}
                icon={<TeamOutlined />}
                color="cyan"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Nuevos Usuarios (mes)"
                value={data.adminPlatform.usuariosNuevosMes}
                icon={<UserAddOutlined />}
                color="blue"
              />
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <MiniStatCard
                title="Prom. Usuarios/Org"
                value={data.adminPlatform.promedioUsuariosPorOrg}
                icon={<TeamOutlined />}
                color="purple"
              />
            </Col>
          </>
        )}
      </Row>
    </div>
  );
}
