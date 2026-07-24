import * as Sentry from '@sentry/nextjs';
import { after } from 'next/server';
import pkg from '../package.json';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  category: 'security' | 'api' | 'notification' | 'system';
  event: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatError(error: unknown): unknown {
  if (error instanceof Error) {
    // Error con posibles propiedades extras (ej: APIError de SDKs).
    const extra: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(error)) {
      if (key === 'message' || key === 'stack' || key === 'name') continue;
      extra[key] = (error as unknown as Record<string, unknown>)[key];
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(Object.keys(extra).length > 0 ? { extra } : {}),
    };
  }
  if (typeof error === 'object' && error !== null) {
    // Objetos planos (ej: errores de SDKs que throwean objetos no-Error).
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return String(error);
    }
  }
  return String(error);
}

// Deploy correlation: the release this app is running. Prefers APP_RELEASE,
// then a CI git SHA, falling back to the package version.
function appRelease(): string {
  return (
    process.env.APP_RELEASE ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_SHA ||
    pkg.version
  );
}

// Optional centralized monitoring: when MISSION_CONTROL_URL and
// MISSION_CONTROL_API_KEY are set, warn/error entries are also shipped to the
// Mission Control dashboard. Fire-and-forget: monitoring must never break the app.
function deliver(entry: LogEntry): void {
  const url = process.env.MISSION_CONTROL_URL;
  const key = process.env.MISSION_CONTROL_API_KEY;
  if (!url || !key) return;
  void fetch(`${url.replace(/\/$/, '')}/api/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...entry, release: appRelease() }),
    // keepalive lets the request outlive the response on most runtimes.
    keepalive: true,
  }).catch(() => undefined);
}

function ship(entry: LogEntry): void {
  // after() defers delivery until the response is sent and keeps the instance
  // alive until it completes. Outside a request scope (scripts, boot) it throws:
  // send direct.
  try {
    after(() => deliver(entry));
  } catch {
    deliver(entry);
  }
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
  // Centralized monitoring also receives warn/error (Sentry stays as-is).
  if (entry.level === 'error' || entry.level === 'warn') ship(entry);
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
    error: formatError(error),
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
    error: formatError(error),
  };
  log(entry);
  captureToSentry(error, entry);
}
