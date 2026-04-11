export const ESTADOS_SOLICITUD = {
  BORRADOR: 'borrador',
  ENVIADA: 'enviada',
  PENDIENTE_VALIDACION: 'pendiente_validacion',
  VALIDADA: 'validada',
  RECHAZADA: 'rechazada',
  APROBADA: 'aprobada',
  EN_COMPRAS: 'en_compras',
  PAGO_PROGRAMADO: 'pago_programado',
  ABONADA: 'abonada',
  RECIBIDA_CON_OBS: 'recibida_con_obs',
  CERRADA: 'cerrada',
  ANULADA: 'anulada',
} as const;

export type EstadoSolicitud = typeof ESTADOS_SOLICITUD[keyof typeof ESTADOS_SOLICITUD];

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
  abonada: 'Abonada',
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
