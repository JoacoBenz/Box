'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Typography, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { URGENCIAS } from '@/types';
import type { UrgenciaSolicitud } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';

const { Title } = Typography;

interface Solicitud {
  id: number;
  numero: string;
  titulo: string;
  urgencia: string;
  estado: string;
  area: { nombre: string } | null;
  solicitante: { nombre: string };
}

export default function RecepcionesPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/solicitudes?estado=abonada&limit=100');
      if (res.ok) {
        const data = await res.json();
        setSolicitudes(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handler = () => {
      fetchData();
    };
    window.addEventListener('admin-tenant-change', handler);
    return () => window.removeEventListener('admin-tenant-change', handler);
  }, [fetchData]);

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'Número',
      dataIndex: 'numero',
      key: 'numero',
      width: 130,
      render: (val: string, r: Solicitud) => (
        <a onClick={() => router.push(`/solicitudes/${r.id}`)} style={{ cursor: 'pointer' }}>
          {val}
        </a>
      ),
    },
    { title: 'Título', dataIndex: 'titulo', key: 'titulo', ellipsis: true },
    {
      title: 'Área',
      key: 'area',
      render: (_, r) => r.area?.nombre ?? '—',
      width: 140,
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      key: 'urgencia',
      width: 110,
      render: (val: string) => {
        const u = URGENCIAS[val as UrgenciaSolicitud];
        return u ? <Tag color={u.color}>{u.label}</Tag> : <Tag>{val}</Tag>;
      },
    },
  ];

  return (
    <div className="page-content">
      <Title
        level={3}
        style={{ margin: 0, marginBottom: 8, fontWeight: 700, color: 'var(--text-primary)' }}
      >
        Recepciones Pendientes
      </Title>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
        Estas solicitudes ya fueron abonadas y esperan confirmación de recepción. Hacé clic en el
        número de solicitud para ir al detalle y confirmar.
      </p>
      {isMobile ? (
        loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))}
          </div>
        ) : solicitudes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
            No hay recepciones pendientes
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {solicitudes.map((s) => {
              const u = URGENCIAS[s.urgencia as UrgenciaSolicitud];
              return (
                <div
                  key={s.id}
                  onClick={() => router.push(`/solicitudes/${s.id}`)}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 0,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: 14 }}>
                      {s.numero}
                    </span>
                    {u ? <Tag color={u.color}>{u.label}</Tag> : <Tag>{s.urgencia}</Tag>}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    {s.titulo}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{s.area?.nombre ?? '—'}</span>
                    <span>{s.solicitante?.nombre}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={solicitudes}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: 'No hay recepciones pendientes' }}
          rowClassName={(record: any) =>
            record.urgencia === 'critica'
              ? 'urgencia-row-critica'
              : record.urgencia === 'urgente'
                ? 'urgencia-row-urgente'
                : 'urgencia-row-normal'
          }
        />
      )}
    </div>
  );
}
