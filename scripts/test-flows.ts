/**
 * E2E Flow Tester — tests all workflow state transitions via API
 * Run: set -a && source .env.local && set +a && npx tsx scripts/test-flows.ts
 */
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:3000';
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(email: string): Promise<string> {
  // Get CSRF token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const cookies = csrfRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = cookies.find(c => c.includes('authjs.csrf-token') || c.includes('next-auth'));
  const allCookies = cookies.map(c => c.split(';')[0]).join('; ');

  // Sign in
  const signInRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: allCookies },
    body: new URLSearchParams({ email, password: 'Testing123!', csrfToken, redirect: 'false' }),
    redirect: 'manual',
  });

  const signInCookies = signInRes.headers.getSetCookie?.() ?? [];
  const allAfter = [...cookies, ...signInCookies].map(c => c.split(';')[0]).join('; ');

  // Follow redirect to get session token
  const loc = signInRes.headers.get('location');
  if (loc) {
    const followRes = await fetch(loc.startsWith('http') ? loc : `${BASE}${loc}`, {
      headers: { Cookie: allAfter },
      redirect: 'manual',
    });
    const moreCookies = followRes.headers.getSetCookie?.() ?? [];
    const finalCookies = [...cookies, ...signInCookies, ...moreCookies].map(c => c.split(';')[0]).join('; ');
    return finalCookies;
  }

  return allAfter;
}

async function api(method: string, path: string, cookies: string, body?: any): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function apiFormData(method: string, path: string, cookies: string, formData: FormData): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookies },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function makeDummyFile(name = 'comprobante.pdf'): Blob {
  return new Blob(['%PDF-1.4 dummy content for testing'], { type: 'application/pdf' });
}

function buildCompraFormData(fields: Record<string, any>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v != null) fd.append(k, String(v));
  }
  fd.append('comprobante', makeDummyFile(), 'comprobante.pdf');
  return fd;
}

async function getSolicitudEstado(id: number): Promise<string> {
  const sol = await prisma.solicitudes.findUnique({ where: { id } });
  return sol?.estado ?? 'NOT_FOUND';
}

// ─── Test Runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    const msg = `  ❌ ${testName}${detail ? ` — ${detail}` : ''}`;
    console.log(msg);
    failures.push(msg);
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

