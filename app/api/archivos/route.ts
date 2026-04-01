import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/supabase';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const formData = await request.formData();
    const archivo = formData.get('archivo') as File | null;
    const entidad = formData.get('entidad') as string;
    const entidadId = parseInt(formData.get('entidad_id') as string);

    if (!archivo || !entidad || !entidadId) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Faltan campos obligatorios' } }, { status: 400 });
    }
    if (!['solicitud', 'compra', 'recepcion'].includes(entidad)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Entidad inválida' } }, { status: 400 });
    }

    // Verify user has access to the entity
    if (entidad === 'solicitud') {
      const sol = await prisma.solicitudes.findFirst({ where: { id: entidadId, tenant_id: session.tenantId } });
      if (!sol) return Response.json({ error: { code: 'NOT_FOUND', message: 'Solicitud no encontrada' } }, { status: 404 });
    } else if (entidad === 'compra') {
      const compra = await prisma.compras.findFirst({ where: { id: entidadId, tenant_id: session.tenantId } });
      if (!compra) return Response.json({ error: { code: 'NOT_FOUND', message: 'Compra no encontrada' } }, { status: 404 });
    }
    if (!ALLOWED_TYPES.includes(archivo.type)) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'Tipo de archivo no permitido' } }, { status: 400 });
    }
    if (archivo.size > MAX_SIZE) {
      return Response.json({ error: { code: 'BAD_REQUEST', message: 'El archivo no puede superar 10MB' } }, { status: 400 });
    }

    const { path } = await uploadFile(session.tenantId, entidad, entidadId, archivo);

    const registro = await prisma.archivos.create({
      data: {
        tenant_id: session.tenantId,
        entidad,
        entidad_id: entidadId,
        nombre_archivo: archivo.name,
        ruta_archivo: path,
        tamanio_bytes: archivo.size,
        subido_por_id: session.userId,
      },
    });

    return Response.json(registro, { status: 201 });
  } catch (error: any) {
    if (error.message === 'No autenticado') return Response.json({ error: { code: 'UNAUTHORIZED', message: 'No autenticado' } }, { status: 401 });
    return Response.json({ error: { code: 'INTERNAL', message: 'Error interno' } }, { status: 500 });
  }
}
