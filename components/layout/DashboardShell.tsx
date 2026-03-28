'use client';

import { useState } from 'react';
import { Layout } from 'antd';
import { Sidebar } from './Sidebar';
import { AppHeader } from './Header';
import type { RolNombre } from '@/types';

const { Content } = Layout;

interface DashboardShellProps {
  tenantNombre: string;
  userName: string;
  areaNombre: string | null;
  roles: RolNombre[];
  children: React.ReactNode;
}

export function DashboardShell({ tenantNombre, userName, areaNombre, roles, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const rolPrincipal = roles.includes('admin') ? 'admin'
    : roles.includes('director') ? 'director'
    : roles.includes('tesoreria') ? 'tesoreria'
    : roles.includes('responsable_area') ? 'responsable_area'
    : 'solicitante';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar roles={roles} collapsed={collapsed} />
      <Layout>
        <AppHeader
          tenantNombre={tenantNombre}
          userName={userName}
          areaNombre={areaNombre}
          rolPrincipal={rolPrincipal}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
        <Content style={{ margin: 24, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
