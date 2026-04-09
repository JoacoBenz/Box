import { vi } from 'vitest';

/** Creates a mock Prisma-like object with all common methods as vi.fn() */
export function mockPrisma() {
  const createModel = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn(),
  });

  return {
    solicitudes: createModel(),
    usuarios: createModel(),
    areas: createModel(),
    centros_costo: createModel(),
    proveedores: createModel(),
    compras: createModel(),
    recepciones: createModel(),
    notificaciones: createModel(),
    log_auditoria: createModel(),
    configuracion: createModel(),
    delegaciones: createModel(),
    tenants: createModel(),
    roles: createModel(),
    usuarios_roles: createModel(),
    codigos_invitacion: createModel(),
    archivos: createModel(),
    items_solicitud: createModel(),
    $transaction: vi.fn(async (fn: any) => {
      if (typeof fn === 'function') return fn(mockPrisma());
      return Promise.all(fn);
    }),
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

/** Default session for tests */
export function mockSession(overrides: Record<string, any> = {}) {
  return {
    userId: 1,
    tenantId: 1,
    nombre: 'Test User',
    email: 'test@test.com',
    roles: ['solicitante'] as string[],
    areaId: 1,
    areaNombre: 'Área Test',
    centroCostoId: 1,
    delegaciones: [],
    ...overrides,
  };
}

/** Builds a Request object for testing API routes */
export function mockRequest(url: string, options: { method?: string; body?: any; headers?: Record<string, string> } = {}) {
  const { method = 'GET', body, headers = {} } = options;
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) init.body = JSON.stringify(body);
  return new Request(`http://localhost${url}`, init);
}
