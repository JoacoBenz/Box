'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Layout, Button, Dropdown, Space, Typography, Avatar, MenuProps, Tag, Input } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, LogoutOutlined, SearchOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import TenantSelector, { useAdminTenant } from '@/components/admin/TenantSelector';
import { ESTADO_COLOR, ESTADO_LABEL } from '@/lib/constants';

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


interface SearchResult {
  solicitudes: { id: number; numero: string; titulo: string; estado: string; urgencia: string }[];
  proveedores: { id: number; nombre: string; cuit: string }[];
}

export function AppHeader({ tenantNombre, userName, areaNombre, rolPrincipal, roles, collapsed, onToggle }: HeaderProps) {
  const router = useRouter()
  const isAdmin = roles.includes('admin')
  const [selectedTenant, setSelectedTenant] = useAdminTenant()

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const searchTimeout = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') closeSearch()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 80)
  }, [searchOpen])

  // Close on click outside
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [searchOpen])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setResults(null)
    setSearching(false)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
  }, [])

  const handleSearch = (value: string) => {
    setQuery(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value || value.length < 2) { setResults(null); setSearching(false); return }

    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setResults(data)
      } catch {
        setResults(null)
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  const handleSelect = (type: string, id: number) => {
    if (type === 'solicitud') router.push(`/solicitudes/${id}`)
    else if (type === 'proveedor') router.push(`/proveedores/${id}/compras`)
    closeSearch()
  }

  const hasResults = results && (results.solicitudes?.length > 0 || results.proveedores?.length > 0)
  const noResults = results && !hasResults && query.length >= 2

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
          {/* Search bar */}
          <div ref={containerRef} style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                border: '1px solid',
                borderColor: searchOpen ? '#4f46e5' : '#e2e8f0',
                borderRadius: 10,
                height: 36,
                width: searchOpen ? 320 : 160,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                background: searchOpen ? '#fff' : '#fafafa',
                boxShadow: searchOpen ? '0 0 0 3px rgba(79, 70, 229, 0.1)' : 'none',
                overflow: 'hidden',
                cursor: searchOpen ? 'text' : 'pointer',
              }}
              onClick={() => { if (!searchOpen) setSearchOpen(true) }}
            >
              <SearchOutlined style={{ color: searchOpen ? '#4f46e5' : '#94a3b8', fontSize: 14, marginLeft: 10, flexShrink: 0 }} />
              {searchOpen ? (
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar solicitudes, proveedores..."
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    flex: 1,
                    fontSize: 13,
                    padding: '0 8px',
                    color: '#1e293b',
                    height: '100%',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Escape') closeSearch() }}
                />
              ) : (
                <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400, padding: '0 8px', flex: 1 }}>Buscar...</span>
              )}
              {searchOpen && query ? (
                <Button
                  type="text"
                  size="small"
                  icon={searching ? <LoadingOutlined spin /> : <CloseOutlined />}
                  onClick={(e) => { e.stopPropagation(); if (!searching) { setQuery(''); setResults(null); inputRef.current?.focus() } }}
                  style={{ color: '#94a3b8', marginRight: 4, width: 24, height: 24, minWidth: 24 }}
                />
              ) : null}
            </div>

            {/* Results dropdown */}
            {searchOpen && (hasResults || noResults) && (
              <div style={{
                position: 'absolute',
                top: 42,
                right: 0,
                width: 400,
                maxHeight: 420,
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
                zIndex: 1001,
                animation: 'searchDropIn 0.15s ease-out',
              }}>
                {noResults && (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Sin resultados para &ldquo;{query}&rdquo;</Text>
                  </div>
                )}

                {results?.solicitudes?.length > 0 && (
                  <div>
                    <div style={{ padding: '7px 15px 5px', fontSize: 12, fontWeight: 700, color: '#526077', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f1f5f9', lineHeight: 1.2, borderBottom: '1px solid #e2e8f0' }}>
                      Solicitudes
                    </div>
                    {results.solicitudes.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelect('solicitud', s.id)}
                        style={{
                          padding: '8px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'background 0.15s',
                          borderBottom: '1px solid #f5f5f5',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <div style={{ color: '#4f46e5', fontWeight: 600, fontSize: 12 }}>{s.numero}</div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8c8c8c', fontSize: 12 }}>{s.titulo}</div>
                        </div>
                        <Tag color={ESTADO_COLOR[s.estado] ?? 'default'} style={{ margin: 0, flexShrink: 0, fontSize: 11 }}>{ESTADO_LABEL[s.estado] ?? s.estado}</Tag>
                      </div>
                    ))}
                  </div>
                )}

                {results?.proveedores?.length > 0 && (
                  <div>
                    {results?.solicitudes?.length > 0 && <div style={{ borderTop: '1px solid #f1f5f9' }} />}
                    <div style={{ padding: '7px 15px 5px', fontSize: 12, fontWeight: 700, color: '#526077', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f1f5f9', lineHeight: 1.2, borderBottom: '1px solid #e2e8f0' }}>
                      Proveedores
                    </div>
                    {results.proveedores.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelect('proveedor', p.id)}
                        style={{
                          padding: '8px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'background 0.15s',
                          borderBottom: '1px solid #f5f5f5',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <div style={{ color: '#4f46e5', fontWeight: 600, fontSize: 12 }}>{p.nombre}</div>
                          {p.cuit && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8c8c8c', fontSize: 12 }}>{p.cuit}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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

      <style>{`
        @keyframes searchDropIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
