'use client';

import { Alert, Button, Space } from 'antd';
import Link from 'next/link';

type Props = {
  estado: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  trialDaysLeft: number | null;
  cancelAtPeriodEnd: boolean;
};

/**
 * Top-of-dashboard banner shown when the tenant should act on billing:
 * - trial with <=5 days left
 * - past_due (payment failed, grace running)
 * - upcoming cancellation
 *
 * Hidden on active + ample-trial states so it doesn't add noise.
 */
export function SubscriptionBanner({ estado, trialDaysLeft, cancelAtPeriodEnd }: Props) {
  if (estado === 'trialing' && trialDaysLeft !== null && trialDaysLeft <= 5) {
    return (
      <Alert
        type={trialDaysLeft <= 2 ? 'warning' : 'info'}
        showIcon
        banner
        message={
          <Space>
            <span>
              {trialDaysLeft === 0
                ? 'Tu trial vence hoy.'
                : trialDaysLeft === 1
                  ? 'Tu trial vence mañana.'
                  : `Tu trial vence en ${trialDaysLeft} días.`}{' '}
              Activá tu plan para no perder acceso.
            </span>
            <Link href="/facturacion">
              <Button type="primary" size="small">
                Activar plan
              </Button>
            </Link>
          </Space>
        }
      />
    );
  }

  if (estado === 'past_due') {
    return (
      <Alert
        type="warning"
        showIcon
        banner
        message={
          <Space>
            <span>
              No pudimos cobrar tu suscripción. Actualizá el método de pago para evitar la
              suspensión del servicio.
            </span>
            <Link href="/facturacion">
              <Button type="primary" size="small" danger>
                Actualizar pago
              </Button>
            </Link>
          </Space>
        }
      />
    );
  }

  if (estado === 'active' && cancelAtPeriodEnd) {
    return (
      <Alert
        type="info"
        showIcon
        banner
        message={
          <Space>
            <span>
              Tu suscripción quedó programada para cancelarse al final del período. Podés
              reactivarla desde el portal.
            </span>
            <Link href="/facturacion">
              <Button size="small">Ir a facturación</Button>
            </Link>
          </Space>
        }
      />
    );
  }

  return null;
}
