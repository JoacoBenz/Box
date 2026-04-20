import { describe, it, expect } from 'vitest';
import {
  registroSchema,
  loginSchema,
  solicitudSchema,
  compraSchema,
  recepcionSchema,
  devolucionSchema,
  rechazoSchema,
  areaSchema,
  usuarioSchema,
  proveedorSchema,
  centroCostoSchema,
  procesarComprasSchema,
} from '@/lib/validators';

// ─── registroSchema ───────────────────────────────────────────────────────────
describe('registroSchema', () => {
  // Password must be 10+ chars, uppercase, lowercase, digit, special char
  const valid = {
    nombreOrganizacion: 'Mi Empresa S.A.',
    nombreUsuario: 'Admin',
    email: 'admin@empresa.com',
    password: 'Segura123!',
  };

  it('accepts valid input', () => {
    expect(registroSchema.safeParse(valid).success).toBe(true);
  });

  // ── Organization name ──
  it('rejects short organization name (< 3)', () => {
    expect(registroSchema.safeParse({ ...valid, nombreOrganizacion: 'AB' }).success).toBe(false);
  });

  it('rejects whitespace-only organization name', () => {
    expect(registroSchema.safeParse({ ...valid, nombreOrganizacion: '     ' }).success).toBe(false);
  });

  it('accepts organization name with exactly 3 chars', () => {
    expect(registroSchema.safeParse({ ...valid, nombreOrganizacion: 'ABC' }).success).toBe(true);
  });

  // ── User name ──
  it('rejects short user name (< 2)', () => {
    expect(registroSchema.safeParse({ ...valid, nombreUsuario: 'A' }).success).toBe(false);
  });

  it('accepts user name with exactly 2 chars', () => {
    expect(registroSchema.safeParse({ ...valid, nombreUsuario: 'AB' }).success).toBe(true);
  });

  // ── Email ──
  it('rejects invalid email', () => {
    expect(registroSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects empty email', () => {
    expect(registroSchema.safeParse({ ...valid, email: '' }).success).toBe(false);
  });

  // ── Password policy ──
  it('rejects password < 10 chars', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'Abc123!x' }).success).toBe(false);
  });

  it('rejects password without uppercase', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'segura12345!' }).success).toBe(false);
  });

  it('rejects password without lowercase', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'SEGURA12345!' }).success).toBe(false);
  });

  it('rejects password without digit', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'SeguraSegura!' }).success).toBe(false);
  });

  it('rejects password without special char', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'Segura12345' }).success).toBe(false);
  });

  it('accepts strong password with all requirements', () => {
    expect(registroSchema.safeParse({ ...valid, password: 'MiP@ssw0rd!' }).success).toBe(true);
  });
});

// ─── loginSchema ─────────────────────────────────────────────────────────────
describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'x@x.com', password: 'abc' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'x@x.com', password: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'invalid', password: 'abc' }).success).toBe(false);
  });

  it('rejects missing email', () => {
    expect(loginSchema.safeParse({ password: 'abc' }).success).toBe(false);
  });

  it('rejects missing password', () => {
    expect(loginSchema.safeParse({ email: 'x@x.com' }).success).toBe(false);
  });
});

// ─── areaSchema ───────────────────────────────────────────────────────────────
describe('areaSchema', () => {
  it('accepts valid area without responsable', () => {
    expect(areaSchema.safeParse({ nombre: 'Informática' }).success).toBe(true);
  });

  it('accepts area with responsable_id', () => {
    expect(areaSchema.safeParse({ nombre: 'Informática', responsable_id: 5 }).success).toBe(true);
  });

  it('accepts area with null responsable_id', () => {
    expect(areaSchema.safeParse({ nombre: 'Informática', responsable_id: null }).success).toBe(
      true,
    );
  });

  it('rejects area name too short', () => {
    expect(areaSchema.safeParse({ nombre: 'A' }).success).toBe(false);
  });

  it('rejects whitespace-only area name', () => {
    expect(areaSchema.safeParse({ nombre: '   ' }).success).toBe(false);
  });

  it('rejects negative responsable_id', () => {
    expect(areaSchema.safeParse({ nombre: 'Area', responsable_id: -1 }).success).toBe(false);
  });

  it('rejects zero responsable_id', () => {
    expect(areaSchema.safeParse({ nombre: 'Area', responsable_id: 0 }).success).toBe(false);
  });
});

