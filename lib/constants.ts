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
  comprada: 'purple',
  recibida: 'lime',
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
  comprada: 'Comprada',
  recibida: 'Recibida',
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
