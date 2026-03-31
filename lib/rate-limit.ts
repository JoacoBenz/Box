// In-memory rate limiter with sliding window
const attempts = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attempts) {
    if (now > val.resetAt) attempts.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
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
