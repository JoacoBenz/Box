'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Select,
  DatePicker,
  Switch,
  Card,
  Modal,
  Pagination,
  Skeleton,
  Typography,
  Button,
  Space,
  App,
} from 'antd';
import { useIsMobile } from '@/hooks/useIsMobile';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_CONFIG: Record<string, { label: string; color: string; critical?: boolean }> = {
  login_exitoso: { label: 'Inició sesión', color: 'default' },
  login_fallido: { label: 'Login fallido', color: 'red', critical: true },
  cuenta_bloqueada: { label: 'Cuenta bloqueada', color: 'red', critical: true },
  rate_limited: { label: 'Rate limited', color: 'red', critical: true },
  crear_solicitud: { label: 'Creó solicitud', color: 'blue' },
  editar_solicitud: { label: 'Editó solicitud', color: 'blue' },
  enviar_solicitud: { label: 'Envió solicitud', color: 'cyan' },
  validar_solicitud: { label: 'Validó solicitud', color: 'green' },
  aprobar_solicitud: { label: 'Aprobó solicitud', color: 'green', critical: true },
  aprobar_masivo: { label: 'Aprobación masiva', color: 'green', critical: true },
  rechazar_solicitud: { label: 'Rechazó solicitud', color: 'red', critical: true },
  devolver_solicitud: { label: 'Devolvió solicitud', color: 'orange' },
  anular_solicitud: { label: 'Anuló solicitud', color: 'red', critical: true },
  cerrar_solicitud: { label: 'Cerró solicitud', color: 'default' },
  registrar_compra: { label: 'Registró compra', color: 'purple', critical: true },
  confirmar_recepcion: { label: 'Confirmó recepción', color: 'green' },
  crear_usuario: { label: 'Creó usuario', color: 'blue' },
  editar_usuario: { label: 'Editó usuario', color: 'orange', critical: true },
  desactivar_usuario: { label: 'Desactivó usuario', color: 'red', critical: true },
  crear_delegacion: { label: 'Creó delegación', color: 'orange', critical: true },
  desactivar_delegacion: { label: 'Desactivó delegación', color: 'orange', critical: true },
  crear_area: { label: 'Creó área', color: 'blue' },
  editar_area: { label: 'Editó área', color: 'orange' },
  crear_proveedor: { label: 'Creó proveedor', color: 'blue' },
  editar_proveedor: { label: 'Editó proveedor', color: 'orange' },
  crear_centro_costo: { label: 'Creó centro de costo', color: 'blue' },
  editar_centro_costo: { label: 'Editó centro de costo', color: 'orange' },
  cambiar_password: { label: 'Cambió contraseña', color: 'orange' },
  verificar_email: { label: 'Verificó email', color: 'green' },
  procesar_compras: { label: 'Procesó compras', color: 'purple' },
  programar_pago: { label: 'Programó pago', color: 'purple' },
};

const ENTIDAD_OPTIONS = [
  { value: 'solicitud', label: 'Solicitud' },
  { value: 'usuario', label: 'Usuario' },
  { value: 'area', label: 'Área' },
  { value: 'sesion', label: 'Sesión' },
  { value: 'proveedor', label: 'Proveedor' },
  { value: 'centro_costo', label: 'Centro de Costo' },
  { value: 'delegacion', label: 'Delegación' },
  { value: 'compra', label: 'Compra' },
  { value: 'recepcion', label: 'Recepción' },
];

interface AuditLog {
  id: number;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  usuario_nombre: string;
  usuario_id: number;
  ip: string;
  datos_anteriores: any;
  datos_nuevos: any;
  organizacion_nombre?: string;
  created_at: string;
}

interface TenantOption {
  id: number;
  nombre: string;
}

