'use client';

import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  PlusCircleOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  InboxOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import type { RolNombre } from '@/types';

const { Sider } = Layout;

interface SidebarProps {
  roles: RolNombre[];
  pendientes?: {
    validaciones?: number;
    aprobaciones?: number;
    compras?: number;
    recepciones?: number;
  };
  collapsed: boolean;
}

export function Sidebar({ roles, pendientes = {}, collapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', visible: true },
    { key: '/solicitudes/nueva', icon: <PlusCircleOutlined />, label: 'Nueva Solicitud', visible: roles.includes('solicitante') },
    { key: '/solicitudes', icon: <FileTextOutlined />, label: 'Mis Solicitudes', visible: roles.includes('solicitante') },
    {
      key: '/validaciones',
      icon: <CheckCircleOutlined />,
      label: pendientes.validaciones ? `Validaciones (${pendientes.validaciones})` : 'Validaciones',
      visible: roles.includes('responsable_area'),
    },
    {
      key: '/aprobaciones',
      icon: <ThunderboltOutlined />,
      label: pendientes.aprobaciones ? `Aprobaciones (${pendientes.aprobaciones})` : 'Aprobaciones',
      visible: roles.includes('director'),
    },
    {
      key: '/compras',
      icon: <DollarOutlined />,
      label: pendientes.compras ? `Compras (${pendientes.compras})` : 'Compras',
      visible: roles.includes('tesoreria'),
    },
    {
      key: '/recepciones',
      icon: <InboxOutlined />,
      label: pendientes.recepciones ? `Recepciones (${pendientes.recepciones})` : 'Recepciones',
      visible: roles.includes('solicitante') || roles.includes('responsable_area'),
    },
    { type: 'divider' as const, visible: roles.includes('admin') },
    { key: '/admin/usuarios', icon: <TeamOutlined />, label: 'Usuarios', visible: roles.includes('admin') },
    { key: '/admin/areas', icon: <ApartmentOutlined />, label: 'Áreas', visible: roles.includes('admin') },
  ]
    .filter((item) => item.visible)
    .map(({ visible, ...item }) => item);

  const selectedKey = items.find(item => 'key' in item && pathname.startsWith(item.key as string) && item.key !== '/')?.key as string
    ?? (pathname === '/' ? '/' : undefined);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={220}
      style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
    >
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
        {!collapsed && <span style={{ fontWeight: 700, fontSize: 14, color: '#1677ff' }}>Gestión de Compras</span>}
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        style={{ border: 'none', paddingTop: 8 }}
        items={items}
        onClick={({ key }) => router.push(key)}
      />
    </Sider>
  );
}
