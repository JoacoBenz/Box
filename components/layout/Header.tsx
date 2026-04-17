'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Layout, Button, Dropdown, Space, Typography, Avatar, MenuProps, Tag, Input } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  SearchOutlined,
  CloseOutlined,
  LoadingOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import { ESTADO_COLOR, ESTADO_LABEL } from '@/lib/constants';
import { useTheme } from '@/components/ThemeProvider';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface HeaderProps {
  tenantNombre: string;
  userName: string;
  areaNombre: string | null;
  rolPrincipal: string;
  roles: string[];
  collapsed: boolean;
  isMobile?: boolean;
  onToggle: () => void;
}

const ROL_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
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

export function AppHeader({
  tenantNombre,
  userName,
  areaNombre,
  rolPrincipal,
  roles,
  collapsed,
  isMobile,
  onToggle,
}: HeaderProps) {
  const { tokens, mode, toggleTheme } = useTheme();
  const router = useRouter();

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [searchOpen]);

  // Close on click outside
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    setResults(null);
    setSearching(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value || value.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelect = (type: string, id: number) => {
    if (type === 'solicitud') router.push(`/solicitudes/${id}`);
    else if (type === 'proveedor') router.push(`/proveedores/${id}/compras`);
    closeSearch();
  };

  const hasResults =
    results && (results.solicitudes?.length > 0 || results.proveedores?.length > 0);
  const noResults = results && !hasResults && query.length >= 2;

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Mi Perfil',
      onClick: () => router.push('/perfil'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar sesión',
      onClick: () => signOut({ callbackUrl: '/login' }),
    },
  ];

  return (
    <>
      <AntHeader
        style={{
          background: tokens.headerBg,
          borderBottom: `1px solid ${tokens.headerBorder}`,
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: tokens.headerShadow,
          gap: 8,
        }}
      >
        {/* Left side: hamburger + tenant name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            flex: isMobile ? 1 : undefined,
          }}
        >
          <Button
            type="text"
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={onToggle}
            style={{
              fontSize: 18,
              width: 40,
              height: 40,
              borderRadius: 10,
              color: tokens.textMuted,
              flexShrink: 0,
            }}
          />
          <Text
            strong
            style={{
              fontSize: isMobile ? 14 : 15,
              color: tokens.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tenantNombre}
          </Text>
        </div>

        {/* Right side: search, theme, notifications, user */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 12, flexShrink: 0 }}
        >
          {/* Search — icon-only on mobile, expandable bar on desktop */}
          <div ref={containerRef} style={{ position: 'relative' }}>
            {isMobile && !searchOpen ? (
              <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={() => setSearchOpen(true)}
                style={{
                  fontSize: 16,
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  color: tokens.textMuted,
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid',
                  borderColor: searchOpen ? tokens.colorPrimary : tokens.borderColor,
                  borderRadius: 10,
                  height: 36,
                  width: isMobile
                    ? searchOpen
                      ? 'calc(100vw - 80px)'
                      : 36
                    : searchOpen
                      ? 'min(320px, calc(100vw - 400px))'
                      : 160,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: searchOpen ? tokens.searchBgActive : tokens.searchBgInactive,
                  boxShadow: searchOpen ? tokens.searchShadow : 'none',
                  overflow: 'hidden',
                  cursor: searchOpen ? 'text' : 'pointer',
                  ...(isMobile && searchOpen
                    ? {
                        position: 'fixed',
                        top: 10,
                        left: 12,
                        right: 12,
                        width: 'auto',
                        zIndex: 1002,
                        height: 40,
                      }
                    : {}),
                }}
                onClick={() => {
                  if (!searchOpen) setSearchOpen(true);
                }}
              >
                <SearchOutlined
                  style={{
                    color: searchOpen ? tokens.colorPrimary : tokens.textMuted,
                    fontSize: 14,
                    marginLeft: 10,
                    flexShrink: 0,
                  }}
                />
                {searchOpen ? (
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Buscar solicitudes, proveedores..."
                    aria-label="Buscar solicitudes y proveedores"
                    role="searchbox"
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      flex: 1,
                      fontSize: 13,
                      padding: '0 8px',
                      color: tokens.textPrimary,
                      height: '100%',
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeSearch();
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      color: tokens.textMuted,
                      fontWeight: 400,
                      padding: '0 8px',
                      flex: 1,
                    }}
                  >
                    Buscar...
                  </span>
                )}
                {searchOpen && (
                  <Button
                    type="text"
                    size="small"
                    icon={searching ? <LoadingOutlined spin /> : <CloseOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!searching) {
                        if (query) {
                          setQuery('');
                          setResults(null);
                          inputRef.current?.focus();
                        } else {
                          closeSearch();
                        }
                      }
                    }}
                    style={{
                      color: tokens.textMuted,
                      marginRight: 4,
                      width: 28,
                      height: 28,
                      minWidth: 28,
                    }}
                  />
                )}
              </div>
            )}

            {/* Search overlay backdrop on mobile */}
            {isMobile && searchOpen && (
              <div
                onClick={closeSearch}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  zIndex: 1001,
                }}
              />
            )}

            {/* Results dropdown */}
            {searchOpen && (hasResults || noResults) && (
              <div
                style={{
                  position: isMobile ? 'fixed' : 'absolute',
                  top: isMobile ? 56 : 42,
                  right: isMobile ? 12 : 0,
                  left: isMobile ? 12 : undefined,
                  width: isMobile ? 'auto' : 'min(400px, calc(100vw - 32px))',
                  maxHeight: isMobile ? 'calc(100vh - 80px)' : 420,
                  overflowY: 'auto',
                  background: tokens.bgInput,
                  borderRadius: 10,
                  border: `1px solid ${tokens.headerBorder}`,
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
                  zIndex: 1003,
                  animation: 'searchDropIn 0.15s ease-out',
                }}
              >
                {noResults && (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Sin resultados para &ldquo;{query}&rdquo;
                    </Text>
                  </div>
                )}

                {results?.solicitudes?.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: '7px 15px 5px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: tokens.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: tokens.bgCard,
                        lineHeight: 1.2,
                        borderBottom: `1px solid ${tokens.borderSubtle}`,
                      }}
                    >
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
                          borderBottom: `1px solid ${tokens.borderSubtle}`,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.bgCard)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <div
                            style={{ color: tokens.colorPrimary, fontWeight: 600, fontSize: 12 }}
                          >
                            {s.numero}
                          </div>
                          <div
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: tokens.textSecondary,
                              fontSize: 12,
                            }}
                          >
                            {s.titulo}
                          </div>
                        </div>
                        <Tag
                          color={ESTADO_COLOR[s.estado] ?? 'default'}
                          style={{ margin: 0, flexShrink: 0, fontSize: 11 }}
                        >
                          {ESTADO_LABEL[s.estado] ?? s.estado}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}

                {results?.proveedores?.length > 0 && (
                  <div>
                    {results?.solicitudes?.length > 0 && (
                      <div style={{ borderTop: `1px solid ${tokens.borderSubtle}` }} />
                    )}
                    <div
                      style={{
                        padding: '7px 15px 5px',
                        fontSize: 12,
                        fontWeight: 700,
                        color: tokens.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: tokens.bgCard,
                        lineHeight: 1.2,
                        borderBottom: `1px solid ${tokens.borderSubtle}`,
                      }}
                    >
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
                          borderBottom: `1px solid ${tokens.borderSubtle}`,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tokens.bgCard)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <div
                            style={{ color: tokens.colorPrimary, fontWeight: 600, fontSize: 12 }}
                          >
                            {p.nombre}
                          </div>
                          {p.cuit && (
                            <div
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: tokens.textSecondary,
                                fontSize: 12,
                              }}
                            >
                              {p.cuit}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            type="text"
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
            onClick={toggleTheme}
            style={{
              fontSize: 16,
              width: 36,
              height: 36,
              borderRadius: 10,
              color: tokens.textMuted,
            }}
            title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          />
          <NotificationBell />
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <div
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 4px 4px 4px',
                borderRadius: 12,
              }}
            >
              <Avatar
                icon={<UserOutlined />}
                style={{ background: tokens.avatarGradient }}
                size={32}
              />
              {!isMobile && (
                <div style={{ lineHeight: 1.2 }}>
                  <Text
                    strong
                    style={{ fontSize: 13, color: tokens.textPrimary, display: 'block' }}
                  >
                    {userName}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {areaNombre ? `${areaNombre} · ` : ''}
                    {ROL_LABELS[rolPrincipal] ?? rolPrincipal}
                  </Text>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
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
