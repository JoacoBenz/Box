import { Tag } from 'antd';
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types';
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types';

export function StatusBadge({ estado }: { estado: EstadoSolicitud }) {
  const config = ESTADOS_SOLICITUD[estado] ?? { label: estado, color: 'default' };
  return <Tag color={config.color}>{config.label}</Tag>;
}

export function UrgenciaBadge({ urgencia }: { urgencia: UrgenciaSolicitud }) {
  const config = URGENCIAS[urgencia] ?? { label: urgencia, color: 'default' };
  return <Tag color={config.color}>{config.label}</Tag>;
}
