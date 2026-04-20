import { MercadoPagoConfig, PreApproval, PreApprovalPlan, Payment } from 'mercadopago';
import crypto from 'crypto';

/**
 * Mercado Pago SDK singleton.
 *
 * Billing es opcional: cuando MP_ACCESS_TOKEN no está seteado, los getters
 * devuelven null y los handlers deben responder 503 STRIPE_DISABLED (sí,
 * mantenemos ese code por compat con consumidores que lo chequeaban).
 */

let config: MercadoPagoConfig | null = null;

function getConfig(): MercadoPagoConfig | null {
  if (config) return config;
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  config = new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 10_000 },
  });
  return config;
}

export function isMpEnabled(): boolean {
  return !!process.env.MP_ACCESS_TOKEN && !!process.env.MP_PLAN_ID;
}

export function getPreApproval(): PreApproval | null {
  const c = getConfig();
  return c ? new PreApproval(c) : null;
}

export function getPreApprovalPlan(): PreApprovalPlan | null {
  const c = getConfig();
  return c ? new PreApprovalPlan(c) : null;
}

export function getPayment(): Payment | null {
  const c = getConfig();
  return c ? new Payment(c) : null;
}

export function requireMp(): MercadoPagoConfig {
  const c = getConfig();
  if (!c) {
    throw new Error(
      'Mercado Pago is not configured. Set MP_ACCESS_TOKEN (y MP_PLAN_ID para suscripciones).',
    );
  }
  return c;
}

/**
 * Verificación de firma para webhooks de MP v2.
 *
 * MP manda 2 headers relevantes: `x-signature` (con template "ts=...,v1=...")
 * y `x-request-id`. El hash se calcula sobre
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * usando MP_WEBHOOK_SECRET como clave HMAC-SHA256 en hex.
 *
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyMpSignature(args: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { signatureHeader, requestIdHeader, dataId, secret } = args;
  if (!signatureHeader || !requestIdHeader || !dataId) return false;

  // Parse "ts=NNN,v1=HHH"
  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, seg) => {
    const [k, v] = seg.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Constant-time compare to avoid timing attacks.
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
}
