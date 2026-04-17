import * as Sentry from '@sentry/nextjs';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  category: 'security' | 'api' | 'notification' | 'system';
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(entry: LogEntry): void {
  const output = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

function captureToSentry(error: unknown, entry: LogEntry): void {
  // No-op when Sentry SDK isn't initialized (missing DSN).
  const { level, category, event, timestamp: _timestamp, ...context } = entry;
  Sentry.withScope((scope) => {
    scope.setLevel(level === 'warn' ? 'warning' : level);
    scope.setTag('category', category);
    scope.setTag('event', event);
    scope.setContext('log', context);
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(
        typeof error === 'string' ? error : event,
        level === 'warn' ? 'warning' : level,
      );
    }
  });
}

// ── Security events ──

export function logLoginFailed(email: string, ip: string, attemptsRemaining: number): void {
  log({
    level: 'warn',
    category: 'security',
    event: 'login_failed',
    timestamp: new Date().toISOString(),
    email,
    ip,
    attemptsRemaining,
  });
}

export function logAccountLocked(email: string, ip: string, durationMs: number): void {
  log({
    level: 'warn',
    category: 'security',
    event: 'account_locked',
    timestamp: new Date().toISOString(),
    email,
    ip,
    durationMinutes: Math.round(durationMs / 60_000),
  });
}

export function logRateLimited(key: string, ip: string): void {
  log({
    level: 'warn',
    category: 'security',
    event: 'rate_limited',
    timestamp: new Date().toISOString(),
    key,
    ip,
  });
}

export function logLoginSuccess(email: string, ip: string, userId: number): void {
  log({
    level: 'info',
    category: 'security',
    event: 'login_success',
    timestamp: new Date().toISOString(),
    email,
    ip,
    userId,
  });
}

// ── API errors ──

export function logApiError(
  endpoint: string,
  method: string,
  error: unknown,
  userId?: number,
  tenantId?: number,
): void {
  const entry: LogEntry = {
    level: 'error',
    category: 'api',
    event: 'unhandled_error',
    timestamp: new Date().toISOString(),
    endpoint,
    method,
    userId,
    tenantId,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  };
  log(entry);
  captureToSentry(error, entry);
}

// ── Notification errors ──

export function logNotificationError(
  action: string,
  error: unknown,
  targetUserId?: number,
  solicitudId?: number,
): void {
  const entry: LogEntry = {
    level: 'error',
    category: 'notification',
    event: 'notification_failed',
    timestamp: new Date().toISOString(),
    action,
    targetUserId,
    solicitudId,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
  };
  log(entry);
  captureToSentry(error, entry);
}
