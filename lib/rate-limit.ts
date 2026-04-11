// Rate limiter with database-backed storage for distributed safety
import { prisma } from './prisma';
import { logApiError } from './logger';

// In-memory fallback when DB is unavailable
const MAX_ENTRIES = 10_000;
const memoryAttempts = new Map<string, { count: number; resetAt: number }>();

/** Remove expired entries from the in-memory store. Runs automatically every 60 s. */
export function _cleanupExpired(): void {
  const now = Date.now();
  for (const [key, val] of memoryAttempts) {
    if (now > val.resetAt) memoryAttempts.delete(key);
  }
}

let _cleanupTimer: ReturnType<typeof setInterval> | null = null;
if (!_cleanupTimer) {
  _cleanupTimer = setInterval(_cleanupExpired, 60_000);
}

function checkMemoryFallback(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = memoryAttempts.get(key);

  if (!entry || now > entry.resetAt) {
    if (memoryAttempts.size >= MAX_ENTRIES) {
      const firstKey = memoryAttempts.keys().next().value;
      if (firstKey !== undefined) memoryAttempts.delete(firstKey);
    }
    memoryAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetInMs: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, maxAttempts - entry.count);
  const resetInMs = entry.resetAt - now;

  return { allowed: entry.count <= maxAttempts, remaining, resetInMs };
}

export async function checkRateLimitDb(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetInMs: number }> {
  try {
    const windowStart = new Date(Date.now() - windowMs);
    // Atomic upsert + count in a single transaction
    const result = await prisma.$queryRaw<{ cnt: bigint }[]>`
      INSERT INTO rate_limits (key, attempts, window_start)
      VALUES (${key}, 1, NOW())
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE
          WHEN rate_limits.window_start < ${windowStart} THEN 1
          ELSE rate_limits.attempts + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start < ${windowStart} THEN NOW()
          ELSE rate_limits.window_start
        END
      RETURNING attempts AS cnt
    `;
    const count = Number(result[0].cnt);
    const remaining = Math.max(0, maxAttempts - count);
    return { allowed: count <= maxAttempts, remaining, resetInMs: windowMs };
  } catch (error) {
    logApiError('rate-limit', 'checkRateLimitDb', error);
    // Fall back to in-memory if DB unavailable
    return checkMemoryFallback(key, maxAttempts, windowMs);
  }
}

// Synchronous in-memory version (kept for backward compatibility in auth callbacks)
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  return checkMemoryFallback(key, maxAttempts, windowMs);
}

export function resetRateLimit(key: string): void {
  memoryAttempts.delete(key);
  // Best-effort DB cleanup
  prisma.$queryRaw`DELETE FROM rate_limits WHERE key = ${key}`.catch(err => console.error('[rate-limit] DB sync error:', err));
}