// ─── usuarioSchema ────────────────────────────────────────────────────────────
describe('usuarioSchema', () => {
  const valid = {
    nombre: 'María García',
    email: 'maria@empresa.com',
    area_id: 1,
    roles: ['solicitante'] as const,
  };

  it('accepts valid new user (without password for update)', () => {
    expect(usuarioSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts user with strong password', () => {
    expect(usuarioSchema.safeParse({ ...valid, password: 'MiP@ssw0rd!' }).success).toBe(true);
  });

  it('rejects user with weak password', () => {
    expect(usuarioSchema.safeParse({ ...valid, password: '1234' }).success).toBe(false);
  });

  it('rejects user with no roles', () => {
    expect(usuarioSchema.safeParse({ ...valid, roles: [] }).success).toBe(false);
  });

  it('rejects invalid role name', () => {
    expect(usuarioSchema.safeParse({ ...valid, roles: ['superadmin'] }).success).toBe(false);
  });

  it('accepts all valid roles', () => {
    const allRoles = [
      'solicitante',
      'responsable_area',
      'director',
      'tesoreria',
      'compras',
      'admin',
    ];
    expect(usuarioSchema.safeParse({ ...valid, roles: allRoles }).success).toBe(true);
  });

  it('rejects missing area_id', () => {
    const { area_id, ...noArea } = valid;
    expect(usuarioSchema.safeParse(noArea).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(usuarioSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false);
  });

  it('rejects short name', () => {
    expect(usuarioSchema.safeParse({ ...valid, nombre: 'M' }).success).toBe(false);
  });
});

// ─── solicitudSchema ─────────────────────────────────────────────────────────
describe('solicitudSchema', () => {
  const validItem = { descripcion: 'Resma A4', cantidad: 10, unidad: 'unidades' };
  const valid = {
    titulo: 'Materiales de oficina',
    descripcion: 'Se necesitan insumos para el área administrativa',
    justificacion: 'Stock agotado, necesario para el funcionamiento diario',
    urgencia: 'normal' as const,
    items: [validItem],
  };

  it('accepts a valid solicitud', () => {
    expect(solicitudSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects with no items', () => {
    expect(solicitudSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('rejects short titulo (< 3)', () => {
    expect(solicitudSchema.safeParse({ ...valid, titulo: 'AB' }).success).toBe(false);
  });

  it('rejects short descripcion (< 10)', () => {
    expect(solicitudSchema.safeParse({ ...valid, descripcion: 'corta' }).success).toBe(false);
  });

  it('rejects short justificacion (< 10)', () => {
    expect(solicitudSchema.safeParse({ ...valid, justificacion: 'corta' }).success).toBe(false);
  });

  it('rejects invalid urgencia value', () => {
    expect(solicitudSchema.safeParse({ ...valid, urgencia: 'baja' }).success).toBe(false);
  });

  it('accepts urgencia critica', () => {
    expect(solicitudSchema.safeParse({ ...valid, urgencia: 'critica' }).success).toBe(true);
  });

  it('accepts urgencia urgente', () => {
    expect(solicitudSchema.safeParse({ ...valid, urgencia: 'urgente' }).success).toBe(true);
  });

  // ── Items validation ──
  it('rejects item with zero cantidad', () => {
    const badItem = { ...validItem, cantidad: 0 };
    expect(solicitudSchema.safeParse({ ...valid, items: [badItem] }).success).toBe(false);
  });

  it('rejects item with negative cantidad', () => {
    const badItem = { ...validItem, cantidad: -5 };
    expect(solicitudSchema.safeParse({ ...valid, items: [badItem] }).success).toBe(false);
  });

  it('rejects item with excesive cantidad', () => {
    const badItem = { ...validItem, cantidad: 1_000_000 };
    expect(solicitudSchema.safeParse({ ...valid, items: [badItem] }).success).toBe(false);
  });

  it('rejects item with short descripcion', () => {
    const badItem = { ...validItem, descripcion: 'A' };
    expect(solicitudSchema.safeParse({ ...valid, items: [badItem] }).success).toBe(false);
  });

  it('accepts item with precio_estimado', () => {
    const item = { ...validItem, precio_estimado: 500 };
    expect(solicitudSchema.safeParse({ ...valid, items: [item] }).success).toBe(true);
  });

  it('rejects item with negative precio_estimado', () => {
    const item = { ...validItem, precio_estimado: -100 };
    expect(solicitudSchema.safeParse({ ...valid, items: [item] }).success).toBe(false);
  });

  it('accepts item with valid link_producto', () => {
    const item = { ...validItem, link_producto: 'https://example.com/product' };
    expect(solicitudSchema.safeParse({ ...valid, items: [item] }).success).toBe(true);
  });

  it('rejects item with invalid link_producto', () => {
    const item = { ...validItem, link_producto: 'not-a-url' };
    expect(solicitudSchema.safeParse({ ...valid, items: [item] }).success).toBe(false);
  });

  it('accepts max 100 items', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      ...validItem,
      descripcion: `Item ${i + 10}`,
    }));
    expect(solicitudSchema.safeParse({ ...valid, items }).success).toBe(true);
  });

  it('rejects more than 100 items', () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      ...validItem,
      descripcion: `Item ${i + 10}`,
    }));
    expect(solicitudSchema.safeParse({ ...valid, items }).success).toBe(false);
  });

  // ── Optional fields ──
  it('accepts optional proveedor_sugerido', () => {
    expect(solicitudSchema.safeParse({ ...valid, proveedor_sugerido: 'Amazon' }).success).toBe(
      true,
    );
  });

  it('accepts optional proveedor_id', () => {
    expect(solicitudSchema.safeParse({ ...valid, proveedor_id: 1 }).success).toBe(true);
  });

  it('accepts optional centro_costo_id', () => {
    expect(solicitudSchema.safeParse({ ...valid, centro_costo_id: 5 }).success).toBe(true);
  });

  it('accepts null optional fields', () => {
    expect(
      solicitudSchema.safeParse({
        ...valid,
        proveedor_sugerido: null,
        proveedor_id: null,
        centro_costo_id: null,
      }).success,
    ).toBe(true);
  });
});

