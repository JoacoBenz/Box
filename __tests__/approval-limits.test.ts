import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetNumber = vi.fn();

vi.mock('@/lib/tenant-config', () => ({
  getTenantConfigNumber: (...args: any[]) => mockGetNumber(...args),
}));

import { getRequiredApprovalLevel, canUserApproveAmount } from '@/lib/approval-limits';

beforeEach(() => {
  mockGetNumber.mockReset();
  // Default: responsable threshold 50000, director threshold 500000
  mockGetNumber.mockImplementation((_tid: number, key: string, def: number) => {
    if (key === 'umbral_aprobacion_responsable') return Promise.resolve(50000);
    if (key === 'umbral_aprobacion_director') return Promise.resolve(500000);
    return Promise.resolve(def);
  });
});

describe('getRequiredApprovalLevel', () => {
  it('returns director for null amount', async () => {
    expect(await getRequiredApprovalLevel(1, null)).toBe('director');
  });

  it('returns director for zero amount', async () => {
    expect(await getRequiredApprovalLevel(1, 0)).toBe('director');
  });

  it('returns director for negative amount', async () => {
    expect(await getRequiredApprovalLevel(1, -100)).toBe('director');
  });

  it('returns responsable when amount <= umbral_responsable', async () => {
    expect(await getRequiredApprovalLevel(1, 30000)).toBe('responsable');
  });

  it('returns director when amount <= umbral_director', async () => {
    expect(await getRequiredApprovalLevel(1, 200000)).toBe('director');
  });

  it('returns director_general when amount > umbral_director', async () => {
    expect(await getRequiredApprovalLevel(1, 600000)).toBe('director_general');
  });

  it('returns director when umbral_responsable is 0 (disabled)', async () => {
    mockGetNumber.mockImplementation((_tid: number, key: string, def: number) => {
      if (key === 'umbral_aprobacion_responsable') return Promise.resolve(0);
      if (key === 'umbral_aprobacion_director') return Promise.resolve(500000);
      return Promise.resolve(def);
    });
    expect(await getRequiredApprovalLevel(1, 30000)).toBe('director');
  });
});

describe('canUserApproveAmount', () => {
  it('allows responsable_area for responsable-level amount', async () => {
    const result = await canUserApproveAmount(1, ['responsable_area'], 30000);
    expect(result.allowed).toBe(true);
    expect(result.requiredLevel).toBe('responsable');
  });

  it('allows director for responsable-level amount', async () => {
    const result = await canUserApproveAmount(1, ['director'], 30000);
    expect(result.allowed).toBe(true);
  });

  it('allows admin for responsable-level amount', async () => {
    const result = await canUserApproveAmount(1, ['admin'], 30000);
    expect(result.allowed).toBe(true);
  });

  it('denies solicitante for responsable-level amount', async () => {
    const result = await canUserApproveAmount(1, ['solicitante'], 30000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('allows director for director-level amount', async () => {
    const result = await canUserApproveAmount(1, ['director'], 200000);
    expect(result.allowed).toBe(true);
    expect(result.requiredLevel).toBe('director');
  });

  it('allows admin for director-level amount', async () => {
    const result = await canUserApproveAmount(1, ['admin'], 200000);
    expect(result.allowed).toBe(true);
  });

  it('denies responsable_area for director-level amount', async () => {
    const result = await canUserApproveAmount(1, ['responsable_area'], 200000);
    expect(result.allowed).toBe(false);
  });

  it('allows admin for director_general-level amount', async () => {
    const result = await canUserApproveAmount(1, ['admin'], 600000);
    expect(result.allowed).toBe(true);
    expect(result.requiredLevel).toBe('director_general');
  });

  it('denies director for director_general-level amount', async () => {
    const result = await canUserApproveAmount(1, ['director'], 600000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('administración');
  });
});
