'use client';

import { useEffect, useState } from 'react';
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
  ShopOutlined,
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
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
    { key: '/proveedores', icon: <ShopOutlined />, label: 'Proveedores', visible: true },
    {
      type: 'group' as const,
      label: collapsed ? '—' : 'Administración',
      visible: roles.includes('admin'),
      children: [
        { key: '/admin/usuarios', icon: <TeamOutlined />, label: 'Usuarios' },
        { key: '/admin/areas', icon: <ApartmentOutlined />, label: 'Áreas' },
      ],
    },
  ]
    .filter((item) => item.visible)
    .map(({ visible, ...item }) => item);

  const selectedKey = items.find(item => 'key' in item && pathname.startsWith(item.key as string) && item.key !== '/')?.key as string
    ?? (pathname === '/' ? '/' : undefined);

  return (
    <>
      <style>{`
        @keyframes sidebarPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .sidebar-icon-pulse {
          animation: sidebarPulse 0.6s ease-in-out 1;
        }
        .ant-layout-sider {
          transition: width 0.25s cubic-bezier(0.2, 0, 0, 1) !important;
        }
        .sidebar-menu .ant-menu-item-selected {
          border-left: 3px solid #4f46e5;
        }
      `}</style>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={240}
        style={{
          background: 'linear-gradient(180deg, #fafbff 0%, #f1f0ff 100%)',
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
          <div
            className={pulse ? 'sidebar-icon-pulse' : undefined}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', letterSpacing: '-0.3px' }}>ComprasEdu</span>}
        </div>
        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          style={{ border: 'none', padding: '12px 4px', background: 'transparent' }}
          items={items}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
    </>
  );
}
