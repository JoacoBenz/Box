// Track failed login attempts per email — DB-backed for distributed safety
import { prisma } from './prisma';
import { logApiError } from './logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory fallback
const MAX_LOCKOUT_ENTRIES = 10_000;
const memoryAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

export function _cleanupExpired(): void {
  const now = Date.now();
  for (const [key, val] of memoryAttempts) {
    if (val.lockedUntil && now > val.lockedUntil) memoryAttempts.delete(key);
    else if (!val.lockedUntil && val.count === 0) memoryAttempts.delete(key);
  }
}

setInterval(_cleanupExpired, 60_000);

export function isAccountLocked(email: string): { locked: boolean; remainingMs: number } {
  // Synchronous check uses in-memory (auth callback is sync)
  const entry = memoryAttempts.get(email.toLowerCase());
  if (!entry?.lockedUntil) return { locked: false, remainingMs: 0 };

  const now = Date.now();
  if (now > entry.lockedUntil) {
    memoryAttempts.delete(email.toLowerCase());
    return { locked: false, remainingMs: 0 };
  }

  return { locked: true, remainingMs: entry.lockedUntil - now };
}

export async function isAccountLockedDb(
  email: string,
): Promise<{ locked: boolean; remainingMs: number }> {
  try {
    const key = email.toLowerCase();
    const result = await prisma.$queryRaw<{ locked_until: Date | null }[]>`
      SELECT locked_until FROM account_lockouts WHERE email = ${key}
    `;
    if (result.length === 0 || !result[0].locked_until) return { locked: false, remainingMs: 0 };
    const remaining = result[0].locked_until.getTime() - Date.now();
    if (remaining <= 0) {
      await prisma.$queryRaw`DELETE FROM account_lockouts WHERE email = ${key}`;
      return { locked: false, remainingMs: 0 };
    }
    return { locked: true, remainingMs: remaining };
  } catch (error) {
    logApiError('account-lockout', 'isAccountLockedDb', error);
    return isAccountLocked(email);
  }
}

export function recordFailedLogin(email: string): { locked: boolean; attemptsRemaining: number } {
  const key = email.toLowerCase();
  const entry = memoryAttempts.get(key) ?? { count: 0, lockedUntil: null };
  entry.count++;

  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    memoryAttempts.set(key, entry);
    // Best-effort DB sync
    prisma.$queryRaw`
      INSERT INTO account_lockouts (email, attempts, locked_until)
      VALUES (${key}, ${entry.count}, ${new Date(entry.lockedUntil)})
      ON CONFLICT (email) DO UPDATE SET
        attempts = ${entry.count},
        locked_until = ${new Date(entry.lockedUntil)}
    `.catch(() => {});
    return { locked: true, attemptsRemaining: 0 };
  }

  if (memoryAttempts.size >= MAX_LOCKOUT_ENTRIES) {
    const firstKey = memoryAttempts.keys().next().value;
    if (firstKey !== undefined) memoryAttempts.delete(firstKey);
  }
  memoryAttempts.set(key, entry);
  // Best-effort DB sync
  prisma.$queryRaw`
    INSERT INTO account_lockouts (email, attempts, locked_until)
    VALUES (${key}, ${entry.count}, NULL)
    ON CONFLICT (email) DO UPDATE SET attempts = ${entry.count}
  `.catch(() => {});
  return { locked: false, attemptsRemaining: MAX_FAILED_ATTEMPTS - entry.count };
}

export function clearFailedAttempts(email: string): void {
  memoryAttempts.delete(email.toLowerCase());
  prisma.$queryRaw`DELETE FROM account_lockouts WHERE email = ${email.toLowerCase()}`.catch(
    () => {},
  );
}
