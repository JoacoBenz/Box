import { cookies } from 'next/headers';
import { getServerSession } from '@/lib/auth';

const COOKIE_NAME = 'admin_tenant_id';

/**
 * For API routes: returns the effective tenant ID considering admin override.
 * If the logged-in user is admin and has a tenant override cookie/param, use that.
 * Otherwise, use their own tenant.
 */
export async function getEffectiveTenantId(request?: Request | { nextUrl: { searchParams: URLSearchParams } }): Promise<{ session: Awaited<ReturnType<typeof getServerSession>>; effectiveTenantId: number | null }> {
  const session = await getServerSession();

  let overrideId: number | null = null;

  // Check query param first (for API routes)
  if (request) {
    let paramVal: string | null = null;
    if ('nextUrl' in request) {
      paramVal = request.nextUrl.searchParams.get('tenantId');
    } else {
      const url = new URL(request.url);
      paramVal = url.searchParams.get('tenantId');
    }
    if (paramVal) overrideId = Number(paramVal);
  }

  // Fall back to cookie
  if (!overrideId) {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(COOKIE_NAME)?.value;
    if (cookieVal) overrideId = Number(cookieVal);
  }

  // Admins: use override if set, otherwise null (= all tenants)
  // Non-admins: always their own tenant
  if (session.roles.includes('admin')) {
    return { session, effectiveTenantId: overrideId ?? null };
  }

  return { session, effectiveTenantId: session.tenantId };
}

/**
 * For server components: read the admin tenant override from cookies.
 */
export async function getServerTenantId(session: { tenantId: number; roles: string[] }): Promise<number | null> {
  if (!session.roles.includes('admin')) return session.tenantId;

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieVal) return Number(cookieVal);

  return null;
}
