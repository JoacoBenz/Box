'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import {
  Table,
  Tag,
  Select,
  Space,
  Button,
  Input,
  Card,
  Typography,
  DatePicker,
  Skeleton,
} from 'antd';
import { SearchOutlined, DownloadOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types';
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useIsMobile } from '@/hooks/useIsMobile';

const { Text } = Typography;

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
  fecha_envio: string | null;
  created_at: string;
  area: { id: number; nombre: string } | null;
  solicitante: { id: number; nombre: string };
  items_solicitud?: SolicitudItem[];
}

function calcMonto(items?: SolicitudItem[]): number {
  if (!items?.length) return 0;
  return items.reduce(
    (acc, item) => acc + (item.precio_estimado != null ? item.precio_estimado * item.cantidad : 0),
    0,
  );
}

function formatMonto(value: number): string {
  return value > 0
    ? `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
}

interface Props {
  roles: string[];
  areas: { id: number; nombre: string }[];
}

export default function SolicitudesTable({ roles, areas }: Props) {
  const { tokens } = useTheme();
  const router = useRouter();
  const isMobile = useIsMobile();
  const canExport = ['director', 'tesoreria', 'compras', 'admin'].some((r) => roles.includes(r));
  const isSolicitante = roles.includes('solicitante');

  // Filters
  const [estado, setEstado] = useState<string | undefined>();
  const [solicitanteId, setSolicitanteId] = useState<number | undefined>();
  const [areaId, setAreaId] = useState<number | undefined>();
  const [busqueda, setBusqueda] = useState('');
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState<string | undefined>();
  const [fechaHasta, setFechaHasta] = useState<string | undefined>();
  const searchTimeout = useRef<any>(null);

  // Solicitantes list
  const [solicitantes, setSolicitantes] = useState<{ id: number; nombre: string }[]>([]);
  useEffect(() => {
    fetch('/api/usuarios?rol=solicitante')
      .then((r) => (r.ok ? r.json() : []))
      .then((users: any[]) => {
        setSolicitantes(users.map((u) => ({ id: u.id, nombre: u.nombre })));
      })
      .catch(() => {});
  }, []);

  // Data
  const [data, setData] = useState<Solicitud[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Re-fetch when admin switches tenant
  const [tenantVersion, setTenantVersion] = useState(0);
  useEffect(() => {
    const handler = () => {
      setTenantVersion((v) => v + 1);
      setPage(1);
    };
    window.addEventListener('admin-tenant-change', handler);
    return () => window.removeEventListener('admin-tenant-change', handler);
  }, []);

  // Debounce search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedBusqueda(busqueda);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [busqueda]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (estado) params.set('estado', estado);
      if (solicitanteId) params.set('solicitante_id', String(solicitanteId));
      if (areaId) params.set('area_id', String(areaId));
      if (debouncedBusqueda) params.set('busqueda', debouncedBusqueda);
      if (fechaDesde) params.set('desde', fechaDesde);
      if (fechaHasta) params.set('hasta', fechaHasta);

      const res = await fetch(`/api/solicitudes?${params.toString()}`);
      const json = await res.json();
      setData(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    pageSize,
    estado,
    solicitanteId,
    areaId,
    debouncedBusqueda,
    fechaDesde,
    fechaHasta,
    tenantVersion,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 20);
  };

  const clearFilters = () => {
    setEstado(undefined);
    setSolicitanteId(undefined);
    setAreaId(undefined);
    setFechaDesde(undefined);
    setFechaHasta(undefined);
    setBusqueda('');
    setDebouncedBusqueda('');
    setPage(1);
  };

  const hasFilters =
    estado || solicitanteId || areaId || debouncedBusqueda || fechaDesde || fechaHasta;

  const columns: ColumnsType<Solicitud> = useMemo(
    () => [
      {
        title: 'Número',
        dataIndex: 'numero',
        key: 'numero',
        width: 140,
        render: (val: string, r: Solicitud) => (
          <a
            onClick={() => router.push(`/solicitudes/${r.id}`)}
            style={{ cursor: 'pointer', fontWeight: 600, color: tokens.colorPrimary }}
          >
            {val}
          </a>
        ),
      },
      {
        title: 'Título',
        dataIndex: 'titulo',
        key: 'titulo',
        ellipsis: true,
        render: (val: string) => <Text style={{ color: tokens.textPrimary }}>{val}</Text>,
      },
      {
        title: 'Solicitante',
        key: 'solicitante',
        width: 150,
        render: (_, r) => (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {r.solicitante?.nombre ?? '—'}
          </Text>
        ),
      },
      {
        title: 'Área',
        key: 'area',
        width: 140,
        render: (_, r) => (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {r.area?.nombre ?? '—'}
          </Text>
        ),
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
        width: 180,
        render: (val: string) => {
          const e = ESTADOS_SOLICITUD[val as EstadoSolicitud];
          return e ? <Tag color={e.color}>{e.label}</Tag> : <Tag>{val}</Tag>;
        },
      },
      {
        title: 'Fecha',
        key: 'fecha',
        width: 110,
        render: (_, r) => {
          const date = r.fecha_envio || r.created_at;
          return date ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {new Date(date).toLocaleDateString('es-AR')}
            </Text>
          ) : (
            '—'
          );
        },
      },
    ],
    [router],
  );

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 10 : 0,
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: tokens.textPrimary }}>
          Solicitudes de Compra
        </h3>
        <Space style={isMobile ? { justifyContent: 'flex-end' } : undefined}>
          {canExport && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const params = new URLSearchParams();
                if (estado) params.set('estado', estado);
                if (solicitanteId) params.set('solicitante_id', String(solicitanteId));
                if (areaId) params.set('area_id', String(areaId));
                if (debouncedBusqueda) params.set('q', debouncedBusqueda);
                if (fechaDesde) params.set('desde', fechaDesde);
                if (fechaHasta) params.set('hasta', fechaHasta);
                window.open(`/api/solicitudes/export?${params.toString()}`);
              }}
            >
              Exportar
            </Button>
          )}
          {isSolicitante && (
            <Link href="/solicitudes/nueva">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ background: tokens.colorPrimary }}
              >
                Nueva Solicitud
              </Button>
            </Link>
          )}
        </Space>
      </div>

      {/* Filters */}
      <Card
        size="small"
        style={{ borderRadius: 12, marginBottom: 16, border: `1px solid ${tokens.borderColor}` }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: isMobile ? 'stretch' : 'center',
            flexWrap: 'wrap',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <Input
            prefix={<SearchOutlined style={{ color: tokens.textMuted }} />}
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            allowClear
            style={{
              borderRadius: 8,
              flex: isMobile ? undefined : '1 1 180px',
              minWidth: isMobile ? undefined : 120,
              width: isMobile ? '100%' : undefined,
            }}
          />
          <Select
            allowClear
            placeholder="Solicitante"
            style={{
              flex: isMobile ? undefined : '0 0 160px',
              width: isMobile ? '100%' : undefined,
            }}
            value={solicitanteId}
            onChange={(v) => {
              setSolicitanteId(v);
              setPage(1);
            }}
            options={solicitantes.map((s) => ({ value: s.id, label: s.nombre }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            placeholder="Área"
            style={{
              flex: isMobile ? undefined : '0 0 140px',
              width: isMobile ? '100%' : undefined,
            }}
            value={areaId}
            onChange={(v) => {
              setAreaId(v);
              setPage(1);
            }}
            options={areas.map((a) => ({ value: a.id, label: a.nombre }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            placeholder="Estado"
            style={{
              flex: isMobile ? undefined : '0 0 130px',
              width: isMobile ? '100%' : undefined,
            }}
            value={estado}
            onChange={(v) => {
              setEstado(v);
              setPage(1);
            }}
            options={Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <DatePicker
              placeholder="Desde"
              style={{ flex: isMobile ? 1 : '0 0 130px' }}
              format="DD/MM/YYYY"
              value={fechaDesde ? dayjs(fechaDesde) : null}
              onChange={(d: any) => {
                setFechaDesde(d ? d.format('YYYY-MM-DD') : undefined);
                setPage(1);
              }}
            />
            <DatePicker
              placeholder="Hasta"
              style={{ flex: isMobile ? 1 : '0 0 130px' }}
              format="DD/MM/YYYY"
              value={fechaHasta ? dayjs(fechaHasta) : null}
              onChange={(d: any) => {
                setFechaHasta(d ? d.format('YYYY-MM-DD') : undefined);
                setPage(1);
              }}
            />
          </div>
          <div
            style={{
              marginLeft: isMobile ? 0 : 'auto',
              flexShrink: 0,
              display: 'flex',
              justifyContent: isMobile ? 'space-between' : undefined,
              alignItems: 'center',
            }}
          >
            <Space>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {total} resultado{total !== 1 ? 's' : ''}
              </Text>
              <Button
                icon={<ReloadOutlined />}
                onClick={clearFilters}
                size="small"
                type="text"
                style={{ color: tokens.textSecondary }}
              />
            </Space>
          </div>
        </div>
      </Card>

      {/* Table / Mobile Cards */}
      {isMobile ? (
        <div>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  border: '1px solid var(--border-color)',
                }}
              >
                <Skeleton active paragraph={{ rows: 2 }} />
              </div>
            ))
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No hay solicitudes para mostrar
            </div>
          ) : (
            <>
              {data.map((record) => {
                const estadoInfo = ESTADOS_SOLICITUD[record.estado as EstadoSolicitud];
                const urgenciaInfo = URGENCIAS[record.urgencia as UrgenciaSolicitud];
                const monto = calcMonto(record.items_solicitud);
                return (
                  <div
                    key={record.id}
                    onClick={() => router.push(`/solicitudes/${record.id}`)}
                    style={{
                      background: 'var(--bg-card)',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 10,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 6,
                      }}
                    >
                      <a
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/solicitudes/${record.id}`);
                        }}
                        style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 14 }}
                      >
                        {record.numero}
                      </a>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {urgenciaInfo ? (
                          <Tag color={urgenciaInfo.color} style={{ margin: 0 }}>
                            {urgenciaInfo.label}
                          </Tag>
                        ) : (
                          <Tag style={{ margin: 0 }}>{record.urgencia}</Tag>
                        )}
                        {estadoInfo ? (
                          <Tag color={estadoInfo.color} style={{ margin: 0 }}>
                            {estadoInfo.label}
                          </Tag>
                        ) : (
                          <Tag style={{ margin: 0 }}>{record.estado}</Tag>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {record.titulo}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {record.solicitante?.nombre ?? '—'}
                        {record.area ? ` · ${record.area.nombre}` : ''}
                      </div>
                      <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                        {formatMonto(monto)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Mobile pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                }}
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {Math.min((page - 1) * pageSize + 1, total)}-{Math.min(page * pageSize, total)} de{' '}
                  {total}
                </Text>
                <Space>
                  <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Ant.
                  </Button>
                  <Button
                    size="small"
                    disabled={page * pageSize >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Sig.
                  </Button>
                </Space>
              </div>
            </>
          )}
        </div>
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t, range) => `${range[0]}-${range[1]} de ${t}`,
            size: 'small',
          }}
          onChange={handleTableChange}
          size="middle"
          locale={{ emptyText: 'No hay solicitudes para mostrar' }}
          style={{ borderRadius: 12, overflow: 'hidden' }}
          rowClassName={(record: Solicitud) =>
            record.urgencia === 'critica'
              ? 'urgencia-row-critica'
              : record.urgencia === 'urgente'
                ? 'urgencia-row-urgente'
                : 'urgencia-row-normal'
          }
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: (e) => {
              // Don't navigate if clicking on the number link
              if ((e.target as HTMLElement).tagName === 'A') return;
              router.push(`/solicitudes/${record.id}`);
            },
          })}
        />
      )}
    </div>
  );
}
