import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    usuarios: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    tenants: {
      findMany: vi.fn(),
    },
    roles: {
      findFirst: vi.fn(),
    },
    usuarios_roles: {
      create: vi.fn(),
    },
  },
  bcrypt: {
    compare: vi.fn(),
  },
  rateLimit: {
    checkRateLimit: vi.fn(),
  },
  lockout: {
    isAccountLocked: vi.fn(),
    recordFailedLogin: vi.fn(),
    clearFailedAttempts: vi.fn(),
  },
  logger: {
    logLoginFailed: vi.fn(),
    logAccountLocked: vi.fn(),
    logRateLimited: vi.fn(),
    logLoginSuccess: vi.fn(),
  },
  audit: {
    registrarAuditoria: vi.fn().mockResolvedValue(undefined),
  },
  tenantConfig: {
    getTenantConfigBool: vi.fn(),
    getTenantConfig: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('bcryptjs', () => ({ default: mocks.bcrypt }));
vi.mock('@/lib/rate-limit', () => mocks.rateLimit);
vi.mock('@/lib/account-lockout', () => mocks.lockout);
vi.mock('@/lib/logger', () => mocks.logger);
vi.mock('@/lib/audit', () => mocks.audit);
vi.mock('@/lib/tenant-config', () => mocks.tenantConfig);

import { authorizeCredentials, signInOAuth } from '@/lib/auth-callbacks';

// ── Shared test fixtures ──

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Alice',
    email: 'alice@example.com',
    password_hash: '$2a$10$validhash',
    tenant_id: 42,
    area_id: 7,
    centro_costo_id: 3,
    tenant: { nombre: 'Acme Inc' },
    area: { nombre: 'Finance' },
    usuarios_roles: [{ rol: { nombre: 'solicitante' } }],
    oauth_provider: null,
    oauth_sub: null,
    ...overrides,
  };
}

function resetMocks() {
  vi.clearAllMocks();
  // Default "happy path" values
  mocks.lockout.isAccountLocked.mockReturnValue({ locked: false, remainingMs: 0 });
  mocks.lockout.recordFailedLogin.mockReturnValue({ locked: false, attemptsRemaining: 4 });
  mocks.rateLimit.checkRateLimit.mockReturnValue({ allowed: true });
}

// ── authorizeCredentials ──

