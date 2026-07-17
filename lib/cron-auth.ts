import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Valida el secret de cron. Fail-closed: sin CRON_SECRET configurado los
 * endpoints quedan deshabilitados (antes quedaban abiertos). Acepta
 * `x-cron-secret` (llamadas manuales) o `Authorization: Bearer` (Vercel Cron).
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const got =
    request.headers.get('x-cron-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer /, '') ??
    null;
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
