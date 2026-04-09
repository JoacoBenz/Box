'use client';

import { useEffect, useState } from 'react';
import { Layout, Menu, Select, Tag } from 'antd';
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
  ShoppingCartOutlined,
  BankOutlined,
  GlobalOutlined,
  AuditOutlined,
  KeyOutlined,
  SettingOutlined,
  CloseCircleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import type { RolNombre } from '@/types';
import { useAdminTenant } from '@/components/admin/TenantSelector';
import { useTheme } from '@/components/ThemeProvider';

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

interface TenantOption {
  id: number;
  nombre: string;
}

export function Sidebar({ roles, pendientes = {}, collapsed }: SidebarProps) {
  const { tokens } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [pulse, setPulse] = useState(true);
  const isSuperAdmin = roles.includes('super_admin');
  const isAdmin = isSuperAdmin; // Only super_admin sees cross-org features
  const isOrgAdmin = roles.includes('admin'); // Org-level admin
  const [selectedTenant, setSelectedTenant] = useAdminTenant();
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch tenants for admin org selector
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/tenants')
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setTenants(data.map(t => ({ id: t.id, nombre: t.nombre }))))
      .catch(() => {});
  }, [isAdmin]);

  const hasOrgSelected = isAdmin ? selectedTenant !== null : true;
  const selectedTenantName = tenants.find(t => t.id === selectedTenant)?.nombre;

  // Build menu items based on role and org selection
  const items: any[] = [];

  // Always visible
  items.push({ key: '/', icon: <DashboardOutlined />, label: 'Dashboard', visible: true });

  if (isAdmin) {
    // Admin: platform items always visible
    items.push({ key: '/gestion/tenants', icon: <GlobalOutlined />, label: 'Organizaciones', visible: true });
    items.push({ key: '/gestion/aprobaciones-org', icon: <AuditOutlined />, label: 'Aprobaciones Org', visible: true });

    // Org-scoped items only when an org is selected (super_admin sees everything like a director)
    if (hasOrgSelected) {
      items.push({ key: '/solicitudes', icon: <FileTextOutlined />, label: 'Solicitudes', visible: true });
      items.push({ key: '/validaciones', icon: <CheckCircleOutlined />, label: 'Validaciones', visible: true });
      items.push({ key: '/aprobaciones', icon: <ThunderboltOutlined />, label: 'Aprobaciones', visible: true });
      items.push({ key: '/compras', icon: <DollarOutlined />, label: 'Compras', visible: true });
      items.push({ key: '/gestion-compras', icon: <ShoppingCartOutlined />, label: 'Gestión Compras', visible: true });
      items.push({ key: '/recepciones', icon: <InboxOutlined />, label: 'Recepciones', visible: true });
      items.push({ key: '/proveedores', icon: <ShopOutlined />, label: 'Proveedores', visible: true });
      items.push({ key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes', visible: true });
      items.push({
        type: 'group' as const,
        label: collapsed ? '—' : 'Gestión Org',
        visible: true,
        children: [
          { key: '/gestion/usuarios', icon: <TeamOutlined />, label: 'Usuarios' },
          { key: '/gestion/areas', icon: <ApartmentOutlined />, label: 'Áreas' },
          { key: '/gestion/centros-costo', icon: <BankOutlined />, label: 'Centros de Costo' },
          { key: '/gestion/invitaciones', icon: <KeyOutlined />, label: 'Invitaciones' },
          { key: '/gestion/configuracion-sso', icon: <SettingOutlined />, label: 'Config SSO' },
        ],
      });
    }
  } else {
    // Non-admin: original menu logic
    items.push({ key: '/solicitudes/nueva', icon: <PlusCircleOutlined />, label: 'Nueva Solicitud', visible: roles.includes('solicitante') });
    items.push({ key: '/solicitudes', icon: <FileTextOutlined />, label: roles.includes('director') || roles.includes('tesoreria') ? 'Solicitudes' : 'Mis Solicitudes', visible: roles.includes('solicitante') || roles.includes('director') || roles.includes('tesoreria') || roles.includes('responsable_area') || roles.includes('compras') });
    items.push({
      key: '/validaciones',
      icon: <CheckCircleOutlined />,
      label: pendientes.validaciones ? `Validaciones (${pendientes.validaciones})` : 'Validaciones',
      visible: roles.includes('responsable_area'),
    });
    items.push({
      key: '/aprobaciones',
      icon: <ThunderboltOutlined />,
      label: pendientes.aprobaciones ? `Aprobaciones (${pendientes.aprobaciones})` : 'Aprobaciones',
      visible: roles.includes('director'),
    });
    items.push({
      key: '/compras',
      icon: <DollarOutlined />,
      label: pendientes.compras ? `Compras (${pendientes.compras})` : 'Compras',
      visible: roles.includes('tesoreria'),
    });
    items.push({
      key: '/recepciones',
      icon: <InboxOutlined />,
      label: pendientes.recepciones ? `Recepciones (${pendientes.recepciones})` : 'Recepciones',
      visible: roles.includes('solicitante') || roles.includes('responsable_area'),
    });
    items.push({
      key: '/gestion-compras',
      icon: <ShoppingCartOutlined />,
      label: pendientes.compras ? `Gestión Compras (${pendientes.compras})` : 'Gestión Compras',
      visible: roles.includes('compras'),
    });
    items.push({ key: '/proveedores', icon: <ShopOutlined />, label: 'Proveedores', visible: true });
    items.push({ key: '/reportes', icon: <BarChartOutlined />, label: 'Reportes', visible: roles.includes('director') || roles.includes('compras') || roles.includes('tesoreria') || roles.includes('admin') });
    items.push({ key: '/mi-area/usuarios', icon: <TeamOutlined />, label: 'Usuarios de mi Área', visible: roles.includes('responsable_area') && !roles.includes('admin') && !roles.includes('director') });

    if (roles.includes('director') || isOrgAdmin) {
      const adminChildren = [
        { key: '/gestion/usuarios', icon: <TeamOutlined />, label: 'Usuarios' },
        { key: '/gestion/areas', icon: <ApartmentOutlined />, label: 'Áreas' },
        { key: '/gestion/centros-costo', icon: <BankOutlined />, label: 'Centros de Costo' },
        { key: '/gestion/invitaciones', icon: <KeyOutlined />, label: 'Invitaciones' },
      ];
      if (isOrgAdmin) {
        adminChildren.push({ key: '/gestion/configuracion-sso', icon: <SettingOutlined />, label: 'Config SSO' });
      }
      items.push({
        type: 'group' as const,
        label: collapsed ? '—' : 'Administración',
        visible: true,
        children: adminChildren,
      });
    }
  }

  const filteredItems = items
    .filter((item) => item.visible)
    .map(({ visible, ...item }) => item);

  const selectedKey = filteredItems.find(item => 'key' in item && pathname.startsWith(item.key as string) && item.key !== '/')?.key as string
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
          border-left: 3px solid ${tokens.colorPrimary};
        }
      `}</style>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={240}
        style={{
          background: tokens.sidebarBg,
          borderRight: 'none',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          borderBottom: `1px solid ${tokens.sidebarBorder}`,
        }}>
          <div
            className={pulse ? 'sidebar-icon-pulse' : undefined}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: tokens.logoGradient,
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
          {!collapsed && <span style={{ fontWeight: 700, fontSize: 15, color: tokens.textPrimary, letterSpacing: '-0.3px' }}>Box</span>}
        </div>

        {/* Admin org selector */}
        {isAdmin && !collapsed && (
          <div style={{ padding: '12px 12px 0' }}>
            <Select
              value={selectedTenant}
              onChange={(val: number | null) => { setSelectedTenant(val); if (val === undefined || val === null) router.push('/'); }}
              placeholder="Seleccionar organización..."
              allowClear
              showSearch
              optionFilterProp="label"
              size="small"
              style={{ width: '100%' }}
              options={tenants.map(t => ({ value: t.id, label: t.nombre }))}
            />
          </div>
        )}

        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          style={{ border: 'none', padding: '12px 4px', background: 'transparent' }}
          items={filteredItems}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>
    </>
  );
}
