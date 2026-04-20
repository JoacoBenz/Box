import { withTenant, withAuth, parseId } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { getSignedUrl, deleteFile } from '@/lib/supabase';
import { verificarRol } from '@/lib/permissions';

export const GET = withTenant(async (_request, { session }, params) => {
  const archivoId = parseId(params.id);
  if (!archivoId)
    return Response.json(
      { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
      { status: 400 },
    );

  const archivo = await prisma.archivos.findFirst({
    where: { id: archivoId, tenant_id: session.tenantId },
  });
  if (!archivo)
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Archivo no encontrado' } },
      { status: 404 },
    );

  const signedUrl = await getSignedUrl(archivo.ruta_archivo);
  return Response.redirect(signedUrl);
});

export const DELETE = withTenant(async (_request, { session }, params) => {
  const archivoId = parseId(params.id);
  if (!archivoId)
    return Response.json(
      { error: { code: 'BAD_REQUEST', message: 'ID inválido' } },
      { status: 400 },
    );

  const archivo = await prisma.archivos.findFirst({
    where: { id: archivoId, tenant_id: session.tenantId },
  });
  if (!archivo)
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Archivo no encontrado' } },
      { status: 404 },
    );

  const esOwner = archivo.subido_por_id === session.userId;
  const esAdmin = verificarRol(session.roles, ['admin']);
  if (!esOwner && !esAdmin) {
    return Response.json(
      { error: { code: 'FORBIDDEN', message: 'Sin permiso para eliminar este archivo' } },
      { status: 403 },
    );
  }

  await deleteFile(archivo.ruta_archivo);
  await prisma.archivos.delete({ where: { id: archivoId } });

  return Response.json({ message: 'Archivo eliminado' });
});