async function createSolicitud(cookies: string, titulo: string): Promise<number> {
  const { data } = await api('POST', '/api/solicitudes', cookies, {
    titulo,
    descripcion: 'Descripción detallada del pedido para testing del flujo completo de la aplicación',
    justificacion: 'Justificación necesaria para realizar pruebas automatizadas del sistema de compras',
    urgencia: 'normal',
    items: [
      { descripcion: 'Item de prueba número uno', cantidad: 10, unidad: 'unidad', precio_estimado: 100 },
      { descripcion: 'Item de prueba número dos', cantidad: 5, unidad: 'unidad', precio_estimado: 200 },
    ],
  });
  return data.id;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔐 Logging in all users...\n');

  const juan = await login('solicitante@escuelatest.com');
  const maria = await login('responsable@escuelatest.com');
  const ana = await login('directora@escuelatest.com');
  const pedro = await login('compras@escuelatest.com');
  const laura = await login('tesoreria@escuelatest.com');
  const carlos = await login('admin@escuelatest.com');

  console.log('  All logins complete.\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 1: Camino feliz completo (con validación + compras)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('══════════════════════════════════════════════');
  console.log('FLUJO 1: Camino feliz completo');
  console.log('══════════════════════════════════════════════');

  const f1Id = await createSolicitud(juan, 'Flujo 1 - Camino feliz');
  assert(!!f1Id, 'F1.1 Crear solicitud', `id=${f1Id}`);
  assert(await getSolicitudEstado(f1Id) === 'borrador', 'F1.1 Estado = borrador');

  let res = await api('POST', `/api/solicitudes/${f1Id}/enviar`, juan);
  assert(res.status === 200, 'F1.2 Enviar solicitud', `status=${res.status}`);
  assert(await getSolicitudEstado(f1Id) === 'enviada', 'F1.2 Estado = enviada');

  res = await api('POST', `/api/solicitudes/${f1Id}/validar`, maria);
  assert(res.status === 200, 'F1.3 María valida', `status=${res.status}`);
  assert(await getSolicitudEstado(f1Id) === 'validada', 'F1.3 Estado = validada');

  res = await api('POST', `/api/solicitudes/${f1Id}/aprobar`, ana);
  assert(res.status === 200, 'F1.4 Ana aprueba', `status=${res.status}`);
  const f1EstadoAprobada = await getSolicitudEstado(f1Id);
  assert(f1EstadoAprobada === 'en_compras' || f1EstadoAprobada === 'aprobada', 'F1.4 Estado = en_compras o aprobada', `actual=${f1EstadoAprobada}`);

  // Pedro processes and schedules payment
  if (f1EstadoAprobada === 'en_compras') {
    res = await api('POST', `/api/solicitudes/${f1Id}/procesar-compras`, pedro, {
      prioridad_compra: 'normal',
      dia_pago_programado: '2026-04-15',
    });
    // procesar-compras may transition to pago_programado or stay in en_compras
    // then programar-pago transitions to pago_programado
    const f1PostProcesar = await getSolicitudEstado(f1Id);
    if (f1PostProcesar === 'en_compras') {
      res = await api('POST', `/api/solicitudes/${f1Id}/programar-pago`, pedro, { dia_pago_programado: '2026-04-15' });
    }
    assert(res.status === 200, 'F1.5 Pedro programa pago', `status=${res.status}`);
    assert(await getSolicitudEstado(f1Id) === 'pago_programado', 'F1.5 Estado = pago_programado');
  }

  // Laura registers purchase
  const provRes = await api('GET', '/api/proveedores', laura);
  let proveedorId: number | null = provRes.data?.[0]?.id ?? null;
  if (!proveedorId) {
    const newProv = await api('POST', '/api/proveedores', laura, { nombre: 'Proveedor Test', cuit: '20-12345678-9' });
    proveedorId = newProv.data?.id;
  }

  res = await apiFormData('POST', '/api/compras', laura, buildCompraFormData({
    solicitud_id: f1Id,
    proveedor_id: proveedorId,
    proveedor_nombre: 'Proveedor Test',
    monto_total: 1500,
    medio_pago: 'transferencia',
    referencia_bancaria: 'TRF-001',
    fecha_compra: '2026-04-06',
    numero_factura: `A-0001-${String(Date.now()).slice(-8)}`,
  }));
  assert(res.status === 200 || res.status === 201, 'F1.6 Laura registra compra', `status=${res.status} ${JSON.stringify(res.data?.error ?? '')}`);
  assert(await getSolicitudEstado(f1Id) === 'abonada', 'F1.6 Estado = abonada', `actual=${await getSolicitudEstado(f1Id)}`);

  // Juan confirms reception
  res = await api('POST', '/api/recepciones', juan, {
    solicitud_id: f1Id,
    conforme: true,
    observaciones: null,
    items: [],
  });
  assert(res.status === 200 || res.status === 201, 'F1.7 Juan recepción conforme', `status=${res.status} ${JSON.stringify(res.data?.error ?? '')}`);
  const f1Final = await getSolicitudEstado(f1Id);
  assert(['recibida', 'cerrada'].includes(f1Final), 'F1.7 Estado final = recibida o cerrada', `actual=${f1Final}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 2: Devolución por responsable
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 2: Devolución por responsable');
  console.log('══════════════════════════════════════════════');

  const f2Id = await createSolicitud(juan, 'Flujo 2 - Devolución resp');
  await api('POST', `/api/solicitudes/${f2Id}/enviar`, juan);
  assert(await getSolicitudEstado(f2Id) === 'enviada', 'F2.1 Enviada');

  res = await api('POST', `/api/solicitudes/${f2Id}/devolver`, maria, { observaciones: 'Falta justificación detallada', origen: 'responsable' });
  assert(res.status === 200, 'F2.2 María devuelve', `status=${res.status}`);
  assert(await getSolicitudEstado(f2Id) === 'devuelta_resp', 'F2.2 Estado = devuelta_resp');

  // Juan can re-send
  res = await api('POST', `/api/solicitudes/${f2Id}/enviar`, juan);
  assert(res.status === 200, 'F2.3 Juan re-envía', `status=${res.status}`);
  assert(await getSolicitudEstado(f2Id) === 'enviada', 'F2.3 Estado = enviada');

  // María validates
  res = await api('POST', `/api/solicitudes/${f2Id}/validar`, maria);
  assert(res.status === 200, 'F2.4 María valida', `status=${res.status}`);
  assert(await getSolicitudEstado(f2Id) === 'validada', 'F2.4 Estado = validada');

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 3: Devolución por director
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 3: Devolución por director');
  console.log('══════════════════════════════════════════════');

  const f3Id = await createSolicitud(juan, 'Flujo 3 - Devolución dir');
  await api('POST', `/api/solicitudes/${f3Id}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f3Id}/validar`, maria);
  assert(await getSolicitudEstado(f3Id) === 'validada', 'F3.1 Validada');

  res = await api('POST', `/api/solicitudes/${f3Id}/devolver`, ana, { observaciones: 'Presupuesto excesivo, revisar alternativas', origen: 'director' });
  assert(res.status === 200, 'F3.2 Ana devuelve', `status=${res.status}`);
  assert(await getSolicitudEstado(f3Id) === 'devuelta_dir', 'F3.2 Estado = devuelta_dir');

  // Juan re-sends
  res = await api('POST', `/api/solicitudes/${f3Id}/enviar`, juan);
  assert(res.status === 200, 'F3.3 Juan re-envía', `status=${res.status}`);
  assert(await getSolicitudEstado(f3Id) === 'enviada', 'F3.3 Estado = enviada');

  // devuelta_dir can also be re-validated directly
  const f3bId = await createSolicitud(juan, 'Flujo 3b - Revalidar devuelta_dir');
  await api('POST', `/api/solicitudes/${f3bId}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f3bId}/validar`, maria);
  await api('POST', `/api/solicitudes/${f3bId}/devolver`, ana, { observaciones: 'Revisar los montos estimados', origen: 'director' });
  assert(await getSolicitudEstado(f3bId) === 'devuelta_dir', 'F3b.1 devuelta_dir');

  res = await api('POST', `/api/solicitudes/${f3bId}/validar`, maria);
  assert(res.status === 200, 'F3b.2 María re-valida devuelta_dir', `status=${res.status}`);
  assert(await getSolicitudEstado(f3bId) === 'validada', 'F3b.2 Estado = validada');

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 4: Rechazo
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 4: Rechazo');
  console.log('══════════════════════════════════════════════');

  const f4Id = await createSolicitud(juan, 'Flujo 4 - Rechazo');
  await api('POST', `/api/solicitudes/${f4Id}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f4Id}/validar`, maria);
  assert(await getSolicitudEstado(f4Id) === 'validada', 'F4.1 Validada');

  res = await api('POST', `/api/solicitudes/${f4Id}/rechazar`, ana, { motivo: 'No hay presupuesto' });
  assert(res.status === 200, 'F4.2 Ana rechaza', `status=${res.status}`);
  assert(await getSolicitudEstado(f4Id) === 'rechazada', 'F4.2 Estado = rechazada (terminal)');

  // Cannot enviar from rechazada
  res = await api('POST', `/api/solicitudes/${f4Id}/enviar`, juan);
  assert(res.status !== 200, 'F4.3 No se puede re-enviar rechazada', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 5: Anulación desde distintos estados
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 5: Anulación');
  console.log('══════════════════════════════════════════════');

  // 5a: Anular desde enviada (solicitante owner)
  const f5aId = await createSolicitud(juan, 'Flujo 5a - Anular enviada');
  await api('POST', `/api/solicitudes/${f5aId}/enviar`, juan);
  res = await api('POST', `/api/solicitudes/${f5aId}/anular`, juan, { motivo: 'Ya no necesito este pedido' });
  assert(res.status === 200, 'F5a Anular desde enviada (owner)', `status=${res.status}`);
  assert(await getSolicitudEstado(f5aId) === 'anulada', 'F5a Estado = anulada');

  // 5b: Anular desde validada (directora)
  const f5bId = await createSolicitud(juan, 'Flujo 5b - Anular validada');
  await api('POST', `/api/solicitudes/${f5bId}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f5bId}/validar`, maria);
  res = await api('POST', `/api/solicitudes/${f5bId}/anular`, ana, { motivo: 'Cancelado por decisión de dirección' });
  assert(res.status === 200, 'F5b Anular desde validada (directora)', `status=${res.status}`);
  assert(await getSolicitudEstado(f5bId) === 'anulada', 'F5b Estado = anulada');

  // 5c: Anular desde aprobada/en_compras (admin)
  const f5cId = await createSolicitud(juan, 'Flujo 5c - Anular en_compras');
  await api('POST', `/api/solicitudes/${f5cId}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f5cId}/validar`, maria);
  await api('POST', `/api/solicitudes/${f5cId}/aprobar`, ana);
  const f5cEstado = await getSolicitudEstado(f5cId);
  res = await api('POST', `/api/solicitudes/${f5cId}/anular`, carlos, { motivo: 'Admin cancela esta solicitud' });
  assert(res.status === 200, `F5c Anular desde ${f5cEstado} (admin)`, `status=${res.status}`);
  assert(await getSolicitudEstado(f5cId) === 'anulada', 'F5c Estado = anulada');

  // 5d: NO anular desde borrador
  const f5dId = await createSolicitud(juan, 'Flujo 5d - No anular borrador');
  res = await api('POST', `/api/solicitudes/${f5dId}/anular`, juan, { motivo: 'Test de anulación desde borrador' });
  assert(res.status !== 200, 'F5d No anular borrador', `status=${res.status}`);

  // 5e: NO anular desde abonada
  // (need to get to abonada first - go through full flow)
  const f5eId = await createSolicitud(juan, 'Flujo 5e - No anular abonada');
  await api('POST', `/api/solicitudes/${f5eId}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f5eId}/validar`, maria);
  await api('POST', `/api/solicitudes/${f5eId}/aprobar`, ana);
  // Go through en_compras → pago_programado → abonada
  const f5eEstado = await getSolicitudEstado(f5eId);
  if (f5eEstado === 'en_compras') {
    await api('POST', `/api/solicitudes/${f5eId}/programar-pago`, pedro, { dia_pago_programado: '2026-04-15' });
  }
  await apiFormData('POST', '/api/compras', laura, buildCompraFormData({
    solicitud_id: f5eId,
    proveedor_id: proveedorId,
    proveedor_nombre: 'Proveedor Test',
    monto_total: 500,
    medio_pago: 'efectivo',
    fecha_compra: '2026-04-06',
  }));
  assert(await getSolicitudEstado(f5eId) === 'abonada', 'F5e Llegó a abonada');
  res = await api('POST', `/api/solicitudes/${f5eId}/anular`, ana, { motivo: 'Test anulación desde abonada' });
  assert(res.status !== 200, 'F5e No anular abonada', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 6: Recepción con observaciones → Cierre
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 6: Recepción con obs → Cierre');
  console.log('══════════════════════════════════════════════');

  // Use f5eId which is in abonada
  res = await api('POST', '/api/recepciones', juan, {
    solicitud_id: f5eId,
    conforme: false,
    tipo_problema: 'dañado',
    observaciones: 'Llegó dañado un item, hay que devolver',
  });
  assert(res.status === 200 || res.status === 201, 'F6.1 Recepción no conforme', `status=${res.status} ${JSON.stringify(res.data?.error ?? '')}`);
  const f6Estado = await getSolicitudEstado(f5eId);
  assert(f6Estado === 'recibida_con_obs', 'F6.1 Estado = recibida_con_obs', `actual=${f6Estado}`);

  // Laura (tesorería) cierra
  res = await api('POST', `/api/solicitudes/${f5eId}/cerrar`, laura);
  assert(res.status === 200, 'F6.2 Laura cierra', `status=${res.status} ${JSON.stringify(res.data?.error ?? '')}`);
  assert(await getSolicitudEstado(f5eId) === 'cerrada', 'F6.2 Estado = cerrada');

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 7: Segregación de funciones
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 7: Segregación de funciones');
  console.log('══════════════════════════════════════════════');

  // María (responsable+solicitante) creates and sends — auto-validated because she is responsable
  const f7Id = await createSolicitud(maria, 'Flujo 7 - Segregación');
  res = await api('POST', `/api/solicitudes/${f7Id}/enviar`, maria);
  const f7Estado = await getSolicitudEstado(f7Id);
  // Responsable's own solicitudes are auto-validated (skip enviada → go to validada)
  assert(f7Estado === 'validada' || f7Estado === 'enviada', 'F7.1 María envía propia (auto-validada)', `estado=${f7Estado}`);

  // If auto-validated, María can't re-validate; if enviada, she can't validate her own
  res = await api('POST', `/api/solicitudes/${f7Id}/validar`, maria);
  assert(res.status !== 200, 'F7.2 María NO puede validar su propia solicitud', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 8: Permisos incorrectos
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 8: Permisos incorrectos');
  console.log('══════════════════════════════════════════════');

  const f8Id = await createSolicitud(juan, 'Flujo 8 - Permisos');
  await api('POST', `/api/solicitudes/${f8Id}/enviar`, juan);

  // Juan (solicitante) can't validate
  res = await api('POST', `/api/solicitudes/${f8Id}/validar`, juan);
  assert(res.status === 403, 'F8.1 Solicitante NO puede validar', `status=${res.status}`);

  // Pedro (compras) can't validate
  res = await api('POST', `/api/solicitudes/${f8Id}/validar`, pedro);
  assert(res.status === 403, 'F8.2 Compras NO puede validar', `status=${res.status}`);

  // Laura (tesorería) can't approve
  await api('POST', `/api/solicitudes/${f8Id}/validar`, maria);
  res = await api('POST', `/api/solicitudes/${f8Id}/aprobar`, laura);
  assert(res.status === 403, 'F8.3 Tesorería NO puede aprobar', `status=${res.status}`);

  // Juan can't approve
  res = await api('POST', `/api/solicitudes/${f8Id}/aprobar`, juan);
  assert(res.status === 403, 'F8.4 Solicitante NO puede aprobar', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 9: Transiciones inválidas
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 9: Transiciones inválidas');
  console.log('══════════════════════════════════════════════');

  const f9Id = await createSolicitud(juan, 'Flujo 9 - Transiciones inválidas');

  // Can't validate from borrador
  res = await api('POST', `/api/solicitudes/${f9Id}/validar`, maria);
  assert(res.status !== 200, 'F9.1 No validar desde borrador', `status=${res.status}`);

  // Can't approve from borrador
  res = await api('POST', `/api/solicitudes/${f9Id}/aprobar`, ana);
  assert(res.status !== 200, 'F9.2 No aprobar desde borrador', `status=${res.status}`);

  // Can't register purchase from borrador
  res = await apiFormData('POST', '/api/compras', laura, buildCompraFormData({
    solicitud_id: f9Id, proveedor_id: proveedorId, proveedor_nombre: 'Proveedor Test',
    monto_total: 100, medio_pago: 'efectivo', fecha_compra: '2026-04-06',
  }));
  assert(res.status !== 200 && res.status !== 201, 'F9.3 No comprar desde borrador', `status=${res.status}`);

  // Send it, then try to approve without validating
  await api('POST', `/api/solicitudes/${f9Id}/enviar`, juan);
  res = await api('POST', `/api/solicitudes/${f9Id}/aprobar`, ana);
  // Depends on tenant config — if requiere_validacion=true, should fail
  const f9ApproveFromEnviada = res.status;
  console.log(`  ℹ️  Aprobar desde enviada (skip validación): status=${f9ApproveFromEnviada}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 10: Procesar compras y programar pago
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 10: Compras workflow');
  console.log('══════════════════════════════════════════════');

  const f10Id = await createSolicitud(juan, 'Flujo 10 - Compras');
  await api('POST', `/api/solicitudes/${f10Id}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f10Id}/validar`, maria);
  await api('POST', `/api/solicitudes/${f10Id}/aprobar`, ana);
  const f10Estado = await getSolicitudEstado(f10Id);

  if (f10Estado === 'en_compras') {
    // Pedro processes
    res = await api('POST', `/api/solicitudes/${f10Id}/procesar-compras`, pedro, {
      prioridad_compra: 'normal',
      dia_pago_programado: '2026-04-20',
    });
    assert(res.status === 200, 'F10.1 Pedro procesa compra', `status=${res.status} ${JSON.stringify(res.data?.error ?? '')}`);

    // procesar-compras already transitions to pago_programado
    assert(await getSolicitudEstado(f10Id) === 'pago_programado', 'F10.2 Estado = pago_programado');

    // Laura registers purchase from pago_programado
    res = await apiFormData('POST', '/api/compras', laura, buildCompraFormData({
      solicitud_id: f10Id, proveedor_id: proveedorId, proveedor_nombre: 'Proveedor Test',
      monto_total: 2000, medio_pago: 'transferencia', referencia_bancaria: 'TRF-010',
      fecha_compra: '2026-04-06', numero_factura: `A-0010-${String(Date.now()).slice(-8)}`,
    }));
    assert(res.status === 200 || res.status === 201, 'F10.3 Laura compra desde pago_programado', `status=${res.status}`);
    assert(await getSolicitudEstado(f10Id) === 'abonada', 'F10.3 Estado = abonada');
  } else {
    console.log(`  ⏭️  Skipped (no compras users, estado=${f10Estado})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 11: Anulación desde pago_programado
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 11: Anular desde pago_programado');
  console.log('══════════════════════════════════════════════');

  const f11Id = await createSolicitud(juan, 'Flujo 11 - Anular pago_prog');
  await api('POST', `/api/solicitudes/${f11Id}/enviar`, juan);
  await api('POST', `/api/solicitudes/${f11Id}/validar`, maria);
  await api('POST', `/api/solicitudes/${f11Id}/aprobar`, ana);
  const f11Estado = await getSolicitudEstado(f11Id);
  if (f11Estado === 'en_compras') {
    await api('POST', `/api/solicitudes/${f11Id}/programar-pago`, pedro, { dia_pago_programado: '2026-04-25' });
    assert(await getSolicitudEstado(f11Id) === 'pago_programado', 'F11.1 pago_programado');
    res = await api('POST', `/api/solicitudes/${f11Id}/anular`, ana, { motivo: 'Cancelar pago programado por cambio de prioridad' });
    assert(res.status === 200, 'F11.2 Anular desde pago_programado', `status=${res.status}`);
    assert(await getSolicitudEstado(f11Id) === 'anulada', 'F11.2 Estado = anulada');
  } else {
    console.log(`  ⏭️  Skipped (estado=${f11Estado})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 12: No se puede anular estado terminal
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 12: No anular estados terminales');
  console.log('══════════════════════════════════════════════');

  // rechazada
  res = await api('POST', `/api/solicitudes/${f4Id}/anular`, ana, { motivo: 'Test anulación desde rechazada' });
  assert(res.status !== 200, 'F12.1 No anular rechazada', `status=${res.status}`);

  // anulada
  res = await api('POST', `/api/solicitudes/${f5aId}/anular`, ana, { motivo: 'Test anulación desde anulada' });
  assert(res.status !== 200, 'F12.2 No anular anulada', `status=${res.status}`);

  // cerrada
  res = await api('POST', `/api/solicitudes/${f5eId}/anular`, ana, { motivo: 'Test anulación desde cerrada' });
  assert(res.status !== 200, 'F12.3 No anular cerrada', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FLUJO 13: Edición solo en estados editables
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log('FLUJO 13: Edición en estados correctos');
  console.log('══════════════════════════════════════════════');

  const f13Id = await createSolicitud(juan, 'Flujo 13 - Edición');
  // Can edit in borrador
  res = await api('PATCH', `/api/solicitudes/${f13Id}`, juan, { titulo: 'Editado en borrador' });
  assert(res.status === 200, 'F13.1 Editar en borrador', `status=${res.status}`);

  // Send it — can't edit in enviada
  await api('POST', `/api/solicitudes/${f13Id}/enviar`, juan);
  res = await api('PATCH', `/api/solicitudes/${f13Id}`, juan, { titulo: 'Editado en enviada' });
  assert(res.status !== 200, 'F13.2 No editar en enviada', `status=${res.status}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════');
  console.log(`RESULTADOS: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\nFallas:');
    failures.forEach(f => console.log(f));
  }

  console.log('');
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
