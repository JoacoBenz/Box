import { describe, it, expect } from 'vitest';
import {
  businessDaysBetween,
  formatMonto,
  computeMonto,
  buildEmailHtml,
  buildSubject,
  shouldSendDigest,
  filterSolicitudesForUser,
  ROLE_CONFIGS,
  URGENCIA_COLORS,
  type SolicitudRow,
  type RoleDigestConfig,
} from '@/lib/email-digest';

// ─── businessDaysBetween ───

describe('businessDaysBetween', () => {
  it('returns 0 for same day', () => {
    const d = new Date(2026, 3, 6, 12); // Monday Apr 6
    expect(businessDaysBetween(d, d)).toBe(0);
  });

  it('counts weekdays only (Mon to Fri = 4)', () => {
    const mon = new Date(2026, 3, 6, 12);
    const fri = new Date(2026, 3, 10, 12);
    expect(businessDaysBetween(mon, fri)).toBe(4);
  });

  it('skips weekends (Fri to Mon = 1)', () => {
    const fri = new Date(2026, 3, 10, 12);
    const mon = new Date(2026, 3, 13, 12);
    expect(businessDaysBetween(fri, mon)).toBe(1);
  });

  it('full week Mon to next Mon = 5', () => {
    const mon1 = new Date(2026, 3, 6, 12);
    const mon2 = new Date(2026, 3, 13, 12);
    expect(businessDaysBetween(mon1, mon2)).toBe(5);
  });

  it('two weeks = 10 business days', () => {
    const mon1 = new Date(2026, 3, 6, 12);
    const mon3 = new Date(2026, 3, 20, 12);
    expect(businessDaysBetween(mon1, mon3)).toBe(10);
  });

  it('Sat to Mon = 1', () => {
    // Use explicit local dates to avoid timezone issues
    const sat = new Date(2026, 3, 4, 12); // Apr 4 = Sat
    const mon = new Date(2026, 3, 6, 12); // Apr 6 = Mon
    expect(businessDaysBetween(sat, mon)).toBe(1);
  });

  it('Sat to Sun = 0', () => {
    const sat = new Date(2026, 3, 4, 12); // Apr 4 = Sat
    const sun = new Date(2026, 3, 5, 12); // Apr 5 = Sun
    expect(businessDaysBetween(sat, sun)).toBe(0);
  });

  it('returns 0 when from > to', () => {
    const later = new Date(2026, 3, 10, 12);
    const earlier = new Date(2026, 3, 6, 12);
    expect(businessDaysBetween(later, earlier)).toBe(0);
  });

  it('Wed to next Wed = 5', () => {
    const wed1 = new Date(2026, 3, 8, 12);
    const wed2 = new Date(2026, 3, 15, 12);
    expect(businessDaysBetween(wed1, wed2)).toBe(5);
  });
});

// ─── formatMonto ───

describe('formatMonto', () => {
  it('formats zero', () => {
    expect(formatMonto(0)).toBe('$0');
  });

  it('formats thousands with locale separator', () => {
    const result = formatMonto(15000);
    expect(result).toContain('$');
    expect(result).toContain('15');
  });

  it('formats large numbers', () => {
    const result = formatMonto(1200000);
    expect(result).toContain('$');
    expect(result).toContain('1');
  });
});

// ─── computeMonto ───

describe('computeMonto', () => {
  it('returns 0 for empty items', () => {
    expect(computeMonto([])).toBe(0);
  });

  it('sums precio_estimado * cantidad', () => {
    const items = [
      { precio_estimado: 100, cantidad: 3 },
      { precio_estimado: 200, cantidad: 2 },
    ];
    expect(computeMonto(items)).toBe(700);
  });

  it('handles null precio_estimado', () => {
    const items = [
      { precio_estimado: null, cantidad: 5 },
      { precio_estimado: 100, cantidad: 2 },
    ];
    expect(computeMonto(items)).toBe(200);
  });

  it('handles string numbers (Decimal from Prisma)', () => {
    const items = [
      { precio_estimado: '150.50', cantidad: '2' },
    ];
    expect(computeMonto(items)).toBe(301);
  });
});

// ─── shouldSendDigest ───

describe('shouldSendDigest', () => {
  it('returns false when digest disabled (even if urgent)', () => {
    expect(shouldSendDigest(false, true)).toBe(false);
    expect(shouldSendDigest(false, false)).toBe(false);
  });

  it('returns true when digest enabled', () => {
    expect(shouldSendDigest(true, false)).toBe(true);
    expect(shouldSendDigest(true, true)).toBe(true);
  });
});

// ─── filterSolicitudesForUser ───

describe('filterSolicitudesForUser', () => {
  const makeSol = (areaId: number): SolicitudRow => ({
    id: 1,
    numero: 'SC-001',
    titulo: 'Test',
    urgencia: 'normal',
    fecha_validacion: null,
    updated_at: new Date(),
    area: { id: areaId, nombre: `Area ${areaId}` },
    solicitante: { nombre: 'Test' },
    items_solicitud: [],
  });

  const solArea1 = makeSol(1);
  const solArea2 = makeSol(2);
  const solicitudes = [solArea1, solArea2];

  const areaConfig: RoleDigestConfig = {
    roleName: 'responsable_area',
    estado: 'pendiente_validacion',
    heading: 'para validar',
    ctaPath: '/solicitudes',
    ctaLabel: 'Ir a Solicitudes',
    filterByArea: true,
  };

  const noFilterConfig: RoleDigestConfig = {
    ...areaConfig,
    roleName: 'director',
    filterByArea: false,
  };

  it('filters by area when filterByArea is true', () => {
    const result = filterSolicitudesForUser(solicitudes, areaConfig, 1);
    expect(result).toHaveLength(1);
    expect(result[0].area?.id).toBe(1);
  });

  it('returns empty if no solicitudes match user area', () => {
    const result = filterSolicitudesForUser(solicitudes, areaConfig, 99);
    expect(result).toHaveLength(0);
  });

  it('returns all when filterByArea is false', () => {
    const result = filterSolicitudesForUser(solicitudes, noFilterConfig, 1);
    expect(result).toHaveLength(2);
  });

  it('returns all when filterByArea is false and userAreaId is null', () => {
    const result = filterSolicitudesForUser(solicitudes, noFilterConfig, null);
    expect(result).toHaveLength(2);
  });
});

