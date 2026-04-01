import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logLoginFailed,
  logAccountLocked,
  logRateLimited,
  logLoginSuccess,
  logApiError,
  logNotificationError,
} from '@/lib/logger';

describe('logger', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Get the last JSON output from a spy */
  const lastOutput = (spy: ReturnType<typeof vi.spyOn>) =>
    JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][0]);

  // ── Security logs ──
  describe('logLoginFailed', () => {
    it('logs warn with security category', () => {
      logLoginFailed('user@test.com', '192.168.1.1', 3);
      expect(warnSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(output.level).toBe('warn');
      expect(output.category).toBe('security');
      expect(output.event).toBe('login_failed');
      expect(output.email).toBe('user@test.com');
      expect(output.ip).toBe('192.168.1.1');
      expect(output.attemptsRemaining).toBe(3);
      expect(output.timestamp).toBeDefined();
    });
  });

  describe('logAccountLocked', () => {
    it('logs warn with lockout duration', () => {
      logAccountLocked('user@test.com', '10.0.0.1', 900_000);
      expect(warnSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(output.event).toBe('account_locked');
      expect(output.durationMinutes).toBe(15);
      expect(output.category).toBe('security');
    });
  });

  describe('logRateLimited', () => {
    it('logs warn with key and ip', () => {
      logRateLimited('login:admin@test.com', '172.16.0.1');
      expect(warnSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(output.event).toBe('rate_limited');
      expect(output.key).toBe('login:admin@test.com');
      expect(output.ip).toBe('172.16.0.1');
    });
  });

  describe('logLoginSuccess', () => {
    it('logs info with userId', () => {
      logLoginSuccess('user@test.com', '192.168.1.1', 42);
      expect(logSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(logSpy.mock.calls[0][0]);
      expect(output.level).toBe('info');
      expect(output.event).toBe('login_success');
      expect(output.userId).toBe(42);
    });
  });

  // ── API error logs ──
  describe('logApiError', () => {
    it('logs error with Error object', () => {
      const err = new Error('DB connection failed');
      logApiError('/api/solicitudes', 'GET', err, 1, 10);
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.level).toBe('error');
      expect(output.category).toBe('api');
      expect(output.event).toBe('unhandled_error');
      expect(output.endpoint).toBe('/api/solicitudes');
      expect(output.method).toBe('GET');
      expect(output.userId).toBe(1);
      expect(output.tenantId).toBe(10);
      expect(output.error.message).toBe('DB connection failed');
      expect(output.error.stack).toBeDefined();
    });

    it('logs error with string error', () => {
      logApiError('/api/compras', 'POST', 'something broke');
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.error).toBe('something broke');
    });

    it('logs without optional userId and tenantId', () => {
      logApiError('/api/registro', 'POST', new Error('fail'));
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.userId).toBeUndefined();
      expect(output.tenantId).toBeUndefined();
    });
  });

  // ── Notification error logs ──
  describe('logNotificationError', () => {
    it('logs error with notification details', () => {
      logNotificationError('crearNotificacion', new Error('DB timeout'), 5, 100);
      expect(errorSpy).toHaveBeenCalledOnce();
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.level).toBe('error');
      expect(output.category).toBe('notification');
      expect(output.event).toBe('notification_failed');
      expect(output.action).toBe('crearNotificacion');
      expect(output.targetUserId).toBe(5);
      expect(output.solicitudId).toBe(100);
      expect(output.error.message).toBe('DB timeout');
    });

    it('logs without optional fields', () => {
      logNotificationError('notificarPorRol:director', 'unknown error');
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.targetUserId).toBeUndefined();
      expect(output.solicitudId).toBeUndefined();
      expect(output.error).toBe('unknown error');
    });
  });

  // ── Output format ──
  describe('output format', () => {
    it('all logs are valid JSON', () => {
      logLoginFailed('a@b.com', '1.2.3.4', 0);
      logApiError('/test', 'GET', new Error('test'));
      logNotificationError('test', 'err');
      logLoginSuccess('a@b.com', '1.2.3.4', 1);

      for (const call of warnSpy.mock.calls) {
        expect(() => JSON.parse(call[0])).not.toThrow();
      }
      for (const call of errorSpy.mock.calls) {
        expect(() => JSON.parse(call[0])).not.toThrow();
      }
      for (const call of logSpy.mock.calls) {
        expect(() => JSON.parse(call[0])).not.toThrow();
      }
    });

    it('all logs include timestamp in ISO format', () => {
      logLoginFailed('a@b.com', '1.2.3.4', 0);
      const output = JSON.parse(warnSpy.mock.calls[0][0]);
      expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp);
    });
  });
});
