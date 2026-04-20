/**
 * Pure auth callback logic extracted from the NextAuth config.
 *
 * Kept separate so tests can import without evaluating `NextAuth(...)`
 * at module load time (which reads env vars and would fail in unit tests).
 *
 * lib/auth.ts wires these into the NextAuth config.
 */
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { getTenantConfigBool, getTenantConfig } from './tenant-config';
import type { RolNombre } from '@/types';
import { checkRateLimit } from './rate-limit';
import { isAccountLocked, recordFailedLogin, clearFailedAttempts } from './account-lockout';
import { logLoginFailed, logAccountLocked, logRateLimited, logLoginSuccess } from './logger';
import { registrarAuditoria } from './audit';

/** Load a DB user with roles, tenant, area — shared by credentials & OAuth flows */
export async function loadUsuario(where: Record<string, unknown>) {
  return prisma.usuarios.findFirst({
    where: { ...where, activo: true, tenant: { estado: 'activo', desactivado: false } },
    include: {
      tenant: { select: { nombre: true } },
      usuarios_roles: { include: { rol: true } },
      area: true,
    },
  });
}

/** Load ALL matching users (for login with duplicate emails across tenants) */
export async function loadUsuarios(where: Record<string, unknown>) {
  return prisma.usuarios.findMany({
    where: { ...where, activo: true, tenant: { estado: 'activo', desactivado: false } },
    include: {
      tenant: { select: { nombre: true } },
      usuarios_roles: { include: { rol: true } },
      area: true,
    },
  });
}

export function userPayload(usuario: NonNullable<Awaited<ReturnType<typeof loadUsuario>>>) {
  return {
    id: String(usuario.id),
    name: usuario.nombre,
    email: usuario.email,
    tenantId: usuario.tenant_id,
    tenantName: usuario.tenant.nombre,
    areaId: usuario.area_id,
    areaNombre: usuario.area?.nombre ?? null,
    centroCostoId: usuario.centro_costo_id,
    roles: usuario.usuarios_roles.map((ur) => ur.rol.nombre as RolNombre),
  };
}

export type UserPayload = ReturnType<typeof userPayload>;

/** Credentials provider `authorize` callback. Returns user payload or null. */
export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password', unknown>> | undefined,
): Promise<UserPayload | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const email = (credentials.email as string).toLowerCase().trim();

  // Check account lockout
  const lockout = isAccountLocked(email);
  if (lockout.locked) {
    logAccountLocked(email, 'unknown', lockout.remainingMs);
    return null;
  }

  // Check rate limit
  const rateLimit = checkRateLimit(`login:${email}`, 10, 60_000);
  if (!rateLimit.allowed) {
    logRateLimited(`login:${email}`, 'unknown');
    return null;
  }

  // Find all matching users across tenants (case-insensitive)
  const usuarios = await loadUsuarios({ email: { equals: email, mode: 'insensitive' } });

  if (usuarios.length === 0) {
    const attempt = recordFailedLogin(email);
    logLoginFailed(email, 'unknown', attempt.attemptsRemaining);
    if (attempt.locked) logAccountLocked(email, 'unknown', 15 * 60 * 1000);
    // Use platform tenant + super_admin user for failed logins with unknown email
    const platformUser = await prisma.usuarios.findFirst({
      where: {
        tenant: { slug: '__platform__' },
        usuarios_roles: { some: { rol: { nombre: 'super_admin' } } },
      },
      select: { id: true, tenant_id: true },
    });
    if (platformUser) {
      registrarAuditoria({
        tenantId: platformUser.tenant_id,
        usuarioId: platformUser.id,
        accion: 'login_fallido',
        entidad: 'sesion',
        datosNuevos: { email: credentials.email, metodo: 'credentials' },
      }).catch(() => {});
    }
    return null;
  }

  // Try password against each matching user
  let usuario = null;
  for (const u of usuarios) {
    if (!u.password_hash) continue;
    const match = await bcrypt.compare(credentials.password as string, u.password_hash);
    if (match) {
      usuario = u;
      break;
    }
  }

  if (!usuario) {
    const attempt = recordFailedLogin(email);
    logLoginFailed(email, 'unknown', attempt.attemptsRemaining);
    if (attempt.locked) logAccountLocked(email, 'unknown', 15 * 60 * 1000);
    // Use first matched user's tenant for failed password attempts
    registrarAuditoria({
      tenantId: usuarios[0].tenant_id,
      usuarioId: usuarios[0].id,
      accion: 'login_fallido',
      entidad: 'sesion',
      datosNuevos: { email: credentials.email, metodo: 'credentials' },
    }).catch(() => {});
    return null;
  }

  clearFailedAttempts(email);
  logLoginSuccess(email, 'unknown', usuario.id);
  registrarAuditoria({
    tenantId: usuario.tenant_id,
    usuarioId: usuario.id,
    accion: 'login_exitoso',
    entidad: 'sesion',
    datosNuevos: { metodo: 'credentials' },
  }).catch(() => {});

  return userPayload(usuario);
}

