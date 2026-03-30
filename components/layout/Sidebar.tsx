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
      width={240}
      style={{
        background: '#fff',
        borderRight: 'none',
      }}
    >
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        </div>
        {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', letterSpacing: '-0.3px' }}>ComprasEdu</span>}
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        style={{ border: 'none', padding: '12px 4px', background: 'transparent' }}
        items={items}
        onClick={({ key }) => router.push(key)}
      />
    </Sider>
  );
}
