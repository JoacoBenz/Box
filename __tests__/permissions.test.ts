import { describe, it, expect, vi } from 'vitest';

// Mock prisma to avoid needing generated client
vi.mock('@/lib/prisma', () => ({
  prisma: {},
  tenantPrisma: () => ({}),
}));

import { verificarRol, verificarSegregacion, apiError } from '@/lib/permissions';

// ─── verificarRol ─────────────────────────────────────────────────────────────
describe('verificarRol', () => {
  it('returns true when user has one of the required roles', () => {
    expect(verificarRol(['solicitante', 'admin'], ['admin'])).toBe(true);
  });

  it('returns true when user has multiple matching roles', () => {
    expect(verificarRol(['director', 'admin'], ['director', 'admin'])).toBe(true);
  });

  it('returns false when user has none of the required roles', () => {
    expect(verificarRol(['solicitante'], ['director', 'tesoreria'])).toBe(false);
  });

  it('returns false for empty user roles', () => {
    expect(verificarRol([], ['admin'])).toBe(false);
  });

  it('returns false when required roles list is empty', () => {
    expect(verificarRol(['admin'], [])).toBe(false);
  });

  it('returns false when both lists are empty', () => {
    expect(verificarRol([], [])).toBe(false);
  });

  it('returns true for solicitante role', () => {
    expect(verificarRol(['solicitante'], ['solicitante'])).toBe(true);
  });

  it('returns true for responsable_area role', () => {
    expect(verificarRol(['responsable_area'], ['responsable_area'])).toBe(true);
  });

  it('returns true for director role', () => {
    expect(verificarRol(['director'], ['director'])).toBe(true);
  });

  it('returns true for tesoreria role', () => {
    expect(verificarRol(['tesoreria'], ['tesoreria'])).toBe(true);
  });

  it('returns true for compras role', () => {
    expect(verificarRol(['compras'], ['compras'])).toBe(true);
  });

  it('matches first role in required list', () => {
    expect(verificarRol(['solicitante'], ['solicitante', 'admin'])).toBe(true);
  });

  it('matches last role in required list', () => {
    expect(verificarRol(['admin'], ['solicitante', 'admin'])).toBe(true);
  });
});

