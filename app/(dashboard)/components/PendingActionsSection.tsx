'use client';

import { Col, Row } from 'antd';

import { PendingActionCard, SectionTitle } from './dashboard-shared';

export default function PendingActionsSection({
  data,
  hasSolicitante,
  hasResponsable,
  hasCompras,
  hasTesoreria,
}: {
  data: Record<string, any>;
  hasSolicitante: boolean;
  hasResponsable: boolean;
  hasCompras: boolean;
  hasTesoreria: boolean;
}) {
  // Check if any pending actions exist
  const hasPendingActions =
    hasResponsable ||
    hasCompras ||
    hasTesoreria ||
    (hasSolicitante &&
      ((data.solicitudesDevueltas ?? 0) > 0 || (data.recepcionesPendientes ?? 0) > 0));

  if (!hasPendingActions) return null;

  return (
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
        {/* Director pendientes handled in DirectorDashboard */}
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
  );
}
