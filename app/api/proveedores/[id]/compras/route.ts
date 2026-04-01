import { NextResponse } from 'next/server';
import { tenantPrisma, prisma } from '@/lib/prisma';
import { getEffectiveTenantId } from '@/lib/tenant-override';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { effectiveTenantId } = await getEffectiveTenantId(request);
  const { id } = await params;
  const proveedorId = Number(id);
  if (isNaN(proveedorId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = effectiveTenantId ? tenantPrisma(effectiveTenantId) : prisma;

  const [proveedor, solicitudes, compras] = await Promise.all([
    db.proveedores.findUnique({
      where: { id: proveedorId },
      select: { id: true, nombre: true, cuit: true, email: true, telefono: true },
    }),
    db.solicitudes.findMany({
      where: { proveedor_id: proveedorId },
      select: {
        id: true,
        numero: true,
        titulo: true,
        estado: true,
        urgencia: true,
        monto_estimado_total: true,
        created_at: true,
        solicitante: { select: { nombre: true } },
        area: { select: { nombre: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
    db.compras.findMany({
      where: { proveedor_id: proveedorId },
      select: {
        id: true,
        solicitud_id: true,
        proveedor_nombre: true,
        fecha_compra: true,
        monto_total: true,
        medio_pago: true,
        numero_factura: true,
        observaciones: true,
        solicitud: { select: { numero: true, titulo: true } },
        ejecutado_por: { select: { nombre: true } },
      },
      orderBy: { fecha_compra: 'desc' },
    }),
  ]);

  if (!proveedor) {
    return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ proveedor, solicitudes, compras });
}
