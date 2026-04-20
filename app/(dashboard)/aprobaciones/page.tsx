'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Typography, Button, App, Checkbox, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { CheckOutlined, CheckCircleOutlined, RightOutlined } from '@ant-design/icons';
import { URGENCIAS } from '@/types';
import type { UrgenciaSolicitud } from '@/types';
import { useIsMobile } from '@/hooks/useIsMobile';

const { Title, Text } = Typography;

interface SolicitudItem {
  precio_estimado: number | null;
  cantidad: number;
}

interface Solicitud {
  id: number;
  numero: string;
  titulo: string;
  urgencia: string;
  estado: string;
  updated_at: string;
  fecha_validacion: string | null;
  area: { nombre: string } | null;
  solicitante: { nombre: string };
  items_solicitud: SolicitudItem[];
}

function calcMonto(items: SolicitudItem[]): number {
  return items.reduce(
    (sum, it) => sum + (it.precio_estimado ? Number(it.precio_estimado) * Number(it.cantidad) : 0),
    0,
  );
}

function formatMonto(value: number): string {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/* ── Mobile card for a single solicitud ── */
function SolicitudCard({
  solicitud,
  selected,
  onSelect,
  onApprove,
  approving,
  onNavigate,
}: {
  solicitud: Solicitud;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
  onApprove: (s: Solicitud) => void;
  approving: boolean;
  onNavigate: (id: number) => void;
}) {
  const u = URGENCIAS[solicitud.urgencia as UrgenciaSolicitud];
  const monto = calcMonto(solicitud.items_solicitud);
  const isUrgent = solicitud.urgencia === 'urgente' || solicitud.urgencia === 'critica';

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`,
        padding: 14,
        marginBottom: 10,
        transition: 'border-color 0.2s',
        borderLeft: isUrgent
          ? `4px solid ${solicitud.urgencia === 'critica' ? 'var(--urgencia-border-critica)' : 'var(--urgencia-border-urgente)'}`
          : undefined,
      }}
    >
      {/* Top row: checkbox + numero + urgency tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {!isUrgent && (
          <Checkbox checked={selected} onChange={(e) => onSelect(solicitud.id, e.target.checked)} />
        )}
        <Text
          strong
          style={{ color: 'var(--color-primary)', fontSize: 13, cursor: 'pointer', flex: 1 }}
          onClick={() => onNavigate(solicitud.id)}
        >
          {solicitud.numero}
        </Text>
        {u && (
          <Tag color={u.color} style={{ margin: 0, fontSize: 11 }}>
            {u.label}
          </Tag>
        )}
      </div>

      {/* Title */}
      <Text
        style={{
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {solicitud.titulo}
      </Text>

      {/* Info row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
        }}
      >
        <span>{solicitud.solicitante?.nombre ?? '—'}</span>
        {solicitud.area?.nombre && <span>{solicitud.area.nombre}</span>}
      </div>

      {/* Bottom row: monto + approve button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
          {formatMonto(monto)}
        </Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            icon={<RightOutlined />}
            onClick={() => onNavigate(solicitud.id)}
            style={{ borderRadius: 8 }}
          >
            Ver
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            loading={approving}
            onClick={() => onApprove(solicitud)}
            style={{ borderRadius: 8 }}
          >
            Aprobar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AprobacionesPage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const isMobile = useIsMobile();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/solicitudes?estado=validada&limit=100');
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

  const handleApprove = useCallback(
    async (solicitud: Solicitud) => {
      setApprovingId(solicitud.id);
      try {
        const res = await fetch(`/api/solicitudes/${solicitud.id}/aprobar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updated_at: solicitud.updated_at }),
        });
        if (res.ok) {
          message.success(`Solicitud ${solicitud.numero} aprobada`);
          setSolicitudes((prev) => prev.filter((s) => s.id !== solicitud.id));
          setSelectedRowKeys((prev) => prev.filter((k) => k !== solicitud.id));
        } else {
          const err = await res.json().catch(() => null);
          modal.error({
            title: 'Error al aprobar',
            content: err?.error?.message || 'Error desconocido',
          });
        }
      } catch {
        modal.error({ title: 'Error', content: 'No se pudo conectar con el servidor' });
      } finally {
        setApprovingId(null);
      }
    },
    [message, modal],
  );

  const handleBulkApprove = useCallback(() => {
    const count = selectedRowKeys.length;
    if (count === 0) return;

    modal.confirm({
      title: `¿Aprobar ${count} solicitud${count > 1 ? 'es' : ''} seleccionada${count > 1 ? 's' : ''}?`,
      content: 'Esta acción no se puede deshacer.',
      okText: 'Aprobar',
      cancelText: 'Cancelar',
      okType: 'primary',
      onOk: async () => {
        setBulkApproving(true);
        try {
          const res = await fetch('/api/solicitudes/aprobar-masivo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedRowKeys }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.aprobadas > 0) {
              message.success(
                `${result.aprobadas} solicitud${result.aprobadas > 1 ? 'es' : ''} aprobada${result.aprobadas > 1 ? 's' : ''}`,
              );
            }
            if (result.errores?.length > 0) {
              modal.warning({
                title: `${result.errores.length} solicitud${result.errores.length > 1 ? 'es' : ''} no se pudieron aprobar`,
                content: result.errores.map((e: any) => `#${e.id}: ${e.error}`).join('\n'),
              });
            }
            setSelectedRowKeys([]);
            fetchData();
          } else {
            const err = await res.json().catch(() => null);
            modal.error({ title: 'Error', content: err?.error?.message || 'Error desconocido' });
          }
        } catch {
          modal.error({ title: 'Error', content: 'No se pudo conectar con el servidor' });
        } finally {
          setBulkApproving(false);
        }
      },
    });
  }, [selectedRowKeys, message, modal, fetchData]);

  const handleMobileSelect = useCallback((id: number, checked: boolean) => {
    setSelectedRowKeys((prev) => (checked ? [...prev, id] : prev.filter((k) => k !== id)));
  }, []);

  // ── Desktop table columns ──
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
      title: 'Monto',
      key: 'monto',
      width: 140,
      align: 'right' as const,
      render: (_, r) => formatMonto(calcMonto(r.items_solicitud)),
      sorter: (a, b) => calcMonto(a.items_solicitud) - calcMonto(b.items_solicitud),
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
      title: '',
      key: 'acciones',
      width: 120,
      align: 'center' as const,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          loading={approvingId === r.id}
          onClick={(e) => {
            e.stopPropagation();
            handleApprove(r);
          }}
        >
          Aprobar
        </Button>
      ),
    },
  ];

  return (
    <div className="page-content">
      <Title
        level={3}
        style={{ margin: 0, marginBottom: 4, fontWeight: 700, color: 'var(--text-primary)' }}
      >
        {isMobile ? 'Aprobaciones' : 'Solicitudes Pendientes de Aprobación'}
      </Title>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: isMobile ? 13 : 14 }}>
        {isMobile
          ? `${solicitudes.length} pendiente${solicitudes.length !== 1 ? 's' : ''}`
          : 'Solicitudes validadas por los responsables de área que requieren su aprobación.'}
      </p>

      {/* ── Mobile: Card list ── */}
      {isMobile ? (
        <div>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : solicitudes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <CheckCircleOutlined style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }} />
              <p>No hay solicitudes pendientes</p>
            </div>
          ) : (
            solicitudes.map((s) => (
              <SolicitudCard
                key={s.id}
                solicitud={s}
                selected={selectedRowKeys.includes(s.id)}
                onSelect={handleMobileSelect}
                onApprove={handleApprove}
                approving={approvingId === s.id}
                onNavigate={(id) => router.push(`/solicitudes/${id}`)}
              />
            ))
          )}
        </div>
      ) : (
        /* ── Desktop: Table ── */
        <Table
          rowKey="id"
          columns={columns}
          dataSource={solicitudes}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: 'No hay solicitudes pendientes de aprobación' }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            getCheckboxProps: (record: Solicitud) => ({
              disabled: record.urgencia === 'urgente' || record.urgencia === 'critica',
              title:
                record.urgencia === 'urgente' || record.urgencia === 'critica'
                  ? 'Las solicitudes urgentes y críticas deben aprobarse individualmente'
                  : undefined,
            }),
          }}
          rowClassName={(record: any) =>
            record.urgencia === 'critica'
              ? 'urgencia-row-critica'
              : record.urgencia === 'urgente'
                ? 'urgencia-row-urgente'
                : 'urgencia-row-normal'
          }
        />
      )}

      {/* ── Floating bulk approve button ── */}
      {selectedRowKeys.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 20 : 16,
            left: isMobile ? 16 : '50%',
            right: isMobile ? 16 : undefined,
            transform: isMobile ? undefined : 'translateX(-50%)',
            zIndex: 999,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={bulkApproving}
            onClick={handleBulkApprove}
            style={{
              borderRadius: 12,
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              width: isMobile ? '100%' : undefined,
              height: isMobile ? 48 : undefined,
              fontSize: isMobile ? 15 : undefined,
            }}
          >
            Aprobar seleccionadas ({selectedRowKeys.length})
          </Button>
        </div>
      )}
    </div>
  );
}
