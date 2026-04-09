import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_tenant_id';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.roles.includes('super_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tenantId } = await request.json();
    const cookieStore = await cookies();

    if (tenantId) {
      cookieStore.set(COOKIE_NAME, String(tenantId), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24h
      });
    } else {
      cookieStore.delete(COOKIE_NAME);
    }

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: 'Internal' }, { status: 500 });
  }
}
