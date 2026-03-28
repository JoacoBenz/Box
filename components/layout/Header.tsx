'use client';

import { Layout, Button, Dropdown, Space, Typography, Avatar, MenuProps } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { NotificationBell } from './NotificationBell';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  tenantNombre: string;
  userName: string;
  areaNombre: string | null;
  rolPrincipal: string;
  collapsed: boolean;
  onToggle: () => void;
}

const ROL_LABELS: Record<string, string> = {
  admin: 'Admin',
  director: 'Director',
  tesoreria: 'Tesorería',
  responsable_area: 'Responsable',
  solicitante: 'Solicitante',
};

export function AppHeader({ tenantNombre, userName, areaNombre, rolPrincipal, collapsed, onToggle }: HeaderProps) {
  const menuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar sesión',
      onClick: () => signOut({ callbackUrl: '/login' }),
    },
  ];

  return (
    <AntHeader style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 100 }}>
      <Space>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{ fontSize: 16, width: 40, height: 40 }}
        />
        <Text strong style={{ fontSize: 15 }}>{tenantNombre}</Text>
      </Space>

      <Space size="middle">
        <NotificationBell />
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} size="small" />
            <Space orientation="vertical" size={0} style={{ lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: 13 }}>{userName}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {areaNombre ? `${areaNombre} · ` : ''}{ROL_LABELS[rolPrincipal] ?? rolPrincipal}
              </Text>
            </Space>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
