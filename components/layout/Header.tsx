'use client';

import { useState, useRef } from 'react';
import { Layout, Button, Dropdown, Space, Typography, Avatar, MenuProps, AutoComplete, Input, Tag } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SearchOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter()
  const [searchOptions, setSearchOptions] = useState<any[]>([])
  const searchTimeout = useRef<any>(null)

  const onSearch = (value: string) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value || value.length < 2) { setSearchOptions([]); return }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()

        const options: any[] = []

        if (data.solicitudes?.length > 0) {
          options.push({
            label: <Text type="secondary" style={{ fontSize: 11 }}>SOLICITUDES</Text>,
            options: data.solicitudes.map((s: any) => ({
              value: `solicitud:${s.id}`,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{s.numero} — {s.titulo}</span>
                  <Tag style={{ marginLeft: 8 }}>{s.estado}</Tag>
                </div>
              ),
            })),
          })
        }

        if (data.proveedores?.length > 0) {
          options.push({
            label: <Text type="secondary" style={{ fontSize: 11 }}>PROVEEDORES</Text>,
            options: data.proveedores.map((p: any) => ({
              value: `proveedor:${p.id}`,
              label: <span>{p.nombre} {p.cuit ? `(${p.cuit})` : ''}</span>,
            })),
          })
        }

        setSearchOptions(options)
      } catch {}
    }, 300)
  }

  const onSelect = (value: string) => {
    const [type, id] = value.split(':')
    if (type === 'solicitud') router.push(`/solicitudes/${id}`)
    else if (type === 'proveedor') router.push(`/proveedores`)
    setSearchOptions([])
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar sesión',
      onClick: () => signOut({ callbackUrl: '/login' }),
    },
  ];

  return (
    <AntHeader style={{
      background: '#fff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 64,
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgb(0 0 0 / 0.04)',
    }}>
      <Space>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          style={{ fontSize: 16, width: 38, height: 38, borderRadius: 10, color: '#64748b' }}
        />
        <Text strong style={{ fontSize: 15, color: '#334155' }}>{tenantNombre}</Text>
      </Space>

      <Space size="middle">
        <AutoComplete
          options={searchOptions}
          onSearch={onSearch}
          onSelect={onSelect}
          style={{ width: 300 }}
          popupMatchSelectWidth={400}
        >
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Buscar solicitudes, proveedores..."
            style={{ borderRadius: 8 }}
            allowClear
          />
        </AutoComplete>
      </Space>

      <Space size="middle">
        <NotificationBell />
        <Dropdown menu={{ items: menuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 12, transition: 'background 0.2s' }}>
            <Avatar
              icon={<UserOutlined />}
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              size={34}
            />
            <Space orientation="vertical" size={0} style={{ lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{userName}</Text>
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
