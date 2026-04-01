import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedUrl, deleteFile } from '@/lib/supabase';
import { verificarRol } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const archivoId = parseInt(id);

    const archivo = await prisma.archivos.findFirst({ where: { id: archivoId, tenant_id: session.tenantId } });
    if (!archivo) return Response.json({ error: { code: 'NOT_FOUND', message: 'Archivo no encontrado' } }, { status: 404 });

    const signedUrl = await getSignedUrl(archivo.ruta_archivo);
    return Response.redirect(signedUrl);
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession();
    const { id } = await params;
    const archivoId = parseInt(id);

    const archivo = await prisma.archivos.findFirst({ where: { id: archivoId, tenant_id: session.tenantId } });
    if (!archivo) return Response.json({ error: { code: 'NOT_FOUND', message: 'Archivo no encontrado' } }, { status: 404 });

    const esOwner = archivo.subido_por_id === session.userId;
    const esAdmin = verificarRol(session.roles, ['admin']);
    if (!esOwner && !esAdmin) {
      return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso para eliminar este archivo' } }, { status: 403 });
    }

    await deleteFile(archivo.ruta_archivo);
    await prisma.archivos.delete({ where: { id: archivoId } });

    return Response.json({ message: 'Archivo eliminado' });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
