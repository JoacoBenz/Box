import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { tenantPrisma } from '@/lib/prisma';
import { apiError } from '@/lib/permissions';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = Number(id);
    if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

    const db = tenantPrisma(session.tenantId);

    const comentarios = await db.comentarios.findMany({
      where: { solicitud_id: solicitudId },
      include: {
        usuario: { select: { id: true, nombre: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json(comentarios);
  } catch (e: any) {
    if (e.message === 'No autenticado') {
      return apiError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return apiError('INTERNAL', 'Error cargando comentarios', 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const solicitudId = Number(id);
    if (isNaN(solicitudId)) return apiError('VALIDATION', 'ID inválido', 400);

    const body = await request.json();
    const mensaje = body.mensaje?.trim();

    if (!mensaje || mensaje.length < 1) {
      return apiError('VALIDATION', 'El comentario no puede estar vacío', 400);
    }
    if (mensaje.length > 2000) {
      return apiError('VALIDATION', 'El comentario no puede superar los 2000 caracteres', 400);
    }

    const db = tenantPrisma(session.tenantId);

    // Verify solicitud exists
    const solicitud = await db.solicitudes.findFirst({
      where: { id: solicitudId },
    });
    if (!solicitud) return apiError('NOT_FOUND', 'Solicitud no encontrada', 404);

    const comentario = await db.comentarios.create({
      data: {
        solicitud_id: solicitudId,
        usuario_id: session.userId,
        mensaje,
      } as any,
      include: { usuario: { select: { id: true, nombre: true } } },
    });

    return NextResponse.json(comentario, { status: 201 });
  } catch (e: any) {
    if (e.message === 'No autenticado') {
      return apiError('UNAUTHORIZED', 'No autenticado', 401);
    }
    return apiError('INTERNAL', 'Error creando comentario', 500);
  }
}
