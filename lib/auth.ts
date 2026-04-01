import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { RolNombre } from '@/types';
import { checkRateLimit } from './rate-limit';
import { getRolesEfectivos } from './delegaciones';
import { isAccountLocked, recordFailedLogin, clearFailedAttempts } from './account-lockout';
import { cached } from './cache';
import { logLoginFailed, logAccountLocked, logRateLimited, logLoginSuccess } from './logger';

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

const usuario = await prisma.usuarios.findFirst({
          where: {
            email: credentials.email as string,
            activo: true,
            tenant: { estado: 'activo', desactivado: false },
          },
          include: {
            tenant: { select: { nombre: true } },
            usuarios_roles: {
              include: { rol: true },
            },
            area: true,
          },
        });

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

        return {
          id: String(usuario.id),
          name: usuario.nombre,
          email: usuario.email,
          tenantId: usuario.tenant_id,
          tenantName: usuario.tenant.nombre,
          areaId: usuario.area_id,
          areaNombre: usuario.area?.nombre ?? null,
          roles: usuario.usuarios_roles.map((ur) => ur.rol.nombre as RolNombre),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.tenantId = (user as any).tenantId;
        token.tenantName = (user as any).tenantName;
        token.areaId = (user as any).areaId;
        token.areaNombre = (user as any).areaNombre;
        token.roles = (user as any).roles;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.userId);
      (session.user as any).tenantId = token.tenantId as number;
      (session.user as any).tenantName = token.tenantName as string;
      (session.user as any).areaId = token.areaId as number | null;
      (session.user as any).areaNombre = token.areaNombre as string | null;
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
    roles: rolesEfectivos,
    delegaciones,
    nombre: user.name as string,
    email: user.email as string,
  };
}
