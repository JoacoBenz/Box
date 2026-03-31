import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { RolNombre } from '@/types';

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

        // DEV BYPASS — remove before production
        if (process.env.NODE_ENV === 'development' && credentials.email === 'dev@test.com' && credentials.password === 'dev') {
          return {
            id: '1',
            name: 'Admin Dev',
            email: 'dev@test.com',
            tenantId: 1,
            tenantName: 'Org Dev',
            areaId: null,
            areaNombre: null,
            roles: ['admin', 'director'] as RolNombre[],
          };
        }

        const usuario = await prisma.usuarios.findFirst({
          where: {
            email: credentials.email as string,
            activo: true,
          },
          include: {
            tenant: { select: { nombre: true } },
            usuarios_roles: {
              include: { rol: true },
            },
            area: true,
          },
        });

        if (!usuario) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          usuario.password_hash
        );
        if (!passwordMatch) return null;

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
  return {
    userId: Number(user.id),
    tenantId: user.tenantId as number,
    areaId: user.areaId as number | null,
    areaNombre: user.areaNombre as string | null,
    roles: user.roles as RolNombre[],
    nombre: user.name as string,
    email: user.email as string,
  };
}
