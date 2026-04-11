export interface MatchingResult {
  matched: boolean;
  discrepancies: string[];
  montoSolicitud: number;
  montoCompra: number;
  montoRecibido: number;
}

/**
 * 3-way matching: compares solicitud estimate vs compra amount vs received quantities.
 * Returns discrepancies for review.
 */
export function calcularMatching(
  solicitud: { items_solicitud?: Array<{ cantidad: any; precio_estimado: any }> },
  compra: { monto_total: any } | null,
  itemsRecibidos: Array<{ item_solicitud_id: number; cantidad_recibida: any }>,
  itemsSolicitud: Array<{ id: number; cantidad: any; precio_estimado: any }>
): MatchingResult {
  const discrepancies: string[] = [];
  const montoSolicitud = itemsSolicitud.reduce((acc, item) => {
    const cantidad = Number(item.cantidad);
    const precio = Number(item.precio_estimado ?? 0);
    return acc + (isNaN(cantidad) || isNaN(precio) ? 0 : cantidad * precio);
  }, 0);
  const montoCompra = compra ? Number(compra.monto_total) : 0;

  // 1. Price variance: compra vs solicitud estimate
  if (montoSolicitud > 0 && montoCompra > 0) {
    const varianza = Math.abs(montoCompra - montoSolicitud) / montoSolicitud;
    if (varianza > 0.1) { // >10% variance
      discrepancies.push(
        `Varianza de precio: estimado $${montoSolicitud.toLocaleString()}, comprado $${montoCompra.toLocaleString()} (${(varianza * 100).toFixed(1)}%)`
      );
    }
  }

  // 2. Quantity variance: received vs ordered
  const receivedByItem = new Map<number, number>();
  for (const ri of itemsRecibidos) {
    const current = receivedByItem.get(ri.item_solicitud_id) ?? 0;
    const cantRecibida = Number(ri.cantidad_recibida);
    receivedByItem.set(ri.item_solicitud_id, current + (isNaN(cantRecibida) ? 0 : cantRecibida));
  }

  let montoRecibido = 0;
  for (const item of itemsSolicitud) {
    const orderedRaw = Number(item.cantidad);
    const ordered = isNaN(orderedRaw) ? 0 : orderedRaw;
    const received = receivedByItem.get(item.id) ?? 0;
    const precioRaw = Number(item.precio_estimado ?? 0);
    const precio = isNaN(precioRaw) ? 0 : precioRaw;
    montoRecibido += received * precio;

    if (received < ordered) {
      discrepancies.push(
        `Ítem #${item.id}: pedido ${ordered}, recibido ${received} (faltante: ${ordered - received})`
      );
    } else if (received > ordered) {
      discrepancies.push(
        `Ítem #${item.id}: pedido ${ordered}, recibido ${received} (excedente: ${received - ordered})`
      );
    }
  }

  return {
    matched: discrepancies.length === 0,
    discrepancies,
    montoSolicitud,
    montoCompra,
    montoRecibido,
  };
}
