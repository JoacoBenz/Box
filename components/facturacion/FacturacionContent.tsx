'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Descriptions,
  Progress,
  Alert,
  Spin,
  message,
  Popconfirm,
} from 'antd';
import { useSearchParams } from 'next/navigation';

const { Text } = Typography;

type Subscription = {
  tenantId: number;
  planNombre: string;
  estado: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  mpPreapprovalId: string | null;
  mpPayerEmail: string | null;
  hasAccess: boolean;
  trialDaysLeft: number | null;
};

type Usage = {
  areas: { count: number; limit: number };
  centros_costo: { count: number; limit_per_area: number; total_limit: number };
  roles: {
    director: { count: number; limit: number };
    tesoreria: { count: number; limit: number };
    admin: { count: number; limit: number };
    compras: { count: number; limit: number };
    responsable_area: { total: number; limit_per_area: number; areas_con_responsable: number };
  };
};

const ESTADO_TAG: Record<Subscription['estado'], { color: string; label: string }> = {
  trialing: { color: 'blue', label: 'En trial' },
  active: { color: 'green', label: 'Activa' },
  past_due: { color: 'orange', label: 'Pago pendiente' },
  canceled: { color: 'red', label: 'Cancelada' },
  unpaid: { color: 'red', label: 'Impaga' },
};

/**
 * Billing UI. Se renderiza embebida como tab dentro de /perfil para
 * roles director/admin/super_admin. No usa heading propio porque vive
 * bajo el <Tabs> del perfil.
 *
 * Integrada con Mercado Pago:
 *  - "Activar plan" → crea Preapproval y redirige al init_point de MP.
 *  - "Cancelar suscripción" → POST /api/mercadopago/cancelar (MP no tiene
 *    customer portal como Stripe, cancelamos desde acá).
 */
export function FacturacionContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const checkout = searchParams.get('checkout');

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'cancel' | null>(null);

  async function loadSubscription() {
    try {
      const res = await fetch('/api/mercadopago/subscription');
      if (!res.ok) {
        if (res.status === 404) setSubscription(null);
        return;
      }
      const data = await res.json();
      setSubscription(data.subscription);
      setUsage(data.usage);
    } catch (err) {
      console.error('[facturacion] load error', err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadSubscription();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckout() {
    setBusy('checkout');
    try {
      const res = await fetch('/api/mercadopago/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data?.error?.message ?? 'No se pudo iniciar el checkout');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error('[facturacion] checkout error', err);
      message.error('No se pudo iniciar el checkout');
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    setBusy('cancel');
    try {
      const res = await fetch('/api/mercadopago/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data?.error?.message ?? 'No se pudo cancelar');
        return;
      }
      message.success('Suscripción cancelada');
      await loadSubscription();
    } catch (err) {
      console.error('[facturacion] cancel error', err);
      message.error('No se pudo cancelar');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  const estadoTag = subscription
    ? ESTADO_TAG[subscription.estado]
    : { color: 'default', label: 'Sin suscripción' };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 900 }}>
      {checkout === 'success' && (
        <Alert
          type="success"
          showIcon
          message="Suscripción autorizada"
          description="Tu pago con Mercado Pago fue autorizado. Ya tenés acceso completo."
        />
      )}

      {reason === 'canceled' || reason === 'unpaid' ? (
        <Alert
          type="error"
          showIcon
          message="Suscripción inactiva"
          description="Para seguir usando Box tenés que activar tu plan."
        />
      ) : reason === 'no_subscription' ? (
        <Alert
          type="warning"
          showIcon
          message="No encontramos tu suscripción"
          description="Contactate con soporte."
        />
      ) : null}

      <Card title="Plan actual">
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Plan">
            <Text strong>Box Principal</Text>
            <div>
              <Text type="secondary">152.000 ARS / mes</Text>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Estado">
            <Tag color={estadoTag.color}>{estadoTag.label}</Tag>
            {subscription?.estado === 'trialing' && subscription.trialDaysLeft !== null && (
              <Text type="secondary" style={{ marginLeft: 12 }}>
                {subscription.trialDaysLeft === 0
                  ? 'Vence hoy'
                  : `Te quedan ${subscription.trialDaysLeft} día${
                      subscription.trialDaysLeft === 1 ? '' : 's'
                    }`}
              </Text>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <Text type="warning" style={{ marginLeft: 12 }}>
                Se cancela al final del período
              </Text>
            )}
          </Descriptions.Item>
          {subscription?.currentPeriodEnd && (
            <Descriptions.Item label="Próximo cobro">
              {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-AR')}
            </Descriptions.Item>
          )}
          {subscription?.mpPayerEmail && (
            <Descriptions.Item label="Email del pagador">
              <Text type="secondary">{subscription.mpPayerEmail}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div style={{ marginTop: 16 }}>
          <Space>
            {subscription?.estado !== 'active' && (
              <Button
                type="primary"
                size="large"
                loading={busy === 'checkout'}
                onClick={handleCheckout}
              >
                {subscription?.estado === 'trialing' ? 'Activar plan ahora' : 'Reactivar plan'}
              </Button>
            )}
            {subscription?.estado === 'active' && subscription.mpPreapprovalId && (
              <Popconfirm
                title="Cancelar suscripción"
                description="Tu cuenta pierde acceso al final del período actual. Podés reactivar cuando quieras."
                okText="Sí, cancelar"
                cancelText="Volver"
                okButtonProps={{ danger: true }}
                onConfirm={handleCancel}
              >
                <Button size="large" danger loading={busy === 'cancel'}>
                  Cancelar suscripción
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      </Card>

      {usage && (
        <Card title="Uso del plan">
          <Descriptions column={1} bordered size="middle">
            <Descriptions.Item label="Áreas">
              <UsageBar count={usage.areas.count} limit={usage.areas.limit} unit="áreas" />
            </Descriptions.Item>
            <Descriptions.Item label="Centros de costo">
              <UsageBar
                count={usage.centros_costo.count}
                limit={usage.centros_costo.total_limit}
                unit={`CCs (máx ${usage.centros_costo.limit_per_area} por área)`}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Director">
              <UsageBar
                count={usage.roles.director.count}
                limit={usage.roles.director.limit}
                unit="director"
              />
            </Descriptions.Item>
            <Descriptions.Item label="Tesorería">
              <UsageBar
                count={usage.roles.tesoreria.count}
                limit={usage.roles.tesoreria.limit}
                unit="tesorería"
              />
            </Descriptions.Item>
            <Descriptions.Item label="Admin">
              <UsageBar
                count={usage.roles.admin.count}
                limit={usage.roles.admin.limit}
                unit="admin"
              />
            </Descriptions.Item>
            <Descriptions.Item label="Compras">
              <UsageBar
                count={usage.roles.compras.count}
                limit={usage.roles.compras.limit}
                unit="compras"
              />
            </Descriptions.Item>
            <Descriptions.Item label="Responsables de área">
              <UsageBar
                count={usage.roles.responsable_area.areas_con_responsable}
                limit={usage.areas.count}
                unit={`áreas con responsable (máx ${usage.roles.responsable_area.limit_per_area} por área)`}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Solicitantes">
              <Text>Sin límite en el plan</Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Space>
  );
}

function UsageBar({ count, limit, unit }: { count: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const status = pct >= 100 ? 'exception' : pct >= 80 ? 'active' : 'normal';
  return (
    <div style={{ maxWidth: 400 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 2,
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          {count} / {limit}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {unit}
        </Text>
      </div>
      <Progress percent={pct} status={status} showInfo={false} size="small" />
    </div>
  );
}