// ─── compraSchema ─────────────────────────────────────────────────────────────
describe('compraSchema', () => {
  const valid = {
    solicitud_id: 1,
    proveedor_nombre: 'Librería Central',
    fecha_compra: '2026-03-27',
    monto_total: 15000,
    medio_pago: 'efectivo' as const,
  };

  it('accepts valid compra with efectivo (no referencia needed)', () => {
    expect(compraSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts valid compra with transferencia + referencia', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        medio_pago: 'transferencia',
        referencia_bancaria: 'TRF-123456',
      }).success,
    ).toBe(true);
  });

  it('rejects transferencia without referencia_bancaria', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        medio_pago: 'transferencia',
      }).success,
    ).toBe(false);
  });

  it('rejects cheque without referencia_bancaria', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        medio_pago: 'cheque',
      }).success,
    ).toBe(false);
  });

  it('accepts cheque with referencia_bancaria', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        medio_pago: 'cheque',
        referencia_bancaria: 'CHQ-789',
      }).success,
    ).toBe(true);
  });

  it('accepts tarjeta without referencia_bancaria', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        medio_pago: 'tarjeta',
      }).success,
    ).toBe(true);
  });

  it('rejects zero monto', () => {
    expect(compraSchema.safeParse({ ...valid, monto_total: 0 }).success).toBe(false);
  });

  it('rejects negative monto', () => {
    expect(compraSchema.safeParse({ ...valid, monto_total: -100 }).success).toBe(false);
  });

  it('rejects excesive monto', () => {
    expect(compraSchema.safeParse({ ...valid, monto_total: 1_000_000_000 }).success).toBe(false);
  });

  it('rejects invalid date', () => {
    expect(compraSchema.safeParse({ ...valid, fecha_compra: 'not-a-date' }).success).toBe(false);
  });

  it('rejects future date', () => {
    expect(compraSchema.safeParse({ ...valid, fecha_compra: '2030-01-01' }).success).toBe(false);
  });

  it('rejects date older than 5 years', () => {
    expect(compraSchema.safeParse({ ...valid, fecha_compra: '2018-01-01' }).success).toBe(false);
  });

  it('rejects invalid medio_pago', () => {
    expect(compraSchema.safeParse({ ...valid, medio_pago: 'bitcoin' }).success).toBe(false);
  });

  it('accepts all valid medio_pago types', () => {
    for (const mp of ['transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro']) {
      const data = { ...valid, medio_pago: mp };
      if (['transferencia', 'cheque'].includes(mp)) {
        (data as any).referencia_bancaria = 'REF-123';
      }
      expect(compraSchema.safeParse(data).success).toBe(true);
    }
  });

  // ── Numero factura ──
  it('accepts valid numero_factura format', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        numero_factura: 'A-0001-00012345',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid numero_factura format', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        numero_factura: '12345',
      }).success,
    ).toBe(false);
  });

  it('accepts empty string numero_factura', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        numero_factura: '',
      }).success,
    ).toBe(true);
  });

  it('accepts null numero_factura', () => {
    expect(
      compraSchema.safeParse({
        ...valid,
        numero_factura: null,
      }).success,
    ).toBe(true);
  });
});

