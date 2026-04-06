'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge, Button, Dropdown, List, Typography, Empty, Space, Spin } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTheme } from '@/components/ThemeProvider';

const { Text } = Typography;

interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  solicitud_id: number | null;
  created_at: string;
}

export function NotificationBell() {
  const { tokens } = useTheme();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones/count');
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
      }
    } catch {}
  }, []);

  const fetchNotificaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notificaciones?limit=20');
      if (res.ok) {
        const data = await res.json();
        setNotificaciones(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  async function marcarLeida(id: number) {
    await fetch(`/api/notificaciones/${id}`, { method: 'PATCH' });
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    setCount(prev => Math.max(0, prev - 1));
  }

  async function marcarTodas() {
    await fetch('/api/notificaciones/marcar-todas', { method: 'PATCH' });
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
    setCount(0);
    setOpen(false);
  }

  async function handleClickNotif(notif: Notificacion) {
    if (!notif.leida) await marcarLeida(notif.id);
    setOpen(false);
    if (notif.solicitud_id) router.push(`/solicitudes/${notif.solicitud_id}`);
  }

  const dropdownContent = (
    <div style={{ width: 360, background: tokens.notifBg, borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.12)', border: `1px solid ${tokens.headerBorder}` }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>Notificaciones</Text>
        {count > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={marcarTodas}>
            Marcar todas
          </Button>
        )}
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}><Spin /></div>
      ) : notificaciones.length === 0 ? (
        <Empty description="Sin notificaciones" style={{ padding: 24 }} />
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {notificaciones.map((notif) => (
            <div
              key={notif.id}
              style={{ padding: '10px 16px', cursor: 'pointer', background: notif.leida ? tokens.bgCard : tokens.notifUnreadBg, borderLeft: notif.leida ? 'none' : `3px solid ${tokens.notifAccent}`, borderBottom: `1px solid ${tokens.borderSubtle}` }}
              onClick={() => handleClickNotif(notif)}
            >
              <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                <Text strong={!notif.leida} style={{ fontSize: 13 }}>{notif.titulo}</Text>
                {notif.mensaje && <Text type="secondary" style={{ fontSize: 12 }}>{notif.mensaje}</Text>}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                </Text>
              </Space>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={(v) => { setOpen(v); if (v) fetchNotificaciones(); }}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Badge count={count} size="small" overflowCount={99}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} style={{ height: 40, width: 40 }} />
      </Badge>
    </Dropdown>
  );
}
