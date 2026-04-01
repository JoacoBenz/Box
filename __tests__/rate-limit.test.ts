import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

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
      const result = checkRateLimit(key, 5, 60_000);
      expect(result.allowed).toBe(true);
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
    const result = checkRateLimit(key, 3, 60_000);
    expect(result.remaining).toBe(0);
  });

  it('returns resetInMs within window', () => {
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.resetInMs).toBeGreaterThan(0);
    expect(result.resetInMs).toBeLessThanOrEqual(60_000);
  });

  it('different keys are independent', () => {
    // Exhaust key1
    for (let i = 0; i < 3; i++) {
      checkRateLimit('key1', 3, 60_000);
    }
    const blocked = checkRateLimit('key1', 3, 60_000);
    expect(blocked.allowed).toBe(false);

    // key2 should still be allowed
    const allowed = checkRateLimit('key2', 3, 60_000);
    expect(allowed.allowed).toBe(true);

    // cleanup
    resetRateLimit('key1');
    resetRateLimit('key2');
  });

  it('resetRateLimit clears the counter', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, 5, 60_000);
    }
    const blocked = checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);

    resetRateLimit(key);
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('handles single attempt limit', () => {
    const first = checkRateLimit(key, 1, 60_000);
    expect(first.allowed).toBe(true);

    const second = checkRateLimit(key, 1, 60_000);
    expect(second.allowed).toBe(false);
  });

  it('login scenario: 10 attempts per minute', () => {
    const loginKey = 'login:admin@test.com';
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit(loginKey, 10, 60_000);
      expect(result.allowed).toBe(true);
    }
    const result = checkRateLimit(loginKey, 10, 60_000);
    expect(result.allowed).toBe(false);
    resetRateLimit(loginKey);
  });
});
