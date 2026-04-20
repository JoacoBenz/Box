'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Typography, App, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types';
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';

const { Title } = Typography;

interface Solicitud {
  id: number;
  numero: string;
  titulo: string;
  urgencia: string;
  estado: string;
  fecha_envio: string | null;
  area: { nombre: string } | null;
  solicitante: { nombre: string };
}

export default function ValidacionesPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const isMobile = useIsMobile();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/solicitudes?estado=enviada&limit=100');
      if (res.ok) {
        const data = await res.json();
        setSolicitudes(data.data ?? []);
      } else {
        message.error('Error al cargar solicitudes');
      }
    } catch {
      message.error('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, [message]);

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
      title: 'Solicitante',
      key: 'solicitante',
      render: (_, r) => r.solicitante?.nombre ?? '—',
      width: 160,
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
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 140,
      render: (val: string) => {
        const e = ESTADOS_SOLICITUD[val as EstadoSolicitud];
        return e ? <Tag color={e.color}>{e.label}</Tag> : <Tag>{val}</Tag>;
      },
    },
    {
      title: 'Fecha Envío',
      dataIndex: 'fecha_envio',
      key: 'fecha_envio',
      width: 130,
      render: (val: string | null) => (val ? new Date(val).toLocaleDateString('es-AR') : '—'),
    },
  ];

  const renderMobileCard = (sol: Solicitud) => {
    const urgencia = URGENCIAS[sol.urgencia as UrgenciaSolicitud];
    const estado = ESTADOS_SOLICITUD[sol.estado as EstadoSolicitud];

    return (
      <div
        key={sol.id}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 8,
          }}
        >
          <a
            onClick={() => router.push(`/solicitudes/${sol.id}`)}
            style={{
              cursor: 'pointer',
              color: 'var(--color-primary)',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {sol.numero}
          </a>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {urgencia ? (
              <Tag color={urgencia.color}>{urgencia.label}</Tag>
            ) : (
              <Tag>{sol.urgencia}</Tag>
            )}
            {estado ? <Tag color={estado.color}>{estado.label}</Tag> : <Tag>{sol.estado}</Tag>}
          </div>
        </div>

        <div
          style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 6, fontSize: 14 }}
        >
          {sol.titulo}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Área: {sol.area?.nombre ?? '—'}
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Solicitante: {sol.solicitante?.nombre ?? '—'}
          </span>
          {sol.fecha_envio && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Enviado: {new Date(sol.fecha_envio).toLocaleDateString('es-AR')}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderMobileLoading = () => (
    <div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-content">
      <div
        style={
          isMobile ? { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 } : {}
        }
      >
        <Title
          level={3}
          style={{
            margin: 0,
            marginBottom: isMobile ? 0 : 8,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Solicitudes Pendientes de Validación
        </Title>
        <p style={{ color: 'var(--text-muted)', marginBottom: isMobile ? 0 : 16 }}>
          Mostrando solicitudes en estado <Tag color="blue">Enviada</Tag> y{' '}
          <Tag color="orange">Devuelta por Dirección</Tag> de tu área.
        </p>
      </div>

      {isMobile ? (
        loading ? (
          renderMobileLoading()
        ) : solicitudes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
            No hay solicitudes pendientes de validación
          </div>
        ) : (
          <div>{solicitudes.map(renderMobileCard)}</div>
        )
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={solicitudes}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: 'No hay solicitudes pendientes de validación' }}
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
