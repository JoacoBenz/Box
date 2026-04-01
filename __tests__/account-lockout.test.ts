import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAccountLocked,
  recordFailedLogin,
  clearFailedAttempts,
  _cleanupExpired,
} from '@/lib/account-lockout';

describe('account-lockout', () => {
  const email = 'test@example.com';

  beforeEach(() => {
    clearFailedAttempts(email);
  });

  // ── isAccountLocked ──
  describe('isAccountLocked', () => {
    it('returns not locked for unknown email', () => {
      const result = isAccountLocked('unknown@test.com');
      expect(result.locked).toBe(false);
      expect(result.remainingMs).toBe(0);
    });

    it('returns not locked after clearing attempts', () => {
      recordFailedLogin(email);
      clearFailedAttempts(email);
      expect(isAccountLocked(email).locked).toBe(false);
    });

    it('is case insensitive for email', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin('Test@Example.COM');
      expect(isAccountLocked('test@example.com').locked).toBe(true);
      clearFailedAttempts('test@example.com');
    });
  });

  // ── recordFailedLogin ──
  describe('recordFailedLogin', () => {
    it('does not lock after 1 failed attempt', () => {
      const result = recordFailedLogin(email);
      expect(result.locked).toBe(false);
      expect(result.attemptsRemaining).toBe(4);
    });

    it('does not lock after 4 failed attempts', () => {
      for (let i = 0; i < 4; i++) recordFailedLogin(email);
      expect(isAccountLocked(email).locked).toBe(false);
    });

    it('locks after 5 failed attempts', () => {
      let result;
      for (let i = 0; i < 5; i++) result = recordFailedLogin(email);
      expect(result!.locked).toBe(true);
      expect(result!.attemptsRemaining).toBe(0);
    });

    it('reports locked via isAccountLocked after lockout', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      const status = isAccountLocked(email);
      expect(status.locked).toBe(true);
      expect(status.remainingMs).toBeGreaterThan(0);
      expect(status.remainingMs).toBeLessThanOrEqual(15 * 60 * 1000);
    });

    it('decrements attemptsRemaining correctly', () => {
      expect(recordFailedLogin(email).attemptsRemaining).toBe(4);
      expect(recordFailedLogin(email).attemptsRemaining).toBe(3);
      expect(recordFailedLogin(email).attemptsRemaining).toBe(2);
      expect(recordFailedLogin(email).attemptsRemaining).toBe(1);
      expect(recordFailedLogin(email).attemptsRemaining).toBe(0);
    });

    it('is case insensitive', () => {
      recordFailedLogin('User@Test.com');
      recordFailedLogin('USER@TEST.COM');
      recordFailedLogin('user@test.com');
      recordFailedLogin('User@test.com');
      expect(recordFailedLogin('user@TEST.com').locked).toBe(true);
      clearFailedAttempts('user@test.com');
    });
  });

  // ── clearFailedAttempts ──
  describe('clearFailedAttempts', () => {
    it('resets counter after failed attempts', () => {
      for (let i = 0; i < 4; i++) recordFailedLogin(email);
      clearFailedAttempts(email);
      const result = recordFailedLogin(email);
      expect(result.locked).toBe(false);
      expect(result.attemptsRemaining).toBe(4);
    });

    it('unlocks a locked account', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      expect(isAccountLocked(email).locked).toBe(true);
      clearFailedAttempts(email);
      expect(isAccountLocked(email).locked).toBe(false);
    });

    it('is case insensitive', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      clearFailedAttempts('TEST@EXAMPLE.COM');
      expect(isAccountLocked(email).locked).toBe(false);
    });

    it('handles clearing non-existent email gracefully', () => {
      expect(() => clearFailedAttempts('nonexistent@test.com')).not.toThrow();
    });
  });

  // ── Lockout expiration ──
  describe('lockout expiration', () => {
    it('auto-unlocks after 15 minutes via isAccountLocked check', () => {
      vi.useFakeTimers();
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      expect(isAccountLocked(email).locked).toBe(true);

      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      const result = isAccountLocked(email);
      expect(result.locked).toBe(false);
      expect(result.remainingMs).toBe(0);
      vi.useRealTimers();
    });

    it('remains locked before 15 minutes', () => {
      vi.useFakeTimers();
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      vi.advanceTimersByTime(14 * 60 * 1000);
      expect(isAccountLocked(email).locked).toBe(true);
      vi.useRealTimers();
      clearFailedAttempts(email);
    });
  });

  // ── Eviction at MAX_LOCKOUT_ENTRIES (10,000) ──
  describe('eviction at max entries', () => {
    it('evicts oldest entry when map reaches 10,000', () => {
      for (let i = 0; i < 10_000; i++) recordFailedLogin(`evict-${i}@test.com`);
      const result = recordFailedLogin('new-entry@test.com');
      expect(result.locked).toBe(false);
      expect(result.attemptsRemaining).toBe(4);

      for (let i = 0; i < 10_000; i++) clearFailedAttempts(`evict-${i}@test.com`);
      clearFailedAttempts('new-entry@test.com');
    });
  });

  // ── Scenarios ──
  describe('real-world scenarios', () => {
    it('brute force: 5 failures lock the account', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin(email);
      expect(isAccountLocked(email).locked).toBe(true);
    });

    it('successful login clears attempts', () => {
      recordFailedLogin(email);
      recordFailedLogin(email);
      clearFailedAttempts(email);
      expect(recordFailedLogin(email).attemptsRemaining).toBe(4);
    });

    it('multiple users are independent', () => {
      for (let i = 0; i < 5; i++) recordFailedLogin('user1@test.com');
      expect(isAccountLocked('user1@test.com').locked).toBe(true);
      expect(isAccountLocked('user2@test.com').locked).toBe(false);
      clearFailedAttempts('user1@test.com');
    });
  });
});

// ── _cleanupExpired ──
describe('account-lockout _cleanupExpired', () => {
  it('removes entries with expired lockouts', () => {
    vi.useFakeTimers();
    const testEmail = 'cleanup-lock@test.com';
    for (let i = 0; i < 5; i++) recordFailedLogin(testEmail);
    expect(isAccountLocked(testEmail).locked).toBe(true);

    // Advance past lockout (15 min)
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    // Run cleanup — should delete the expired entry
    _cleanupExpired();

    expect(isAccountLocked(testEmail).locked).toBe(false);
    vi.useRealTimers();
  });

  it('keeps entries with active lockouts', () => {
    vi.useFakeTimers();
    const testEmail = 'keep-lock@test.com';
    for (let i = 0; i < 5; i++) recordFailedLogin(testEmail);

    // Only advance 5 min — lockout still active
    vi.advanceTimersByTime(5 * 60 * 1000);

    _cleanupExpired();

    expect(isAccountLocked(testEmail).locked).toBe(true);
    clearFailedAttempts(testEmail);
    vi.useRealTimers();
  });

  it('removes entries with count=0 and no lockout', () => {
    // Create an entry then clear it — internally count becomes 0 or entry is removed
    recordFailedLogin('zeroed@test.com');
    clearFailedAttempts('zeroed@test.com');

    // Cleanup should handle this gracefully
    expect(() => _cleanupExpired()).not.toThrow();
  });

  it('handles empty store gracefully', () => {
    expect(() => _cleanupExpired()).not.toThrow();
  });
});
