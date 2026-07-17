import { timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Valida el header x-cron-secret. Fail-closed: sin CRON_SECRET configurado
 * los endpoints de cron quedan deshabilitados (antes quedaban abiertos).
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const got = request.headers.get('x-cron-secret');
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