// ─── recepcionSchema ──────────────────────────────────────────────────────────
describe('recepcionSchema', () => {
  it('accepts conforme reception', () => {
    expect(recepcionSchema.safeParse({ solicitud_id: 1, conforme: true }).success).toBe(true);
  });

  it('accepts non-conforme with required fields', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        tipo_problema: 'faltante',
        observaciones: 'Faltaron 3 resmas del pedido',
      }).success,
    ).toBe(true);
  });

  it('rejects non-conforme without tipo_problema', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        observaciones: 'Faltaron 3 resmas del pedido',
      }).success,
    ).toBe(false);
  });

  it('rejects non-conforme without observaciones', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        tipo_problema: 'faltante',
      }).success,
    ).toBe(false);
  });

  it('rejects non-conforme with short observaciones (< 10)', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        tipo_problema: 'dañado',
        observaciones: 'Roto',
      }).success,
    ).toBe(false);
  });

  it('accepts all tipo_problema values', () => {
    for (const tipo of ['faltante', 'dañado', 'diferente', 'otro']) {
      expect(
        recepcionSchema.safeParse({
          solicitud_id: 1,
          conforme: false,
          tipo_problema: tipo,
          observaciones: 'Descripción del problema encontrado',
        }).success,
      ).toBe(true);
    }
  });

  it('rejects invalid tipo_problema', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        tipo_problema: 'incorrecto',
        observaciones: 'Descripción del problema encontrado',
      }).success,
    ).toBe(false);
  });

  // ── Items-level reception ──
  it('accepts reception with items', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: true,
        items: [
          { item_solicitud_id: 1, cantidad_recibida: 10, conforme: true },
          { item_solicitud_id: 2, cantidad_recibida: 5, conforme: true },
        ],
      }).success,
    ).toBe(true);
  });

  it('accepts reception with non-conforme items', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: false,
        tipo_problema: 'dañado',
        observaciones: 'Algunos items llegaron dañados del envío',
        items: [
          { item_solicitud_id: 1, cantidad_recibida: 10, conforme: true },
          { item_solicitud_id: 2, cantidad_recibida: 3, conforme: false, observaciones: 'Dañados' },
        ],
      }).success,
    ).toBe(true);
  });

  it('rejects item with zero cantidad_recibida', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: true,
        items: [{ item_solicitud_id: 1, cantidad_recibida: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects item with negative cantidad_recibida', () => {
    expect(
      recepcionSchema.safeParse({
        solicitud_id: 1,
        conforme: true,
        items: [{ item_solicitud_id: 1, cantidad_recibida: -5 }],
      }).success,
    ).toBe(false);
  });
});

