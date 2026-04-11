import { describe, it, expect } from 'vitest';
import { ESTADOS_SOLICITUD, ESTADO_COLOR, ESTADO_LABEL, URGENCIA_COLOR } from '@/lib/constants';
import type { EstadoSolicitud } from '@/lib/constants';

describe('ESTADOS_SOLICITUD', () => {
  it('should have all 12 estados', () => {
    expect(Object.keys(ESTADOS_SOLICITUD)).toHaveLength(12);
  });

  it('should include key workflow states', () => {
    expect(ESTADOS_SOLICITUD.BORRADOR).toBe('borrador');
    expect(ESTADOS_SOLICITUD.ENVIADA).toBe('enviada');
    expect(ESTADOS_SOLICITUD.VALIDADA).toBe('validada');
    expect(ESTADOS_SOLICITUD.APROBADA).toBe('aprobada');
    expect(ESTADOS_SOLICITUD.RECHAZADA).toBe('rechazada');
    expect(ESTADOS_SOLICITUD.CERRADA).toBe('cerrada');
    expect(ESTADOS_SOLICITUD.ANULADA).toBe('anulada');
  });

  it('values should be lowercase strings', () => {
    for (const value of Object.values(ESTADOS_SOLICITUD)) {
      expect(value).toBe(value.toLowerCase());
      expect(typeof value).toBe('string');
    }
  });

  it('should be usable as type', () => {
    const estado: EstadoSolicitud = 'borrador';
    expect(estado).toBe(ESTADOS_SOLICITUD.BORRADOR);
  });
});

describe('ESTADO_COLOR', () => {
  it('should have a color for each estado', () => {
    expect(Object.keys(ESTADO_COLOR).length).toBeGreaterThanOrEqual(12);
  });

  it('should map known estados to Ant Design tag colors', () => {
    expect(ESTADO_COLOR['aprobada']).toBe('green');
    expect(ESTADO_COLOR['rechazada']).toBe('red');
    expect(ESTADO_COLOR['enviada']).toBe('processing');
  });
});

describe('ESTADO_LABEL', () => {
  it('should have a label for each estado', () => {
    expect(Object.keys(ESTADO_LABEL).length).toBeGreaterThanOrEqual(12);
  });

  it('should have human-readable Spanish labels', () => {
    expect(ESTADO_LABEL['borrador']).toBe('Borrador');
    expect(ESTADO_LABEL['aprobada']).toBe('Aprobada');
    expect(ESTADO_LABEL['cerrada']).toBe('Cerrada');
  });
});

describe('URGENCIA_COLOR', () => {
  it('should have 4 urgency levels', () => {
    expect(Object.keys(URGENCIA_COLOR)).toHaveLength(4);
  });

  it('should map urgency to colors', () => {
    expect(URGENCIA_COLOR['baja']).toBe('green');
    expect(URGENCIA_COLOR['critica']).toBe('red');
  });
});
