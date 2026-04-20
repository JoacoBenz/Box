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
} from 'antd';
import { useSearchParams } from 'next/navigation';

const { Title, Text, Paragraph } = Typography;

type Subscription = {
  tenantId: number;
  planNombre: string;
  estado: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
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

export default function FacturacionPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const checkout = searchParams.get('checkout');

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stripe/subscription');
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            setSubscription(null);
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setSubscription(data.subscription);
        setUsage(data.usage);
      } catch (err) {
        console.error('[facturacion] load error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheckout() {
    setBusy('checkout');
    try {
      const res = await fetch('/api/stripe/checkout', {
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

  async function handlePortal() {
    setBusy('portal');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data?.error?.message ?? 'No se pudo abrir el portal');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error('[facturacion] portal error', err);
      message.error('No se pudo abrir el portal');
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
      <div>
        <Title level={2} style={{ margin: 0 }}>
          Facturación
        </Title>
        <Paragraph type="secondary">Gestioná tu plan, facturas y método de pago.</Paragraph>
      </div>

      {checkout === 'success' && (
        <Alert
          type="success"
          showIcon
          message="Suscripción activada"
          description="Gracias por sumarte. Ya tenés acceso completo."
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
            <Descriptions.Item label="Próxima renovación">
              {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-AR')}
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
            {subscription?.stripeCustomerId && (
              <Button size="large" loading={busy === 'portal'} onClick={handlePortal}>
                Administrar suscripción
              </Button>
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
              <Text>
                {usage.roles.responsable_area.areas_con_responsable} / {usage.areas.count} áreas con
                responsable (máx {usage.roles.responsable_area.limit_per_area} por área)
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Solicitantes">
              <Text>Sin límite</Text>
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
      <Progress percent={pct} status={status} format={() => `${count} / ${limit}`} size="small" />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {unit}
      </Text>
    </div>
  );
}
