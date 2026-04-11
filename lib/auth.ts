import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { getTenantConfigBool, getTenantConfig } from './tenant-config';
import type { RolNombre } from '@/types';
import { checkRateLimit } from './rate-limit';
import { getRolesEfectivos } from './delegaciones';
import { isAccountLocked, recordFailedLogin, clearFailedAttempts } from './account-lockout';
import { cached } from './cache';
import { logLoginFailed, logAccountLocked, logRateLimited, logLoginSuccess } from './logger';
import { registrarAuditoria } from './audit';

/** Load a DB user with roles, tenant, area — shared by credentials & OAuth flows */
async function loadUsuario(where: Record<string, unknown>) {
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
async function loadUsuarios(where: Record<string, unknown>) {
  return prisma.usuarios.findMany({
    where: { ...where, activo: true, tenant: { estado: 'activo', desactivado: false } },
    include: {
      tenant: { select: { nombre: true } },
      usuarios_roles: { include: { rol: true } },
      area: true,
    },
  });
}

function userPayload(usuario: NonNullable<Awaited<ReturnType<typeof loadUsuario>>>) {
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
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
            where: { tenant: { slug: '__platform__' }, usuarios_roles: { some: { rol: { nombre: 'super_admin' } } } },
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
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.AUTH_GOOGLE_CLIENT_SECRET,
    }),
    MicrosoftEntraId({
      clientId: process.env.AUTH_MICROSOFT_CLIENT_ID,
      clientSecret: process.env.AUTH_MICROSOFT_CLIENT_SECRET,
      issuer: process.env.AUTH_MICROSOFT_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_TENANT_ID}/v2.0`
        : undefined,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials flow is already validated in authorize()
      if (account?.provider === 'credentials') return true;

      // OAuth flow: verify user exists in DB with matching provider+sub
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
          const providerKey = provider === 'google' ? 'sso_google_habilitado' : 'sso_microsoft_habilitado';
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
      }

      if (!usuario) {
        // No existing user — try to auto-create if domain matches a tenant with SSO enabled
        try {
          const providerKey = provider === 'google' ? 'sso_google_habilitado' : 'sso_microsoft_habilitado';

          // Targeted query: find tenant whose sso_dominio matches the email domain
          const matchingConfig = await prisma.configuracion.findFirst({
            where: { clave: 'sso_dominio', valor: { equals: domain, mode: 'insensitive' } },
            select: { tenant_id: true },
          });

          if (matchingConfig) {
            // Check if the SSO provider is enabled for that tenant
            const providerEnabled = await prisma.configuracion.findFirst({
              where: { tenant_id: matchingConfig.tenant_id, clave: providerKey, valor: { in: ['true', '1'] } },
            });

            if (providerEnabled) {
              // Verify the tenant is active
              const tenant = await prisma.tenants.findFirst({
                where: { id: matchingConfig.tenant_id, estado: 'activo', desactivado: false },
              });

              if (tenant) {
                // Auto-create user with no area (pending onboarding)
                const rolSolicitante = await prisma.roles.findFirst({ where: { nombre: 'solicitante' } });
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
          }
        } catch (err) {
          console.error('[SSO] Auto-create error:', err);
        }

        return false;
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        // Credentials: user payload already set by authorize()
        token.userId = Number(user.id);
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.areaId = user.areaId;
        token.areaNombre = user.areaNombre;
        token.centroCostoId = user.centroCostoId;
        token.roles = user.roles;
      } else if (account && account.provider !== 'credentials') {
        // OAuth: load user from DB
        const usuario = await loadUsuario({
          oauth_provider: account.provider,
          oauth_sub: account.providerAccountId,
        });
        if (usuario) {
          const payload = userPayload(usuario);
          token.userId = Number(payload.id);
          token.tenantId = payload.tenantId;
          token.tenantName = payload.tenantName;
          token.areaId = payload.areaId;
          token.areaNombre = payload.areaNombre;
          token.centroCostoId = payload.centroCostoId;
          token.roles = payload.roles;
        }
      } else if (token.userId) {
        // Subsequent requests: refresh roles and user data from DB
        const usuario = await cached(
          `user:${token.userId}:session`,
          30_000, // 30s TTL — roles update within 30s of change
          () => loadUsuario({ id: Number(token.userId) }),
        );
        if (usuario) {
          const payload = userPayload(usuario);
          token.roles = payload.roles;
          token.areaId = payload.areaId;
          token.areaNombre = payload.areaNombre;
          token.centroCostoId = payload.centroCostoId;
          token.tenantName = payload.tenantName;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = String(token.userId);
      session.user.tenantId = token.tenantId;
      session.user.tenantName = token.tenantName;
      session.user.areaId = token.areaId;
      session.user.areaNombre = token.areaNombre;
      session.user.centroCostoId = token.centroCostoId;
      session.user.roles = token.roles;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export async function getServerSession() {
  const session = await auth();
  if (!session?.user) throw new Error('No autenticado');
  const user = session.user;
  const baseRoles = user.roles;

  // Enrich with delegated roles (cached 5min per user)
  const { roles: rolesEfectivos, delegaciones } = await cached(
    `t:${user.tenantId}:roles:${user.id}`,
    5 * 60 * 1000,
    () => getRolesEfectivos(user.tenantId, Number(user.id), baseRoles)
  );

  return {
    userId: Number(user.id),
    tenantId: user.tenantId,
    areaId: user.areaId,
    areaNombre: user.areaNombre,
    centroCostoId: user.centroCostoId,
    roles: rolesEfectivos,
    delegaciones,
    nombre: user.name as string,
    email: user.email as string,
  };
}
