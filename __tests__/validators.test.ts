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
} from '@/lib/validators';

// ─── registroSchema ───────────────────────────────────────────────────────────
describe('registroSchema', () => {
  const valid = {
    nombreOrganizacion: 'Mi Empresa S.A.',
    nombreUsuario: 'Admin',
    email: 'admin@empresa.com',
    password: 'segura123',
  };

  it('accepts valid input', () => {
    expect(registroSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short organization name', () => {
    expect(registroSchema.safeParse({ ...valid, nombreOrganizacion: 'AB' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(registroSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects short password', () => {
    expect(registroSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
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
});

// ─── areaSchema ───────────────────────────────────────────────────────────────
describe('areaSchema', () => {
  it('accepts valid area without responsable', () => {
    expect(areaSchema.safeParse({ nombre: 'Informática' }).success).toBe(true);
  });

  it('accepts area with responsable_id', () => {
    expect(areaSchema.safeParse({ nombre: 'Informática', responsable_id: 5 }).success).toBe(true);
  });

  it('rejects area name too short', () => {
    expect(areaSchema.safeParse({ nombre: 'A' }).success).toBe(false);
  });
});

// ─── usuarioSchema ────────────────────────────────────────────────────────────
describe('usuarioSchema', () => {
  const valid = {
    nombre: 'María García',
    email: 'maria@empresa.com',
    area_id: 1,
    roles: ['solicitante'],
  };

  it('accepts valid new user', () => {
    expect(usuarioSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects user with no roles', () => {
    expect(usuarioSchema.safeParse({ ...valid, roles: [] }).success).toBe(false);
  });

  it('rejects invalid role name', () => {
    expect(usuarioSchema.safeParse({ ...valid, roles: ['superadmin'] }).success).toBe(false);
  });
});

// ─── solicitudSchema ─────────────────────────────────────────────────────────
describe('solicitudSchema', () => {
  const validItem = { descripcion: 'Resma A4', cantidad: 10, unidad: 'unidades' };
  const valid = {
    titulo: 'Materiales de oficina',
    descripcion: 'Se necesitan insumos para el área administrativa',
    justificacion: 'Stock agotado, necesario para el funcionamiento diario',
    urgencia: 'normal',
    items: [validItem],
  };

  it('accepts a valid solicitud', () => {
    expect(solicitudSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects with no items', () => {
    expect(solicitudSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it('rejects short descripcion', () => {
    expect(solicitudSchema.safeParse({ ...valid, descripcion: 'corta' }).success).toBe(false);
  });

  it('rejects invalid urgencia value', () => {
    expect(solicitudSchema.safeParse({ ...valid, urgencia: 'baja' }).success).toBe(false);
  });

  it('rejects item with zero cantidad', () => {
    const badItem = { ...validItem, cantidad: 0 };
    expect(solicitudSchema.safeParse({ ...valid, items: [badItem] }).success).toBe(false);
  });

  it('accepts optional proveedor_sugerido', () => {
    expect(solicitudSchema.safeParse({ ...valid, proveedor_sugerido: 'Amazon' }).success).toBe(true);
  });
});

// ─── compraSchema ─────────────────────────────────────────────────────────────
describe('compraSchema', () => {
  const valid = {
    solicitud_id: 1,
    proveedor_nombre: 'Librería Central',
    fecha_compra: '2026-03-27',
    monto_total: 15000,
    medio_pago: 'transferencia',
  };

  it('accepts valid compra', () => {
    expect(compraSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects zero monto', () => {
    expect(compraSchema.safeParse({ ...valid, monto_total: 0 }).success).toBe(false);
  });

  it('rejects invalid date', () => {
    expect(compraSchema.safeParse({ ...valid, fecha_compra: 'not-a-date' }).success).toBe(false);
  });

  it('rejects invalid medio_pago', () => {
    expect(compraSchema.safeParse({ ...valid, medio_pago: 'bitcoin' }).success).toBe(false);
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
        observaciones: 'Faltaron 3 resmas',
      }).success
    ).toBe(true);
  });

  it('rejects non-conforme without tipo_problema or observaciones', () => {
    expect(recepcionSchema.safeParse({ solicitud_id: 1, conforme: false }).success).toBe(false);
  });
});

// ─── devolucionSchema / rechazoSchema ─────────────────────────────────────────
describe('devolucionSchema', () => {
  it('accepts valid reason', () => {
    expect(devolucionSchema.safeParse({ observaciones: 'Falta justificación' }).success).toBe(true);
  });

  it('rejects too short reason', () => {
    expect(devolucionSchema.safeParse({ observaciones: 'No' }).success).toBe(false);
  });
});

describe('rechazoSchema', () => {
  it('accepts valid motivo', () => {
    expect(rechazoSchema.safeParse({ motivo: 'Presupuesto insuficiente' }).success).toBe(true);
  });

  it('rejects short motivo', () => {
    expect(rechazoSchema.safeParse({ motivo: 'No' }).success).toBe(false);
  });
});
