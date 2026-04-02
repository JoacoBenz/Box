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
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;

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

        const usuario = await loadUsuario({ email: credentials.email as string });

        if (!usuario) {
          const attempt = recordFailedLogin(email);
          logLoginFailed(email, 'unknown', attempt.attemptsRemaining);
          if (attempt.locked) logAccountLocked(email, 'unknown', 15 * 60 * 1000);
          return null;
        }

        if (!usuario.password_hash) {
          return null; // OAuth-only user, can't use password login
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          usuario.password_hash
        );
        if (!passwordMatch) {
          const attempt = recordFailedLogin(email);
          logLoginFailed(email, 'unknown', attempt.attemptsRemaining);
          if (attempt.locked) logAccountLocked(email, 'unknown', 15 * 60 * 1000);
          return null;
        }

        clearFailedAttempts(email);
        logLoginSuccess(email, 'unknown', usuario.id);

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
      const email = user.email;
      const domain = email.split('@')[1];

      // First try to find by oauth_provider + oauth_sub
      let usuario = await loadUsuario({ oauth_provider: provider, oauth_sub: sub });

      if (!usuario) {
        // Try to find by email and link the OAuth account
        usuario = await loadUsuario({ email });
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

      if (!usuario) {
        // No existing user — redirect to login with error
        return false;
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user && account?.provider === 'credentials') {
        // Credentials: user payload already set by authorize()
        token.userId = Number(user.id);
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
        token.areaId = (user as any).areaId;
        token.areaNombre = (user as any).areaNombre;
        token.centroCostoId = (user as any).centroCostoId;
        token.roles = (user as any).roles;
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
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = String(token.userId);
      (session.user as any).tenantId = token.tenantId as number;
      (session.user as any).tenantName = token.tenantName as string;
      (session.user as any).areaId = token.areaId as number | null;
      (session.user as any).areaNombre = token.areaNombre as string | null;
      (session.user as any).centroCostoId = token.centroCostoId as number | null;
      (session.user as any).roles = token.roles as RolNombre[];
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
  const user = session.user as any;
  const baseRoles = user.roles as RolNombre[];

  // Enrich with delegated roles (cached 5min per user)
  const { roles: rolesEfectivos, delegaciones } = await cached(
    `t:${user.tenantId}:roles:${user.id}`,
    5 * 60 * 1000,
    () => getRolesEfectivos(user.tenantId as number, Number(user.id), baseRoles)
  );

  return {
    userId: Number(user.id),
    tenantId: user.tenantId as number,
    areaId: user.areaId as number | null,
    areaNombre: user.areaNombre as string | null,
    centroCostoId: user.centroCostoId as number | null,
    roles: rolesEfectivos,
    delegaciones,
    nombre: user.name as string,
    email: user.email as string,
  };
}
