'use client';

import { useState, useEffect } from 'react';
import { App, Layout } from 'antd';
import { Sidebar } from './Sidebar';
import { AppHeader } from './Header';
import type { RolNombre } from '@/types';
import { useTheme } from '@/components/ThemeProvider';

const { Content } = Layout;

const MOBILE_BREAKPOINT = 768;

interface DashboardShellProps {
  tenantNombre: string;
  userName: string;
  areaNombre: string | null;
  roles: RolNombre[];
  children: React.ReactNode;
}

export function DashboardShell({ tenantNombre, userName, areaNombre, roles, children }: DashboardShellProps) {
  const { tokens } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const rolPrincipal = roles.includes('super_admin') ? 'super_admin'
    : roles.includes('admin') ? 'admin'
    : roles.includes('director') ? 'director'
    : roles.includes('tesoreria') ? 'tesoreria'
    : roles.includes('responsable_area') ? 'responsable_area'
    : 'solicitante';

  const siderWidth = isMobile ? 0 : (collapsed ? 80 : 240);

  const handleToggle = () => {
    if (isMobile) {
      setDrawerOpen(!drawerOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  return (
    <App>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar
          roles={roles}
          collapsed={isMobile ? false : collapsed}
          isMobile={isMobile}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
        />
        <Layout style={{ background: tokens.bgLayout, marginLeft: siderWidth, transition: 'margin-left 0.25s cubic-bezier(0.2, 0, 0, 1)' }}>
          <AppHeader
            tenantNombre={tenantNombre}
            userName={userName}
            areaNombre={areaNombre}
            rolPrincipal={rolPrincipal}
            roles={roles}
            collapsed={collapsed}
            onToggle={handleToggle}
          />
          <Content style={{ margin: isMobile ? '12px 12px 16px' : '20px 24px 24px', minHeight: 280 }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </App>
  );
}
