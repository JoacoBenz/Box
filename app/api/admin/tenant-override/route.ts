import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getServerSession } from '@/lib/auth';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_tenant_id';

const bodySchema = z.object({
  tenantId: z.number().int().positive().nullable().optional(),
});

/** Returns the currently selected admin tenant override (null if none). */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session.roles.includes('super_admin')) {
      return Response.json({ tenantId: null }, { status: 200 });
    }
    const store = await cookies();
    const raw = store.get(COOKIE_NAME)?.value;
    const tenantId = raw ? Number(raw) : null;
    return Response.json({
      tenantId: Number.isFinite(tenantId) && tenantId! > 0 ? tenantId : null,
    });
  } catch (error: any) {
    if (error.message === 'No autenticado')
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: 'Internal' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session.roles.includes('super_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { tenantId } = parsed.data;
    const cookieStore = await cookies();

    if (tenantId) {
      cookieStore.set(COOKIE_NAME, String(tenantId), {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24h
      });
    } else {
      cookieStore.delete(COOKIE_NAME);
    }

    return Response.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'No autenticado')
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return Response.json({ error: 'Internal' }, { status: 500 });
  }
}
