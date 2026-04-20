'use client';

import { useState, useEffect } from 'react';
import { Card, Typography, Select, Button, Spin, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';

const { Title, Text } = Typography;

export default function SeleccionarAreaPage() {
  const { tokens } = useTheme();
  const router = useRouter();
  const [areas, setAreas] = useState<{ id: number; nombre: string }[]>([]);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Check if user already has area
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((s) => {
        if (s?.user?.areaId) {
          router.replace('/solicitudes');
          return;
        }
        setUserName(s?.user?.name ?? '');
      })
      .catch(() => {});

    // Load areas for user's tenant
    fetch('/api/areas')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setAreas(Array.isArray(data) ? data : (data.data ?? []));
        setLoadingAreas(false);
      })
      .catch(() => setLoadingAreas(false));
  }, [router]);

  async function handleSubmit() {
    if (!selectedArea) {
      message.warning('Seleccioná un área');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/usuarios/mi-area', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_id: selectedArea }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error ?? 'Error al guardar');
      }
      message.success('Área asignada correctamente');
      // Small delay to let session refresh
      setTimeout(() => router.replace('/solicitudes'), 500);
    } catch (err: any) {
      message.error(err?.message ?? 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-layout)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 460,
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <TeamOutlined style={{ fontSize: 48, color: tokens.colorPrimary, marginBottom: 16 }} />
          <Title level={3} style={{ marginBottom: 4, color: 'var(--text-primary)' }}>
            Bienvenido{userName ? `, ${userName.split(' ')[0]}` : ''}
          </Title>
          <Text style={{ color: 'var(--text-secondary)' }}>
            Para completar tu registro, seleccioná el área a la que pertenecés
          </Text>
        </div>

        {loadingAreas ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            <Select
              placeholder="Seleccioná tu área"
              style={{ width: '100%', marginBottom: 24 }}
              size="large"
              value={selectedArea}
              onChange={setSelectedArea}
              options={areas.map((a) => ({ value: a.id, label: a.nombre }))}
            />

            <Button
              type="primary"
              size="large"
              block
              onClick={handleSubmit}
              loading={loading}
              disabled={!selectedArea}
            >
              Continuar
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
