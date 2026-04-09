import { describe, it, expect } from 'vitest';
import { calcularMatching } from '@/lib/matching';

describe('calcularMatching', () => {
  const makeItems = (items: { id: number; cantidad: number; precio_estimado: number }[]) => items;

  it('returns matched true when all quantities and prices match exactly', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1000 },
      [{ item_solicitud_id: 1, cantidad_recibida: 10 }],
      items
    );
    expect(result.matched).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
    expect(result.montoSolicitud).toBe(1000);
    expect(result.montoCompra).toBe(1000);
    expect(result.montoRecibido).toBe(1000);
  });

  it('accepts price variance under 10%', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1090 }, // 9% over
      [{ item_solicitud_id: 1, cantidad_recibida: 10 }],
      items
    );
    expect(result.matched).toBe(true);
  });

  it('detects price variance over 10%', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1200 }, // 20% over
      [{ item_solicitud_id: 1, cantidad_recibida: 10 }],
      items
    );
    expect(result.matched).toBe(false);
    expect(result.discrepancies.some(d => d.includes('Varianza de precio'))).toBe(true);
  });

  it('detects quantity shortfall', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1000 },
      [{ item_solicitud_id: 1, cantidad_recibida: 7 }],
      items
    );
    expect(result.matched).toBe(false);
    expect(result.discrepancies.some(d => d.includes('faltante: 3'))).toBe(true);
    expect(result.montoRecibido).toBe(700);
  });

  it('detects quantity excess', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1000 },
      [{ item_solicitud_id: 1, cantidad_recibida: 12 }],
      items
    );
    expect(result.matched).toBe(false);
    expect(result.discrepancies.some(d => d.includes('excedente: 2'))).toBe(true);
  });

  it('handles multiple items with mixed discrepancies', () => {
    const items = makeItems([
      { id: 1, cantidad: 5, precio_estimado: 200 },
      { id: 2, cantidad: 10, precio_estimado: 50 },
    ]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1500 },
      [
        { item_solicitud_id: 1, cantidad_recibida: 5 },
        { item_solicitud_id: 2, cantidad_recibida: 8 },
      ],
      items
    );
    expect(result.matched).toBe(false);
    expect(result.discrepancies).toHaveLength(1); // only item 2 has shortfall
    expect(result.montoSolicitud).toBe(1500);
  });

  it('returns correct montos', () => {
    const items = makeItems([
      { id: 1, cantidad: 2, precio_estimado: 500 },
      { id: 2, cantidad: 3, precio_estimado: 100 },
    ]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1350 },
      [
        { item_solicitud_id: 1, cantidad_recibida: 2 },
        { item_solicitud_id: 2, cantidad_recibida: 3 },
      ],
      items
    );
    expect(result.montoSolicitud).toBe(1300);
    expect(result.montoCompra).toBe(1350);
    expect(result.montoRecibido).toBe(1300);
  });

  it('handles null compra', () => {
    const items = makeItems([{ id: 1, cantidad: 5, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      null,
      [{ item_solicitud_id: 1, cantidad_recibida: 5 }],
      items
    );
    expect(result.montoCompra).toBe(0);
    expect(result.matched).toBe(true);
  });

  it('handles empty items recibidos', () => {
    const items = makeItems([{ id: 1, cantidad: 5, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 500 },
      [],
      items
    );
    expect(result.matched).toBe(false);
    expect(result.discrepancies.some(d => d.includes('faltante: 5'))).toBe(true);
    expect(result.montoRecibido).toBe(0);
  });

  it('handles items with null precio_estimado', () => {
    const items = [{ id: 1, cantidad: 5, precio_estimado: null as any }];
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 0 },
      [{ item_solicitud_id: 1, cantidad_recibida: 5 }],
      items
    );
    expect(result.montoSolicitud).toBe(0);
    expect(result.montoRecibido).toBe(0);
    expect(result.matched).toBe(true);
  });

  it('aggregates multiple receipt records for same item', () => {
    const items = makeItems([{ id: 1, cantidad: 10, precio_estimado: 100 }]);
    const result = calcularMatching(
      { items_solicitud: items },
      { monto_total: 1000 },
      [
        { item_solicitud_id: 1, cantidad_recibida: 6 },
        { item_solicitud_id: 1, cantidad_recibida: 4 },
      ],
      items
    );
    expect(result.matched).toBe(true);
    expect(result.montoRecibido).toBe(1000);
  });
});
