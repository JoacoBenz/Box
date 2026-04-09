import { apiError } from './permissions';

/**
 * Checks optimistic locking by comparing updated_at timestamps.
 * Returns an error response if the record has been modified since the client last read it.
 */
export function checkOptimisticLock(
  expectedUpdatedAt: string | undefined | null,
  currentUpdatedAt: Date
): Response | null {
  if (!expectedUpdatedAt) return null;
  const current = currentUpdatedAt.toISOString();
  if (current !== expectedUpdatedAt) {
    return apiError('CONFLICT', 'Esta solicitud fue modificada por otro usuario. Recargá la página.', 409);
  }
  return null;
}