/**
 * OAuth provider `signIn` callback. Returns true to allow sign-in, false to reject.
 * Credentials are validated in `authorizeCredentials` and always return true here.
 */
export async function signInOAuth(args: {
  user: { email?: string | null; name?: string | null };
  account: { provider: string; providerAccountId: string } | null | undefined;
}): Promise<boolean> {
  const { user, account } = args;
  if (!account || !user.email) return false;

  const provider = account.provider; // 'google' | 'microsoft-entra-id'
  const sub = account.providerAccountId;
  const email = user.email.toLowerCase().trim();
  const domain = email.split('@')[1];

  // First try to find by oauth_provider + oauth_sub
  let usuario = await loadUsuario({ oauth_provider: provider, oauth_sub: sub });

  if (!usuario) {
    // Try to find by email and link the OAuth account (case-insensitive)
    usuario = await loadUsuario({ email: { equals: email, mode: 'insensitive' } });
    if (usuario) {
      // Verify tenant has this SSO provider enabled
      const providerKey =
        provider === 'google' ? 'sso_google_habilitado' : 'sso_microsoft_habilitado';
      const ssoEnabled = await getTenantConfigBool(usuario.tenant_id, providerKey, false);
      const ssoDomain = await getTenantConfig(usuario.tenant_id, 'sso_dominio');

      if (!ssoEnabled || !ssoDomain || domain.toLowerCase() !== ssoDomain.toLowerCase()) {
        return false; // SSO not enabled or domain mismatch
      }

      // Link OAuth to existing user
      await prisma.usuarios.update({
        where: { id: usuario.id },
        data: { oauth_provider: provider, oauth_sub: sub },
      });
    }
  }

  if (usuario) {
    registrarAuditoria({
      tenantId: usuario.tenant_id,
      usuarioId: usuario.id,
      accion: 'login_exitoso',
      entidad: 'sesion',
      datosNuevos: { metodo: provider },
    }).catch(() => {});
    return true;
  }

  // No existing user — try to auto-create if domain matches a tenant with SSO enabled
  try {
    const tenants = await prisma.tenants.findMany({
      where: { estado: 'activo', desactivado: false },
      include: { configuracion: true },
    });

    for (const tenant of tenants) {
      const configs = Object.fromEntries(tenant.configuracion.map((c) => [c.clave, c.valor]));
      const providerKey =
        provider === 'google' ? 'sso_google_habilitado' : 'sso_microsoft_habilitado';
      const ssoEnabled = configs[providerKey] === 'true' || configs[providerKey] === '1';
      const ssoDomain = configs['sso_dominio'];

      if (ssoEnabled && ssoDomain && domain.toLowerCase() === ssoDomain.toLowerCase()) {
        // Auto-create user with no area (pending onboarding)
        const rolSolicitante = await prisma.roles.findFirst({
          where: { nombre: 'solicitante' },
        });
        const newUser = await prisma.usuarios.create({
          data: {
            tenant_id: tenant.id,
            nombre: user.name || email.split('@')[0],
            email,
            password_hash: '',
            oauth_provider: provider,
            oauth_sub: sub,
            activo: true,
          },
        });
        if (rolSolicitante) {
          await prisma.usuarios_roles.create({
            data: { usuario_id: newUser.id, rol_id: rolSolicitante.id },
          });
        }
        return true;
      }
    }
  } catch (err) {
    console.error('[SSO] Auto-create error:', err);
  }

  return false;
}
