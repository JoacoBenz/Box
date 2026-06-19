import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiError: vi.fn((code: string, message: string, status: number) =>
    Response.json({ error: { code, message } }, { status }),
  ),
}));

vi.mock('@/lib/permissions', () => ({
  apiError: mocks.apiError,
}));

import { checkOptimisticLock } from '@/lib/optimistic-lock';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkOptimisticLock', () => {
  const baseDate = new Date('2026-04-20T12:00:00.000Z');

  // ── No-conflict cases ──

  it('returns null when expectedUpdatedAt is null', () => {
    expect(checkOptimisticLock(null, baseDate)).toBeNull();
  });

  it('returns null when expectedUpdatedAt is undefined', () => {
    expect(checkOptimisticLock(undefined, baseDate)).toBeNull();
  });

  it('returns null when timestamps match (ISO string)', () => {
    const result = checkOptimisticLock(baseDate.toISOString(), baseDate);
    expect(result).toBeNull();
  });

  // ── Conflict cases ──

  it('returns a 409 Response when timestamps differ', async () => {
    const staleDate = new Date('2026-04-19T10:00:00.000Z');
    const result = checkOptimisticLock(staleDate.toISOString(), baseDate);

    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(409);

    const body = await result!.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('calls apiError with CONFLICT code and 409 status on mismatch', () => {
    const staleDate = new Date('2026-04-19T10:00:00.000Z');
    checkOptimisticLock(staleDate.toISOString(), baseDate);

    expect(mocks.apiError).toHaveBeenCalledOnce();
    expect(mocks.apiError).toHaveBeenCalledWith('CONFLICT', expect.any(String), 409);
  });

  // ── ISO string comparison ──

  it('compares using ISO string format', () => {
    // Same instant, different Date objects — should match
    const a = new Date('2026-04-20T12:00:00.000Z');
    const b = new Date('2026-04-20T12:00:00.000Z');
    expect(checkOptimisticLock(a.toISOString(), b)).toBeNull();
  });

  it('treats a one-millisecond difference as a conflict', () => {
    const current = new Date('2026-04-20T12:00:00.001Z');
    const result = checkOptimisticLock(baseDate.toISOString(), current);

    expect(result).toBeInstanceOf(Response);
    expect(result!.status).toBe(409);
  });
});
