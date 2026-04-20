import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn(() => {
    // Stub: el redirect real throwea internamente para interrumpir el render.
    // En tests simplemente returnamos para poder inspeccionar la llamada.
    return undefined as never;
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import FacturacionRedirect from '@/app/(dashboard)/facturacion/page';

function makeSearchParams(obj: Record<string, string | string[] | undefined>) {
  return Promise.resolve(obj);
}

beforeEach(() => {
  mockRedirect.mockClear();
});

describe('GET /facturacion (legacy redirect)', () => {
  it('redirects to /perfil?tab=facturacion with no params', async () => {
    await FacturacionRedirect({ searchParams: makeSearchParams({}) });
    expect(mockRedirect).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/perfil?tab=facturacion');
  });

  it('forwards ?checkout=success', async () => {
    await FacturacionRedirect({ searchParams: makeSearchParams({ checkout: 'success' }) });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain('/perfil?');
    expect(url).toContain('tab=facturacion');
    expect(url).toContain('checkout=success');
  });

  it('forwards ?reason=canceled', async () => {
    await FacturacionRedirect({ searchParams: makeSearchParams({ reason: 'canceled' }) });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain('reason=canceled');
    expect(url).toContain('tab=facturacion');
  });

  it('drops params outside the whitelist (evita reflected input)', async () => {
    await FacturacionRedirect({
      searchParams: makeSearchParams({
        checkout: 'success',
        reason: 'canceled',
        next: 'https://evil.com/phish',
        tracking_id: 'xyz',
        utm_source: 'phish',
      }),
    });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain('checkout=success');
    expect(url).toContain('reason=canceled');
    expect(url).not.toContain('next=');
    expect(url).not.toContain('tracking_id');
    expect(url).not.toContain('utm_source');
    expect(url).not.toContain('evil.com');
  });

  it('takes the first value when a whitelisted param is an array', async () => {
    await FacturacionRedirect({
      searchParams: makeSearchParams({ checkout: ['success', 'extra'] }),
    });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toContain('checkout=success');
    expect(url).not.toContain('extra');
  });

  it('drops empty strings silently', async () => {
    await FacturacionRedirect({
      searchParams: makeSearchParams({ checkout: '', reason: undefined }),
    });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toBe('/perfil?tab=facturacion');
  });

  it('always sets tab=facturacion even if query already had tab', async () => {
    await FacturacionRedirect({ searchParams: makeSearchParams({ tab: 'something-else' } as any) });
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url).toBe('/perfil?tab=facturacion');
  });
});