// ─── proveedorSchema ─────────────────────────────────────────────────────────
describe('proveedorSchema', () => {
  it('accepts minimal valid proveedor', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Librería Central' }).success).toBe(true);
  });

  it('accepts proveedor with all fields', () => {
    expect(
      proveedorSchema.safeParse({
        nombre: 'Librería Central',
        cuit: '20-12345678-9',
        datos_bancarios: 'CBU 0000000000000000000000',
        link_pagina: 'https://libreriacentral.com',
        telefono: '11-1234-5678',
        email: 'ventas@libreriacentral.com',
        direccion: 'Av. Corrientes 1234, CABA',
      }).success,
    ).toBe(true);
  });

  it('rejects short proveedor name', () => {
    expect(proveedorSchema.safeParse({ nombre: 'A' }).success).toBe(false);
  });

  // ── CUIT validation ──
  it('accepts valid CUIT format (XX-XXXXXXXX-X)', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', cuit: '20-12345678-9' }).success).toBe(true);
  });

  it('rejects invalid CUIT format', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', cuit: '2012345678' }).success).toBe(false);
  });

  it('accepts empty CUIT', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', cuit: '' }).success).toBe(true);
  });

  it('accepts null CUIT', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', cuit: null }).success).toBe(true);
  });

  // ── Telefono validation ──
  it('accepts valid phone format (XX-XXXX-XXXX)', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', telefono: '11-1234-5678' }).success).toBe(
      true,
    );
  });

  it('rejects invalid phone format', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', telefono: '1112345678' }).success).toBe(
      false,
    );
  });

  // ── URL validation ──
  it('rejects invalid link_pagina URL', () => {
    expect(proveedorSchema.safeParse({ nombre: 'Test', link_pagina: 'not-a-url' }).success).toBe(
      false,
    );
  });

  it('accepts valid link_pagina URL', () => {
    expect(
      proveedorSchema.safeParse({ nombre: 'Test', link_pagina: 'https://example.com' }).success,
    ).toBe(true);
  });
});

