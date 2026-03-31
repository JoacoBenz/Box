'use client';

import { useState, useRef, useEffect } from 'react';
import { Layout, Button, Dropdown, Space, Typography, Avatar, MenuProps, AutoComplete, Input, Tag } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SearchOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import TenantSelector, { useAdminTenant } from '@/components/admin/TenantSelector';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  tenantNombre: string;
  userName: string;
  areaNombre: string | null;
  rolPrincipal: string;
  roles: string[];
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

export function AppHeader({ tenantNombre, userName, areaNombre, rolPrincipal, roles, collapsed, onToggle }: HeaderProps) {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const isAdmin = roles.includes('admin')
  const [selectedTenant, setSelectedTenant] = useAdminTenant()
  const [searchOptions, setSearchOptions] = useState<any[]>([])
  const searchTimeout = useRef<any>(null)
  const inputRef = useRef<any>(null)

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => {
      // AutoComplete exposes focus() directly
      inputRef.current?.focus?.()
      // Fallback: find the input element in the DOM
      if (!inputRef.current?.focus) {
        const el = document.querySelector('.search-overlay-input input') as HTMLInputElement
        el?.focus()
      }
    }, 50)
  }, [searchOpen])

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
            label: <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitudes</Text>,
            options: data.solicitudes.map((s: any) => ({
              value: `solicitud:${s.id}`,
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Text style={{ color: '#4f46e5', fontWeight: 600, fontSize: 12 }}>{s.numero}</Text>
                    <Text type="secondary" style={{ marginLeft: 6, fontSize: 13 }}>{s.titulo}</Text>
                  </span>
                  <Tag style={{ margin: 0, flexShrink: 0, fontSize: 11 }}>{s.estado}</Tag>
                </div>
              ),
            })),
          })
        }

        if (data.proveedores?.length > 0) {
          options.push({
            label: <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proveedores</Text>,
            options: data.proveedores.map((p: any) => ({
              value: `proveedor:${p.id}`,
              label: (
                <span style={{ fontSize: 13 }}>
                  {p.nombre}
                  {p.cuit && <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>{p.cuit}</Text>}
                </span>
              ),
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
    else if (type === 'proveedor') router.push(`/proveedores/${id}/compras`)
    setSearchOptions([])
    setSearchOpen(false)
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
    <>
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
          {isAdmin && (
            <TenantSelector value={selectedTenant} onChange={setSelectedTenant} compact />
          )}
        </Space>

        <Space size="middle">
          <Button
            type="text"
            icon={<SearchOutlined />}
            onClick={() => setSearchOpen(true)}
            style={{
              borderRadius: 10,
              color: '#94a3b8',
              height: 36,
              padding: '0 12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>Buscar...</span>
            <kbd style={{
              fontSize: 10,
              color: '#94a3b8',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              padding: '1px 5px',
              fontFamily: 'inherit',
            }}>
              Ctrl K
            </kbd>
          </Button>
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

      {/* Search overlay (Spotlight-style) */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 120,
            animation: 'searchFadeIn 0.15s ease-out',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              height: 'fit-content',
            }}
          >
            <AutoComplete
              ref={inputRef}
              className="search-overlay-input"
              options={searchOptions}
              onSearch={onSearch}
              onSelect={onSelect}
              style={{ width: '100%' }}
              popupMatchSelectWidth={520}
              open={searchOptions.length > 0}
              onKeyDown={(e: any) => { if (e.key === 'Escape') setSearchOpen(false) }}
            >
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 16 }} />}
                placeholder="Buscar solicitudes, proveedores..."
                allowClear
                size="large"
                style={{
                  borderRadius: 14,
                  fontSize: 15,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
                  border: 'none',
                  padding: '10px 16px',
                }}
              />
            </AutoComplete>
          </div>
        </div>
      )}

      <style>{`
        @keyframes searchFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}
