export type RolNombre = 'solicitante' | 'responsable_area' | 'director' | 'tesoreria' | 'compras' | 'admin';

export type EstadoSolicitud =
  | 'borrador'
  | 'enviada'
  | 'devuelta_resp'
  | 'validada'
  | 'devuelta_dir'
  | 'aprobada'
  | 'rechazada'
  | 'comprada'
  | 'recibida'
  | 'recibida_con_obs'
  | 'en_compras'
  | 'pago_programado'
  | 'cerrada';

export type TipoSolicitud = 'formal' | 'caja_chica';
export type PrioridadCompra = 'urgente' | 'normal' | 'programado';

export type UrgenciaSolicitud = 'normal' | 'urgente' | 'critica';

export type MedioPago = 'transferencia' | 'efectivo' | 'cheque' | 'tarjeta' | 'otro';

export type TipoProblema = 'faltante' | 'dañado' | 'diferente' | 'otro';

export type EntidadArchivo = 'solicitud' | 'compra' | 'recepcion';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  tenantId: number;
  areaId: number | null;
  areaNombre: string | null;
  roles: RolNombre[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export const ESTADOS_SOLICITUD: Record<EstadoSolicitud, { label: string; color: string }> = {
  borrador:          { label: 'Borrador',                      color: 'default' },
  enviada:           { label: 'Enviada',                       color: 'blue' },
  devuelta_resp:     { label: 'Devuelta',                      color: 'orange' },
  validada:          { label: 'Validada',                      color: 'cyan' },
  devuelta_dir:      { label: 'Devuelta por Aprobador',         color: 'orange' },
  aprobada:          { label: 'Aprobada',                      color: 'green' },
  en_compras:        { label: 'En Compras',                    color: 'processing' },
  pago_programado:   { label: 'Pago Programado',               color: 'purple' },
  rechazada:         { label: 'Rechazada',                     color: 'red' },
  comprada:          { label: 'Comprada',                      color: 'geekblue' },
  recibida:          { label: 'Recibida',                      color: 'lime' },
  recibida_con_obs:  { label: 'Recibida con observaciones',    color: 'gold' },
  cerrada:           { label: 'Cerrada',                       color: 'purple' },
};

export const URGENCIAS: Record<UrgenciaSolicitud, { label: string; color: string }> = {
  normal:  { label: 'Normal',  color: 'default' },
  urgente: { label: 'Urgente', color: 'orange' },
  critica: { label: 'Crítica', color: 'red' },
};
