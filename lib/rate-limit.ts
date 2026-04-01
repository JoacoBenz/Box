// In-memory rate limiter with sliding window
const MAX_ENTRIES = 10_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** Remove expired entries from the in-memory store. Runs automatically every 60 s. */
export function _cleanupExpired(): void {
  const now = Date.now();
  for (const [key, val] of attempts) {
    if (now > val.resetAt) attempts.delete(key);
  }
}

// Clean up expired entries periodically
setInterval(_cleanupExpired, 60_000);

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    if (attempts.size >= MAX_ENTRIES) {
      const firstKey = attempts.keys().next().value;
      if (firstKey !== undefined) attempts.delete(firstKey);
    }
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetInMs: windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, maxAttempts - entry.count);
  const resetInMs = entry.resetAt - now;

  return { allowed: entry.count <= maxAttempts, remaining, resetInMs };
}

export function resetRateLimit(key: string): void {
  attempts.delete(key);
}
