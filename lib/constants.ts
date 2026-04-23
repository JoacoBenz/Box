export const ESTADO_COLOR: Record<string, string> = {
  borrador: 'default',
  enviada: 'processing',
  devuelta_resp: 'warning',
  devuelta_dir: 'warning',
  validada: 'cyan',
  aprobada: 'green',
  en_compras: 'processing',
  pago_programado: 'purple',
  rechazada: 'red',
  abonada: 'purple',
  recibida_con_obs: 'orange',
  cerrada: 'default',
  anulada: 'default',
};

export const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  devuelta_resp: 'Devuelta (Resp.)',
  devuelta_dir: 'Devuelta (Dir.)',
  validada: 'Validada',
  aprobada: 'Aprobada',
  en_compras: 'En Compras',
  pago_programado: 'Pago Programado',
  rechazada: 'Rechazada',
  abonada: 'Abonada',
  recibida_con_obs: 'Recibida c/obs',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
};

export const URGENCIA_COLOR: Record<string, string> = {
  baja: 'green',
  normal: 'blue',
  urgente: 'orange',
  critica: 'red',
};

export const URGENCIA_LABEL: Record<string, string> = {
  baja: 'Baja',
  normal: 'Normal',
  urgente: 'Urgente',
  critica: 'Crítica',
};

/**
 * Canonical display for a `urgencia` value. Falls back to capitalizing the first letter
 * of an unknown value so tables never show raw lowercase strings like "alta".
 */
export function urgenciaLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return URGENCIA_LABEL[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}
