// Track failed login attempts per email
const MAX_LOCKOUT_ENTRIES = 10_000;
const failedAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Clean up periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of failedAttempts) {
    if (val.lockedUntil && now > val.lockedUntil) failedAttempts.delete(key);
    else if (!val.lockedUntil && val.count === 0) failedAttempts.delete(key);
  }
}, 60_000);

export function isAccountLocked(email: string): { locked: boolean; remainingMs: number } {
  const entry = failedAttempts.get(email.toLowerCase());
  if (!entry?.lockedUntil) return { locked: false, remainingMs: 0 };

  const now = Date.now();
  if (now > entry.lockedUntil) {
    failedAttempts.delete(email.toLowerCase());
    return { locked: false, remainingMs: 0 };
  }

  return { locked: true, remainingMs: entry.lockedUntil - now };
}

export function recordFailedLogin(email: string): { locked: boolean; attemptsRemaining: number } {
  const key = email.toLowerCase();
  const entry = failedAttempts.get(key) ?? { count: 0, lockedUntil: null };

  entry.count++;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    failedAttempts.set(key, entry);
    return { locked: true, attemptsRemaining: 0 };
  }

  if (failedAttempts.size >= MAX_LOCKOUT_ENTRIES) {
    const firstKey = failedAttempts.keys().next().value;
    if (firstKey !== undefined) failedAttempts.delete(firstKey);
  }
  failedAttempts.set(key, entry);
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - entry.count };
}

export function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email.toLowerCase());
}
