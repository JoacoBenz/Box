import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { area_id } = await request.json();
  const userId = Number(session.user.id);
  const tenantId = (session.user as any).tenantId;

  if (!area_id || typeof area_id !== 'number') {
    return NextResponse.json({ error: 'Área inválida' }, { status: 400 });
  }

  // Verify area belongs to user's tenant
  const area = await prisma.areas.findFirst({
    where: { id: area_id, tenant_id: tenantId },
  });

  if (!area) {
    return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 });
  }

  // Only allow if user has no area yet (onboarding)
  const user = await prisma.usuarios.findUnique({ where: { id: userId } });
  if (user?.area_id) {
    return NextResponse.json({ error: 'Ya tenés un área asignada' }, { status: 400 });
  }

  await prisma.usuarios.update({
    where: { id: userId },
    data: { area_id },
  });

  return NextResponse.json({ ok: true });
}