export default function AuditoriaPage() {
  const isMobile = useIsMobile();
  const { message } = App.useApp();

  // Filters
  const [accion, setAccion] = useState<string | undefined>();
  const [entidad, setEntidad] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [orgId, setOrgId] = useState<number | undefined>();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Data
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Detail modal
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  // Detect super_admin and fetch tenants
  useEffect(() => {
    fetch('/api/admin/tenants')
      .then((r) => {
        if (r.ok) {
          setIsSuperAdmin(true);
          return r.json();
        }
        return null;
      })
      .then((data: any[] | null) => {
        if (data) setTenants(data.map((t) => ({ id: t.id, nombre: t.nombre })));
      })
      .catch(() => {});
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (accion) params.set('accion', accion);
      if (entidad) params.set('entidad', entidad);
      if (soloCriticos) params.set('critico', 'true');
      if (orgId) params.set('tenant_id', String(orgId));
      if (dateRange?.[0]) params.set('desde', dateRange[0].toISOString());
      if (dateRange?.[1]) params.set('hasta', dateRange[1].endOf('day').toISOString());

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar logs');
      const data = await res.json();
      // Map API response to frontend format
      const mapped = (data.data ?? []).map((log: any) => ({
        id: log.id,
        accion: log.accion,
        entidad: log.entidad,
        entidad_id: log.entidad_id,
        usuario_id: log.usuario_id,
        usuario_nombre: log.usuario?.nombre ?? 'Sistema',
        ip: log.ip_address ?? '—',
        datos_anteriores: log.datos_anteriores,
        datos_nuevos: log.datos_nuevos,
        organizacion_nombre: log.tenant?.nombre ?? '—',
        created_at: log.created_at,
      }));
      setLogs(mapped);
      setTotal(data.total ?? 0);
    } catch {
      message.error('Error al cargar los registros de auditoría');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, accion, entidad, soloCriticos, orgId, dateRange, message]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Debounce page reset on filter change
  useEffect(() => {
    setPage(1);
  }, [accion, entidad, soloCriticos, orgId, dateRange]);

  const formatDate = (iso: string) => dayjs(iso).format('DD/MM/YYYY HH:mm');

  const renderActionTag = (accion: string) => {
    const cfg = ACTION_CONFIG[accion] || { label: accion, color: 'default' };
    return (
      <Tag color={cfg.color}>
        {cfg.critical && <span style={{ marginRight: 4 }}>&#128308;</span>}
        {cfg.label}
      </Tag>
    );
  };

  const renderEntidad = (entidad: string, id: number | null) => {
    if (id) return `${entidad} #${id}`;
    return entidad;
  };

  const filtersBar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
      }}
    >
      <Select
        placeholder="Acción"
        allowClear
        value={accion}
        onChange={setAccion}
        style={{ minWidth: 180 }}
        options={Object.entries(ACTION_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
      />
      <Select
        placeholder="Entidad"
        allowClear
        value={entidad}
        onChange={setEntidad}
        style={{ minWidth: 160 }}
        options={ENTIDAD_OPTIONS}
      />
      <RangePicker
        value={dateRange as any}
        onChange={(val) => setDateRange(val as [Dayjs | null, Dayjs | null] | null)}
        style={{ minWidth: 240 }}
      />
      <Space>
        <Switch checked={soloCriticos} onChange={setSoloCriticos} size="small" />
        <Text>Solo críticos</Text>
      </Space>
      {isSuperAdmin && (
        <Select
          placeholder="Organización"
          allowClear
          value={orgId}
          onChange={setOrgId}
          style={{ minWidth: 180 }}
          options={tenants.map((t) => ({ value: t.id, label: t.nombre }))}
          showSearch
          optionFilterProp="label"
        />
      )}
    </div>
  );

  const columns = [
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Usuario',
      dataIndex: 'usuario_nombre',
      width: 160,
    },
    {
      title: 'Acción',
      dataIndex: 'accion',
      render: (v: string) => renderActionTag(v),
    },
    {
      title: 'Entidad',
      render: (_: any, r: AuditLog) => renderEntidad(r.entidad, r.entidad_id),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
    },
    ...(isSuperAdmin
      ? [
          {
            title: 'Org',
            dataIndex: 'organizacion_nombre',
            width: 140,
          },
        ]
      : []),
  ];

  const detailModal = (
    <Modal
      open={!!detailLog}
      onCancel={() => setDetailLog(null)}
      footer={<Button onClick={() => setDetailLog(null)}>Cerrar</Button>}
      title="Detalle del registro"
      width={600}
    >
      {detailLog && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text strong>Fecha:</Text> {formatDate(detailLog.created_at)}
          </div>
          <div>
            <Text strong>Usuario:</Text> {detailLog.usuario_nombre} (ID: {detailLog.usuario_id})
          </div>
          <div>
            <Text strong>Acción:</Text> {renderActionTag(detailLog.accion)}
          </div>
          <div>
            <Text strong>Entidad:</Text> {renderEntidad(detailLog.entidad, detailLog.entidad_id)}
          </div>
          <div>
            <Text strong>IP:</Text> {detailLog.ip}
          </div>
          {detailLog.organizacion_nombre && (
            <div>
              <Text strong>Organización:</Text> {detailLog.organizacion_nombre}
            </div>
          )}
          {detailLog.datos_anteriores && (
            <div>
              <Text strong>Datos anteriores:</Text>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 200,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(detailLog.datos_anteriores, null, 2)}
              </pre>
            </div>
          )}
          {detailLog.datos_nuevos && (
            <div>
              <Text strong>Datos nuevos:</Text>
              <pre
                style={{
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 6,
                  overflow: 'auto',
                  maxHeight: 200,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(detailLog.datos_nuevos, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        Auditoría
      </Title>
      {filtersBar}

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          <Text type="secondary">
            No se encontraron registros de auditoría con los filtros seleccionados.
          </Text>
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map((log) => {
            const cfg = ACTION_CONFIG[log.accion] || { label: log.accion, color: 'default' };
            return (
              <Card
                key={log.id}
                size="small"
                hoverable
                onClick={() => setDetailLog(log)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDate(log.created_at)}
                  </Text>
                  {cfg.critical && (
                    <Tag color="red" style={{ fontSize: 10 }}>
                      Crítico
                    </Tag>
                  )}
                </div>
                <div style={{ marginBottom: 4 }}>{renderActionTag(log.accion)}</div>
                <div style={{ fontSize: 13 }}>{log.usuario_nombre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {renderEntidad(log.entidad, log.entidad_id)}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          onRow={(record) => ({
            onClick: () => setDetailLog(record),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
          />
        </div>
      )}

      {detailModal}
    </div>
  );
}
