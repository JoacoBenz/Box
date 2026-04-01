import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit, _cleanupExpired } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  const key = 'test-rate-limit';

  beforeEach(() => {
    resetRateLimit(key);
  });

  it('allows first attempt', () => {
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decrements remaining on each attempt', () => {
    checkRateLimit(key, 5, 60_000);
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('allows up to maxAttempts', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it('blocks after exceeding maxAttempts', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('remaining never goes below 0', () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key, 3, 60_000);
    }
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it('returns resetInMs within window', () => {
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.resetInMs).toBeGreaterThan(0);
    expect(result.resetInMs).toBeLessThanOrEqual(60_000);
  });

  it('different keys are independent', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('key1', 3, 60_000);
    expect(checkRateLimit('key1', 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit('key2', 3, 60_000).allowed).toBe(true);
    resetRateLimit('key1');
    resetRateLimit('key2');
  });

  it('resetRateLimit clears the counter', () => {
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    expect(checkRateLimit(key, 5, 60_000).allowed).toBe(false);
    resetRateLimit(key);
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('handles single attempt limit', () => {
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);
  });

  it('login scenario: 10 attempts per minute', () => {
    const loginKey = 'login:admin@test.com';
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(loginKey, 10, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit(loginKey, 10, 60_000).allowed).toBe(false);
    resetRateLimit(loginKey);
  });

  // ── Window expiration ──
  describe('window expiration', () => {
    it('resets after window expires (fake timers)', () => {
      vi.useFakeTimers();
      for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);

      vi.advanceTimersByTime(60_001);
      const result = checkRateLimit(key, 3, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
      vi.useRealTimers();
    });
  });

  // ── Eviction at MAX_ENTRIES (10,000) ──
  describe('eviction at max entries', () => {
    it('evicts oldest entry when map reaches 10,000', () => {
      for (let i = 0; i < 10_000; i++) {
        checkRateLimit(`evict-${i}`, 1, 60_000);
      }
      const result = checkRateLimit('new-entry', 5, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);

      resetRateLimit('new-entry');
      for (let i = 0; i < 10_000; i++) resetRateLimit(`evict-${i}`);
    });
  });
});

// ── _cleanupExpired ──
describe('rate-limit _cleanupExpired', () => {
  it('removes entries whose window has expired', () => {
    vi.useFakeTimers();
    const testKey = 'cleanup-rl';
    checkRateLimit(testKey, 3, 5_000); // 5s window

    // Advance past window
    vi.advanceTimersByTime(5_001);

    // Run cleanup
    _cleanupExpired();

    // Entry was removed — new call starts fresh
    const result = checkRateLimit(testKey, 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    resetRateLimit(testKey);
    vi.useRealTimers();
  });

  it('keeps entries still within their window', () => {
    vi.useFakeTimers();
    const testKey = 'keep-rl';
    checkRateLimit(testKey, 3, 120_000); // 2 min window

    // Advance only 30s — still within window
    vi.advanceTimersByTime(30_000);

    _cleanupExpired();

    // Entry still exists — second call increments count
    const result = checkRateLimit(testKey, 3, 120_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1); // was 1 call, now 2
    resetRateLimit(testKey);
    vi.useRealTimers();
  });

  it('handles empty store gracefully', () => {
    expect(() => _cleanupExpired()).not.toThrow();
  });
});