// ─── buildSubject ───

describe('buildSubject', () => {
  it('singular non-urgent', () => {
    const s = buildSubject(1, 'para aprobar', false);
    expect(s).toBe('Box — 📋 1 solicitud para aprobar');
  });

  it('plural non-urgent', () => {
    const s = buildSubject(3, 'para aprobar', false);
    expect(s).toBe('Box — 📋 3 solicitudes para aprobar');
  });

  it('singular urgent', () => {
    const s = buildSubject(1, 'para validar', true);
    expect(s).toBe('Box — ⚠️ 1 solicitud pendiente para validar');
  });

  it('plural urgent', () => {
    const s = buildSubject(5, 'para procesar', true);
    expect(s).toBe('Box — ⚠️ 5 solicitudes pendientes para procesar');
  });
});

// ─── ROLE_CONFIGS ───

describe('ROLE_CONFIGS', () => {
  it('has 4 role configurations', () => {
    expect(ROLE_CONFIGS).toHaveLength(4);
  });

  it('maps correct estados', () => {
    const map = Object.fromEntries(ROLE_CONFIGS.map(c => [c.roleName, c.estado]));
    expect(map).toEqual({
      responsable_area: 'pendiente_validacion',
      director: 'validada',
      compras: 'aprobada',
      tesoreria: 'pago_programado',
    });
  });

  it('only responsable_area filters by area', () => {
    for (const config of ROLE_CONFIGS) {
      if (config.roleName === 'responsable_area') {
        expect(config.filterByArea).toBe(true);
      } else {
        expect(config.filterByArea).toBe(false);
      }
    }
  });
});

// ─── URGENCIA_COLORS ───

describe('URGENCIA_COLORS', () => {
  it('has all 5 levels', () => {
    expect(Object.keys(URGENCIA_COLORS)).toEqual(['baja', 'normal', 'media', 'alta', 'critica']);
  });

  it('each has bg, text, and label', () => {
    for (const [, val] of Object.entries(URGENCIA_COLORS)) {
      expect(val).toHaveProperty('bg');
      expect(val).toHaveProperty('text');
      expect(val).toHaveProperty('label');
    }
  });
});

// ─── buildEmailHtml ───

describe('buildEmailHtml', () => {
  const config = ROLE_CONFIGS.find(c => c.roleName === 'director')!;

  const solicitudes: SolicitudRow[] = [
    {
      id: 1,
      numero: 'SC-0012',
      titulo: 'Resmas A4',
      urgencia: 'media',
      fecha_validacion: new Date('2026-04-01'),
      updated_at: new Date('2026-04-01'),
      area: { id: 1, nombre: 'Administración' },
      solicitante: { nombre: 'María López' },
      items_solicitud: [{ precio_estimado: 5000, cantidad: 3 }],
    },
    {
      id: 2,
      numero: 'SC-0015',
      titulo: 'Toner HP',
      urgencia: 'alta',
      fecha_validacion: null,
      updated_at: new Date('2026-04-09'),
      area: { id: 2, nombre: 'Dirección' },
      solicitante: { nombre: 'Carlos García' },
      items_solicitud: [{ precio_estimado: 45000, cantidad: 1 }],
    },
  ];

  it('contains recipient name', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('Joaquín');
  });

  it('contains tenant name', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('Escuela Test');
  });

  it('contains solicitud numbers', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('SC-0012');
    expect(html).toContain('SC-0015');
  });

  it('contains solicitud titles', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('Resmas A4');
    expect(html).toContain('Toner HP');
  });

  it('contains role heading', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('para aprobar');
  });

  it('contains CTA link and label', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config, 'https://app.box.com');
    expect(html).toContain('https://app.box.com/aprobaciones');
    expect(html).toContain('Ir a Aprobaciones');
  });

  it('contains urgencia labels', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('Media');
    expect(html).toContain('Alta');
  });

  it('contains area and solicitante names', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('Administración');
    expect(html).toContain('María López');
    expect(html).toContain('Dirección');
    expect(html).toContain('Carlos García');
  });

  it('contains perfil link for opt-out', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config, 'https://app.box.com');
    expect(html).toContain('https://app.box.com/perfil');
  });

  it('uses singular for 1 solicitud', () => {
    const html = buildEmailHtml('Joaquín', [solicitudes[0]], 'Escuela Test', config);
    expect(html).toContain('1 solicitud para aprobar');
    expect(html).not.toContain('solicitudes para aprobar');
  });

  it('uses plural for multiple solicitudes', () => {
    const html = buildEmailHtml('Joaquín', solicitudes, 'Escuela Test', config);
    expect(html).toContain('2 solicitudes para aprobar');
  });

  it('shows — when area is null', () => {
    const solNoArea: SolicitudRow = {
      ...solicitudes[0],
      area: null,
    };
    const html = buildEmailHtml('Test', [solNoArea], 'Test', config);
    expect(html).toContain('—');
  });

  it('renders valid HTML document', () => {
    const html = buildEmailHtml('Test', solicitudes, 'Test', config);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<table');
    expect(html).toContain('</table>');
  });
});
