import type { EstadoSolicitud, UrgenciaSolicitud } from './index';

/** Minimal solicitud summary returned by dashboard */
export interface SolicitudResumen {
  id: number;
  numero: string;
  titulo: string;
  estado: EstadoSolicitud;
  urgencia: UrgenciaSolicitud;
  created_at: string;
  prioridad_compra?: string | null;
  dia_pago_programado?: string | null;
}

export interface EstadoCantidad {
  estado: string;
  cantidad: number;
}

export interface AreaGasto {
  area: string;
  total: number;
  cantidad: number;
}

export interface TendenciaMensual {
  mes: string;
  total: number;
  cantidad: number;
}

export interface MedioPagoGasto {
  medioPago: string;
  total: number;
  cantidad: number;
}

export interface ProveedorGasto {
  proveedor: string;
  total: number;
  cantidad: number;
}

export interface CrecimientoMensual {
  mes: string;
  cantidad: number;
}

export interface OrgTopUso {
  id: number;
  org: string;
  estado: string;
  usuarios: number;
  ultimoAcceso: string | null;
}

export interface AdminPlatformData {
  totalOrganizaciones: number;
  orgActivas: number;
  orgPendientes: number;
  orgSuspendidas: number;
  totalUsuariosPlataforma: number;
  usuariosNuevosMes: number;
  orgsNuevasMes: number;
  orgsDormidas: number;
  promedioUsuariosPorOrg: number;
  crecimientoOrgs: CrecimientoMensual[];
  crecimientoUsuarios: CrecimientoMensual[];
  orgsTopUso: OrgTopUso[];
}

export interface DashboardData {
  // Areas (director selector)
  areasDisponibles?: { id: number; nombre: string }[];

  // Solicitante
  misSolicitudes?: SolicitudResumen[];
  solicitudesEnEjecucion?: number;
  solicitudesDevueltas?: number;
  recepcionesPendientes?: number;
  solicitudesMesSolicitante?: number;
  tasaAprobacion?: number;
  misSolicitudesPorEstado?: EstadoCantidad[];

  // Responsable
  pendientesValidar?: number;
  solicitudesArea?: SolicitudResumen[];
  solicitudesAreaMes?: number;
  devueltasArea?: number;
  gastoAreaMes?: number;
  gastoAreaAño?: number;
  solicitudesAreaPorEstado?: EstadoCantidad[];

  // Director
  pendientesAprobar?: number;
  aprobadasSemana?: number;
  rechazadasSemana?: number;
  urgentesPendientesDir?: number;

  // Compras
  solicitudesAprobadas?: number;
  solicitudesEnCompras?: number;
  pagoProgramado?: number;
  urgentesPipeline?: number;
  pipeline?: SolicitudResumen[];
  tiempoPromedioPipeline?: number;

  // Tesorería
  pendientesComprar?: number;
  recepcionesConObs?: number;
  pagoProgramadoProximo?: number;
  ultimasCompras?: any[];
  comprasSinRecepcion?: number;

  // Analytics
  gastoAnual?: number;
  gastoMensual?: number;
  gastoPorArea?: AreaGasto[];
  tendenciaMensual?: TendenciaMensual[];
  gastoPorMedioPago?: MedioPagoGasto[];
  topProveedores?: ProveedorGasto[];
  solicitudesPorEstado?: EstadoCantidad[];
  solicitudesPorUrgencia?: { urgencia: string; cantidad: number }[];

  // Admin
  adminPlatform?: AdminPlatformData;
}