// ─── centroCostoSchema ───────────────────────────────────────────────────────
describe('centroCostoSchema', () => {
  const valid = { nombre: 'Administración', codigo: 'ADM-001', area_id: 1 };

  it('accepts valid centro de costo', () => {
    expect(centroCostoSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts with presupuestos', () => {
    expect(
      centroCostoSchema.safeParse({
        ...valid,
        presupuesto_anual: 1_000_000,
        presupuesto_mensual: 100_000,
      }).success,
    ).toBe(true);
  });

  it('rejects short nombre', () => {
    expect(centroCostoSchema.safeParse({ ...valid, nombre: 'A' }).success).toBe(false);
  });

  it('rejects empty codigo', () => {
    expect(centroCostoSchema.safeParse({ ...valid, codigo: '' }).success).toBe(false);
  });

  it('rejects codigo with spaces', () => {
    expect(centroCostoSchema.safeParse({ ...valid, codigo: 'ADM 001' }).success).toBe(false);
  });

  it('rejects codigo with special chars', () => {
    expect(centroCostoSchema.safeParse({ ...valid, codigo: 'ADM@001' }).success).toBe(false);
  });

  it('accepts codigo with letters, digits, hyphens, underscores', () => {
    expect(centroCostoSchema.safeParse({ ...valid, codigo: 'CC_ADM-01' }).success).toBe(true);
  });

  it('rejects negative presupuesto_anual', () => {
    expect(centroCostoSchema.safeParse({ ...valid, presupuesto_anual: -1000 }).success).toBe(false);
  });

  it('rejects excesive presupuesto_anual', () => {
    expect(
      centroCostoSchema.safeParse({ ...valid, presupuesto_anual: 1_000_000_000 }).success,
    ).toBe(false);
  });

  it('accepts zero presupuesto', () => {
    expect(centroCostoSchema.safeParse({ ...valid, presupuesto_anual: 0 }).success).toBe(true);
  });
});

// ─── procesarComprasSchema ───────────────────────────────────────────────────
describe('procesarComprasSchema', () => {
  const base = { prioridad_compra: 'normal', dia_pago_programado: '2026-04-15' };

  it('accepts valid procesarCompras', () => {
    expect(procesarComprasSchema.safeParse(base).success).toBe(true);
  });

  it('accepts all priority values', () => {
    for (const p of ['urgente', 'normal', 'programado']) {
      expect(procesarComprasSchema.safeParse({ ...base, prioridad_compra: p }).success).toBe(true);
    }
  });

  it('rejects invalid priority', () => {
    expect(procesarComprasSchema.safeParse({ ...base, prioridad_compra: 'baja' }).success).toBe(
      false,
    );
  });

  it('accepts with optional observaciones', () => {
    expect(
      procesarComprasSchema.safeParse({
        ...base,
        prioridad_compra: 'urgente',
        observaciones: 'Priorizar esta compra',
      }).success,
    ).toBe(true);
  });

  it('accepts with valid dia_pago_programado', () => {
    expect(
      procesarComprasSchema.safeParse({
        prioridad_compra: 'programado',
        dia_pago_programado: '2026-04-15',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid dia_pago_programado', () => {
    expect(
      procesarComprasSchema.safeParse({
        prioridad_compra: 'programado',
        dia_pago_programado: 'no-es-fecha',
      }).success,
    ).toBe(false);
  });
});

// ─── devolucionSchema ────────────────────────────────────────────────────────
describe('devolucionSchema', () => {
  it('accepts valid reason (>= 10 chars)', () => {
    expect(
      devolucionSchema.safeParse({
        observaciones: 'Falta justificación del pedido',
        origen: 'responsable',
      }).success,
    ).toBe(true);
  });

  it('accepts director origen', () => {
    expect(
      devolucionSchema.safeParse({
        observaciones: 'Falta justificación del pedido',
        origen: 'director',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid origen', () => {
    expect(
      devolucionSchema.safeParse({
        observaciones: 'Falta justificación del pedido',
        origen: 'invalid',
      }).success,
    ).toBe(false);
  });

  it('rejects missing origen', () => {
    expect(
      devolucionSchema.safeParse({ observaciones: 'Falta justificación del pedido' }).success,
    ).toBe(false);
  });

  it('rejects too short reason (< 10 chars)', () => {
    expect(devolucionSchema.safeParse({ observaciones: 'No', origen: 'responsable' }).success).toBe(
      false,
    );
  });

  it('rejects whitespace-only reason', () => {
    expect(
      devolucionSchema.safeParse({ observaciones: '          ', origen: 'responsable' }).success,
    ).toBe(false);
  });

  it('rejects missing observaciones', () => {
    expect(devolucionSchema.safeParse({ origen: 'responsable' }).success).toBe(false);
  });
});

// ─── rechazoSchema ───────────────────────────────────────────────────────────
describe('rechazoSchema', () => {
  it('accepts valid motivo (>= 10 chars)', () => {
    expect(
      rechazoSchema.safeParse({ motivo: 'Presupuesto insuficiente para esta compra' }).success,
    ).toBe(true);
  });

  it('rejects short motivo (< 10 chars)', () => {
    expect(rechazoSchema.safeParse({ motivo: 'No' }).success).toBe(false);
  });

  it('rejects whitespace-only motivo', () => {
    expect(rechazoSchema.safeParse({ motivo: '              ' }).success).toBe(false);
  });

  it('rejects missing motivo', () => {
    expect(rechazoSchema.safeParse({}).success).toBe(false);
  });
});
