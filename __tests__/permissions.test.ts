import { describe, it, expect } from 'vitest';
import { verificarRol, verificarSegregacion } from '@/lib/permissions';

describe('verificarRol', () => {
  it('returns true when user has one of the required roles', () => {
    expect(verificarRol(['solicitante', 'admin'], ['admin'])).toBe(true);
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
});

describe('verificarSegregacion', () => {
  const BASE = { solicitante_id: 1, validado_por_id: null, aprobado_por_id: null };

  describe('validar', () => {
    it('blocks solicitante from validating their own request', () => {
      const result = verificarSegregacion(BASE, 1, 'validar');
      expect(result.permitido).toBe(false);
      expect(result.motivo).toMatch(/propia solicitud/i);
    });

    it('allows a different user to validate', () => {
      expect(verificarSegregacion(BASE, 2, 'validar').permitido).toBe(true);
    });
  });

  describe('aprobar', () => {
    it('blocks solicitante from approving their own request', () => {
      const result = verificarSegregacion(BASE, 1, 'aprobar');
      expect(result.permitido).toBe(false);
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
  });

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
  });
});
