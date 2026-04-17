import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id';
import { cached } from './cache';
import { getRolesEfectivos } from './delegaciones';
import { authorizeCredentials, signInOAuth, loadUsuario, userPayload } from './auth-callbacks';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: authorizeCredentials,
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
      return signInOAuth({ user, account });
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
    () => getRolesEfectivos(user.tenantId, Number(user.id), baseRoles),
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