describe('authorizeCredentials', () => {
  beforeEach(resetMocks);

  it('returns null when credentials are missing', async () => {
    expect(await authorizeCredentials(undefined)).toBeNull();
    expect(await authorizeCredentials({})).toBeNull();
    expect(await authorizeCredentials({ email: 'a@b.com' })).toBeNull();
    expect(await authorizeCredentials({ password: 'x' })).toBeNull();
  });

  it('returns null when account is locked', async () => {
    mocks.lockout.isAccountLocked.mockReturnValue({ locked: true, remainingMs: 5000 });
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'x' });
    expect(result).toBeNull();
    expect(mocks.logger.logAccountLocked).toHaveBeenCalled();
    expect(mocks.prisma.usuarios.findMany).not.toHaveBeenCalled();
  });

  it('returns null when rate limit is exceeded', async () => {
    mocks.rateLimit.checkRateLimit.mockReturnValue({ allowed: false });
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'x' });
    expect(result).toBeNull();
    expect(mocks.logger.logRateLimited).toHaveBeenCalled();
    expect(mocks.prisma.usuarios.findMany).not.toHaveBeenCalled();
  });

  it('lowercases and trims the email before lookup', async () => {
    mocks.prisma.usuarios.findMany.mockResolvedValue([]);
    mocks.prisma.usuarios.findFirst.mockResolvedValue(null);
    await authorizeCredentials({ email: '  Alice@Example.COM  ', password: 'x' });
    expect(mocks.prisma.usuarios.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: 'alice@example.com', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('returns null when no user matches the email and records failure', async () => {
    mocks.prisma.usuarios.findMany.mockResolvedValue([]);
    mocks.prisma.usuarios.findFirst.mockResolvedValue({ id: 99, tenant_id: 1 });
    const result = await authorizeCredentials({ email: 'ghost@nowhere.com', password: 'x' });
    expect(result).toBeNull();
    expect(mocks.lockout.recordFailedLogin).toHaveBeenCalledWith('ghost@nowhere.com');
    expect(mocks.logger.logLoginFailed).toHaveBeenCalled();
  });

  it('returns null when password does not match any tenant user', async () => {
    mocks.prisma.usuarios.findMany.mockResolvedValue([makeUser()]);
    mocks.bcrypt.compare.mockResolvedValue(false);
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'wrong' });
    expect(result).toBeNull();
    expect(mocks.lockout.recordFailedLogin).toHaveBeenCalled();
    expect(mocks.logger.logLoginFailed).toHaveBeenCalled();
    expect(mocks.audit.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'login_fallido' }),
    );
  });

  it('skips users without password_hash (OAuth-only accounts)', async () => {
    const oauthOnly = makeUser({ id: 1, password_hash: null });
    const withPassword = makeUser({ id: 2 });
    mocks.prisma.usuarios.findMany.mockResolvedValue([oauthOnly, withPassword]);
    mocks.bcrypt.compare.mockResolvedValue(true);
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'x' });
    expect(result?.id).toBe('2');
    expect(mocks.bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('on multi-tenant email, returns the first user whose password matches', async () => {
    const tenant1 = makeUser({ id: 10, tenant_id: 100, password_hash: 'hash1' });
    const tenant2 = makeUser({ id: 20, tenant_id: 200, password_hash: 'hash2' });
    mocks.prisma.usuarios.findMany.mockResolvedValue([tenant1, tenant2]);
    // First user's password doesn't match, second does
    mocks.bcrypt.compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const result = await authorizeCredentials({ email: 'a@b.com', password: 'x' });
    expect(result?.id).toBe('20');
    expect(result?.tenantId).toBe(200);
  });

  it('returns a fully-populated payload on successful login', async () => {
    const user = makeUser();
    mocks.prisma.usuarios.findMany.mockResolvedValue([user]);
    mocks.bcrypt.compare.mockResolvedValue(true);
    const result = await authorizeCredentials({ email: 'Alice@Example.com', password: 'x' });
    expect(result).toEqual({
      id: '1',
      name: 'Alice',
      email: 'alice@example.com',
      tenantId: 42,
      tenantName: 'Acme Inc',
      areaId: 7,
      areaNombre: 'Finance',
      centroCostoId: 3,
      roles: ['solicitante'],
    });
    expect(mocks.lockout.clearFailedAttempts).toHaveBeenCalledWith('alice@example.com');
    expect(mocks.logger.logLoginSuccess).toHaveBeenCalled();
    expect(mocks.audit.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'login_exitoso' }),
    );
  });
});

// ── signInOAuth ──