// ─── verificarSegregacion ─────────────────────────────────────────────────────
describe('verificarSegregacion', () => {
  const BASE = { solicitante_id: 1, validado_por_id: null, aprobado_por_id: null };

  // ── Validar ──
  describe('validar', () => {
    it('blocks solicitante from validating their own request', () => {
      const result = verificarSegregacion(BASE, 1, 'validar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/propia solicitud/i);
    });

    it('allows a different user to validate', () => {
      expect(verificarSegregacion(BASE, 2, 'validar').permitido).toBe(true);
    });

    it('allows validation regardless of validado_por_id', () => {
      const solicitud = { ...BASE, validado_por_id: 3 };
      expect(verificarSegregacion(solicitud, 2, 'validar').permitido).toBe(true);
    });

    it('returns no motivo when allowed', () => {
      const result = verificarSegregacion(BASE, 2, 'validar');
      expect(result.motivo).toBeUndefined();
    });
  });

  // ── Aprobar ──
  describe('aprobar', () => {
    it('blocks solicitante from approving their own request', () => {
      const result = verificarSegregacion(BASE, 1, 'aprobar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/propia solicitud/i);
    });

    it('blocks validator from also approving', () => {
      const solicitud = { ...BASE, validado_por_id: 2 };
      const result = verificarSegregacion(solicitud, 2, 'aprobar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/validaste/i);
    });

    it('allows a user who neither created nor validated to approve', () => {
      const solicitud = { ...BASE, validado_por_id: 2 };
      expect(verificarSegregacion(solicitud, 3, 'aprobar').permitido).toBe(true);
    });

    it('allows approval when validado_por_id is null (validation skipped)', () => {
      expect(verificarSegregacion(BASE, 2, 'aprobar').permitido).toBe(true);
    });

    it('blocks if user is both solicitante and validator (same user)', () => {
      const solicitud = { solicitante_id: 1, validado_por_id: 1, aprobado_por_id: null };
      const result = verificarSegregacion(solicitud, 1, 'aprobar');
      expect(result.permitido).toBe(false);
    });
  });

  // ── Procesar compras ──
  describe('procesar_compras', () => {
    it('blocks approver from processing purchases', () => {
      const solicitud = { ...BASE, aprobado_por_id: 3 };
      const result = verificarSegregacion(solicitud, 3, 'procesar_compras');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/aprobaste/i);
    });

    it('allows a different user to process purchases', () => {
      const solicitud = { ...BASE, aprobado_por_id: 3 };
      expect(verificarSegregacion(solicitud, 4, 'procesar_compras').permitido).toBe(true);
    });

    it('allows processing when aprobado_por_id is null', () => {
      expect(verificarSegregacion(BASE, 3, 'procesar_compras').permitido).toBe(true);
    });

    it('allows solicitante to process purchases (different concern)', () => {
      const solicitud = { ...BASE, aprobado_por_id: 5 };
      expect(verificarSegregacion(solicitud, 1, 'procesar_compras').permitido).toBe(true);
    });
  });

  // ── Comprar ──
  describe('comprar', () => {
    it('blocks approver from registering the purchase', () => {
      const solicitud = { ...BASE, aprobado_por_id: 3 };
      const result = verificarSegregacion(solicitud, 3, 'comprar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/aprobaste/i);
    });

    it('allows tesorería user (not the approver) to register purchase', () => {
      const solicitud = { ...BASE, aprobado_por_id: 3 };
      expect(verificarSegregacion(solicitud, 4, 'comprar').permitido).toBe(true);
    });

    it('allows purchase when aprobado_por_id is null', () => {
      expect(verificarSegregacion(BASE, 3, 'comprar').permitido).toBe(true);
    });

    it('blocks solicitante from registering purchase of own request', () => {
      const solicitud = { ...BASE, aprobado_por_id: 5 };
      const result = verificarSegregacion(solicitud, 1, 'comprar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toContain('propia solicitud');
    });

    it('allows validator to register purchase (different concern)', () => {
      const solicitud = { ...BASE, validado_por_id: 2, aprobado_por_id: 3 };
      expect(verificarSegregacion(solicitud, 2, 'comprar').permitido).toBe(true);
    });
  });

  // ── Edge cases across all actions ──
  describe('edge cases', () => {
    it('handles undefined validado_por_id', () => {
      const solicitud = { solicitante_id: 1 };
      expect(verificarSegregacion(solicitud, 2, 'aprobar').permitido).toBe(true);
    });

    it('handles undefined aprobado_por_id', () => {
      const solicitud = { solicitante_id: 1 };
      expect(verificarSegregacion(solicitud, 2, 'comprar').permitido).toBe(true);
    });

    it('full chain: user 1 creates, user 2 validates, user 3 approves, user 4 buys', () => {
      const solicitud = { solicitante_id: 1, validado_por_id: 2, aprobado_por_id: 3 };
      // User 2 can't approve (validated it)
      expect(verificarSegregacion(solicitud, 2, 'aprobar').permitido).toBe(false);
      // User 3 can't buy (approved it)
      expect(verificarSegregacion(solicitud, 3, 'comprar').permitido).toBe(false);
      // User 4 can buy
      expect(verificarSegregacion(solicitud, 4, 'comprar').permitido).toBe(true);
    });

    it('nobody can self-validate AND self-approve', () => {
      const solicitud = { solicitante_id: 1, validado_por_id: null, aprobado_por_id: null };
      // User 1 can't validate own
      expect(verificarSegregacion(solicitud, 1, 'validar').permitido).toBe(false);
      // User 1 can't approve own
      expect(verificarSegregacion(solicitud, 1, 'aprobar').permitido).toBe(false);
    });
  });
});

// ─── apiError ─────────────────────────────────────────────────────────────────
describe('apiError', () => {
  it('returns a Response with correct status and error body', async () => {
    const response = apiError('NOT_FOUND', 'Recurso no encontrado', 404);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Recurso no encontrado');
  });

  it('returns 400 for validation errors', async () => {
    const response = apiError('VALIDATION', 'Campo inválido', 400);
    expect(response.status).toBe(400);
  });

  it('returns 403 for forbidden', async () => {
    const response = apiError('FORBIDDEN', 'Sin permisos', 403);
    expect(response.status).toBe(403);
  });

  it('includes details array when provided', async () => {
    const details = [
      { field: 'email', message: 'Email inválido' },
      { field: 'nombre', message: 'Nombre requerido' },
    ];
    const response = apiError('VALIDATION', 'Errores de validación', 400, details);
    const body = await response.json();
    expect(body.error.details).toHaveLength(2);
    expect(body.error.details[0].field).toBe('email');
    expect(body.error.details[1].field).toBe('nombre');
  });

  it('omits details when not provided', async () => {
    const response = apiError('ERROR', 'Error genérico', 500);
    const body = await response.json();
    expect(body.error.details).toBeUndefined();
  });
});
