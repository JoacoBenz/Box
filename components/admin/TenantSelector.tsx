'use client';

import { useEffect, useState, useCallback } from 'react';
import { Select, Space, Typography, Tag } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

const { Text } = Typography;

interface Tenant {
  id: number;
  nombre: string;
  slug: string;
}

interface Props {
  value: number | null;
  onChange: (tenantId: number | null) => void;
  compact?: boolean;
}

const COOKIE_NAME = 'admin_tenant_id';
const EVENT_NAME = 'admin-tenant-change';

function getCookieValue(): number | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? Number(match[1]) : null;
}

export function useAdminTenant(): [number | null, (id: number | null) => void] {
  const [tenantId, setTenantId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setTenantId(getCookieValue());

    const handler = (e: Event) => {
      const val = (e as CustomEvent).detail as number | null;
      setTenantId(val);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const set = useCallback(
    async (id: number | null) => {
      setTenantId(id);
      try {
        const res = await fetch('/api/admin/tenant-override', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: id }),
        });
        if (!res.ok) {
          throw new Error(`tenant-override failed: ${res.status}`);
        }
        // Broadcast after cookie is set so other components re-fetch with new cookie
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }));
        router.refresh();
      } catch (err) {
        console.error('[TenantSelector] Failed to set tenant override', err);
      }
    },
    [router],
  );

  return [tenantId, set];
}

export default function TenantSelector({ value, onChange, compact }: Props) {
  const { tokens } = useTheme();
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    fetch('/api/admin/tenants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) =>
        setTenants(data.map((t) => ({ id: t.id, nombre: t.nombre, slug: t.slug }))),
      )
      .catch(() => {});
  }, []);

  if (tenants.length <= 1) return null;

  if (compact) {
    return (
      <Space size={6}>
        <GlobalOutlined style={{ color: tokens.colorPrimary, fontSize: 14 }} />
        <Select
          value={value}
          onChange={onChange}
          placeholder="Mi organización"
          allowClear
          size="small"
          style={{ minWidth: 180 }}
          options={tenants.map((t) => ({
            value: t.id,
            label: t.nombre,
          }))}
        />
        {value && (
          <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
            Vista externa
          </Tag>
        )}
      </Space>
    );
  }

  return (
    <Space
      size={8}
      style={{
        padding: '8px 16px',
        background: tokens.tenantSelectorBg,
        borderRadius: 12,
        marginBottom: 20,
        border: `1px solid ${tokens.tenantSelectorBorder}`,
      }}
    >
      <GlobalOutlined style={{ color: tokens.colorPrimary, fontSize: 16 }} />
      <Text strong style={{ fontSize: 13, color: tokens.colorPrimary }}>
        Organización:
      </Text>
      <Select
        value={value}
        onChange={onChange}
        placeholder="Mi organización"
        allowClear
        style={{ minWidth: 220 }}
        options={tenants.map((t) => ({
          value: t.id,
          label: t.nombre,
        }))}
      />
      {value && (
        <Tag color="purple" style={{ margin: 0 }}>
          Vista externa
        </Tag>
      )}
    </Space>
  );
}