describe('signInOAuth', () => {
  beforeEach(resetMocks);

  const baseAccount = { provider: 'google', providerAccountId: 'google-sub-123' };

  it('returns false when account is null or undefined', async () => {
    expect(await signInOAuth({ user: { email: 'a@b.com' }, account: null })).toBe(false);
    expect(await signInOAuth({ user: { email: 'a@b.com' }, account: undefined })).toBe(false);
  });

  it('returns false when user email is missing', async () => {
    expect(await signInOAuth({ user: {}, account: baseAccount })).toBe(false);
  });

  it('allows sign-in when existing user matches by oauth_provider + oauth_sub', async () => {
    mocks.prisma.usuarios.findFirst.mockResolvedValueOnce(makeUser({ oauth_provider: 'google' }));
    const result = await signInOAuth({
      user: { email: 'alice@example.com', name: 'Alice' },
      account: baseAccount,
    });
    expect(result).toBe(true);
    expect(mocks.audit.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'login_exitoso', datosNuevos: { metodo: 'google' } }),
    );
  });

  it('links OAuth to existing email user when SSO is enabled and domain matches', async () => {
    mocks.prisma.usuarios.findFirst
      .mockResolvedValueOnce(null) // no user by oauth_provider+sub
      .mockResolvedValueOnce(makeUser()); // found by email
    mocks.tenantConfig.getTenantConfigBool.mockResolvedValue(true);
    mocks.tenantConfig.getTenantConfig.mockResolvedValue('example.com');

    const result = await signInOAuth({
      user: { email: 'alice@example.com' },
      account: baseAccount,
    });

    expect(result).toBe(true);
    expect(mocks.prisma.usuarios.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { oauth_provider: 'google', oauth_sub: 'google-sub-123' },
    });
  });

  it('rejects sign-in when SSO is not enabled on the existing user tenant', async () => {
    mocks.prisma.usuarios.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser());
    mocks.tenantConfig.getTenantConfigBool.mockResolvedValue(false); // SSO disabled
    mocks.tenantConfig.getTenantConfig.mockResolvedValue('example.com');

    const result = await signInOAuth({
      user: { email: 'alice@example.com' },
      account: baseAccount,
    });

    expect(result).toBe(false);
    expect(mocks.prisma.usuarios.update).not.toHaveBeenCalled();
  });

  it('rejects sign-in when email domain does not match tenant SSO domain', async () => {
    mocks.prisma.usuarios.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser());
    mocks.tenantConfig.getTenantConfigBool.mockResolvedValue(true);
    mocks.tenantConfig.getTenantConfig.mockResolvedValue('other-company.com');

    const result = await signInOAuth({
      user: { email: 'alice@example.com' },
      account: baseAccount,
    });

    expect(result).toBe(false);
    expect(mocks.prisma.usuarios.update).not.toHaveBeenCalled();
  });

  it('auto-creates user when domain matches a tenant with SSO enabled', async () => {
    mocks.prisma.usuarios.findFirst
      .mockResolvedValueOnce(null) // no oauth match
      .mockResolvedValueOnce(null); // no email match
    mocks.prisma.tenants.findMany.mockResolvedValue([
      {
        id: 99,
        configuracion: [
          { clave: 'sso_google_habilitado', valor: 'true' },
          { clave: 'sso_dominio', valor: 'example.com' },
        ],
      },
    ]);
    mocks.prisma.roles.findFirst.mockResolvedValue({ id: 5, nombre: 'solicitante' });
    mocks.prisma.usuarios.create.mockResolvedValue({ id: 500, tenant_id: 99 });

    const result = await signInOAuth({
      user: { email: 'newuser@example.com', name: 'New User' },
      account: baseAccount,
    });

    expect(result).toBe(true);
    expect(mocks.prisma.usuarios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 99,
          email: 'newuser@example.com',
          oauth_provider: 'google',
          oauth_sub: 'google-sub-123',
          activo: true,
        }),
      }),
    );
    expect(mocks.prisma.usuarios_roles.create).toHaveBeenCalledWith({
      data: { usuario_id: 500, rol_id: 5 },
    });
  });

  it('rejects sign-in when no tenant matches the email domain', async () => {
    mocks.prisma.usuarios.findFirst.mockResolvedValue(null);
    mocks.prisma.tenants.findMany.mockResolvedValue([
      {
        id: 99,
        configuracion: [
          { clave: 'sso_google_habilitado', valor: 'true' },
          { clave: 'sso_dominio', valor: 'other.com' },
        ],
      },
    ]);

    const result = await signInOAuth({
      user: { email: 'newuser@example.com' },
      account: baseAccount,
    });

    expect(result).toBe(false);
    expect(mocks.prisma.usuarios.create).not.toHaveBeenCalled();
  });

  it('treats provider sso config value as boolean ("true" / "1" both allowed)', async () => {
    mocks.prisma.usuarios.findFirst.mockResolvedValue(null);
    mocks.prisma.tenants.findMany.mockResolvedValue([
      {
        id: 1,
        configuracion: [
          { clave: 'sso_google_habilitado', valor: '1' },
          { clave: 'sso_dominio', valor: 'example.com' },
        ],
      },
    ]);
    mocks.prisma.roles.findFirst.mockResolvedValue({ id: 5 });
    mocks.prisma.usuarios.create.mockResolvedValue({ id: 1, tenant_id: 1 });

    const result = await signInOAuth({
      user: { email: 'x@example.com' },
      account: baseAccount,
    });
    expect(result).toBe(true);
  });
});
