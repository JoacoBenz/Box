'use client'

import { Form, Input, InputNumber, Select, Tag, Button, Space, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import AdminCrudTable from '@/components/admin/AdminCrudTable'

interface CentroCosto {
  id: number
  nombre: string
  codigo: string
  activo: boolean
  presupuesto_anual: number | null
  presupuesto_mensual: number | null
  area: { id: number; nombre: string } | null
  tenant?: { id: number; nombre: string }
}

interface AreaOption {
  id: number
  nombre: string
}

export default function CentrosCostoPage() {
  return (
    <AdminCrudTable<CentroCosto>
      title="Centros de Costo"
      apiUrl="/api/centros-costo"
      secondaryApiUrl="/api/areas"
      extractSecondaryData={(data) => (data ?? []).map((a: any) => ({ id: a.id, nombre: a.nombre }))}
      entityName="Centro de Costo"
      createLabel="+ Nuevo Centro de Costo"
      useFormSubmit
      mapToForm={(item) => ({
        nombre: item.nombre,
        codigo: item.codigo,
        presupuesto_anual: item.presupuesto_anual,
        presupuesto_mensual: item.presupuesto_mensual,
        area_id: item.area?.id ?? null,
      })}
      patchUrl={(item) => `/api/centros-costo/${item.id}`}
      columns={(selectedTenant, { openEdit, handleDeactivate }) => [
        ...(!selectedTenant ? [{
          title: 'Organización',
          key: 'tenant',
          width: 180,
          render: (_: unknown, r: CentroCosto) => r.tenant?.nombre ?? '—',
        }] : []),
        { title: 'Código', dataIndex: 'codigo', width: 120, render: (val: string) => <Tag>{val}</Tag> },
        { title: 'Nombre', dataIndex: 'nombre' },
        {
          title: 'Área',
          key: 'area',
          width: 160,
          render: (_: unknown, r: CentroCosto) => r.area?.nombre ?? '—',
        },
        {
          title: 'Presupuesto Anual',
          dataIndex: 'presupuesto_anual',
          width: 160,
          render: (val: number | null) => val ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—',
        },
        {
          title: 'Presupuesto Mensual',
          dataIndex: 'presupuesto_mensual',
          width: 160,
          render: (val: number | null) => val ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—',
        },
        {
          title: 'Estado',
          dataIndex: 'activo',
          width: 100,
          render: (val: boolean) => <Tag color={val ? 'green' : 'default'}>{val ? 'Activo' : 'Inactivo'}</Tag>,
        },
        ...(selectedTenant ? [{
          title: 'Acciones',
          key: 'acciones',
          width: 150,
          render: (_: unknown, row: CentroCosto) => (
            <Space>
              <Button size="small" onClick={() => openEdit(row)}>Editar</Button>
              {row.activo && (
                <Popconfirm
                  title="¿Desactivar este centro de costo?"
                  onConfirm={() => handleDeactivate(row)}
                  okText="Sí"
                  cancelText="No"
                >
                  <Button size="small" danger>Desactivar</Button>
                </Popconfirm>
              )}
            </Space>
          ),
        }] : []),
      ]}
      renderForm={(_form, _editing, areas: AreaOption[]) => (
        <>
          <Form.Item name="area_id" label="Área asociada" rules={[{ required: true, message: 'Seleccione un área' }]}>
            <Select
              placeholder="Seleccionar área..."
              showSearch
              optionFilterProp="label"
              options={areas.map((a) => ({ value: a.id, label: a.nombre }))}
            />
          </Form.Item>
          <Form.Item
            name="codigo"
            label="Código"
            rules={[
              { required: true, message: 'Requerido' },
              { max: 20, message: 'Máximo 20 caracteres' },
              { pattern: /^[A-Z0-9_-]+$/i, message: 'Solo letras, números, guiones y guiones bajos' },
              { whitespace: false, message: 'Sin espacios' },
              () => ({
                validator(_, value) {
                  if (value && value !== value.trim()) return Promise.reject('Sin espacios al inicio o al final');
                  return Promise.resolve();
                },
              }),
            ]}
            extra="Ej: ADM, FIN-01, OP_NORTE"
          >
            <Input placeholder="ADM, FIN, OP..." maxLength={20} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="nombre"
            label="Nombre"
            rules={[
              { required: true, message: 'El nombre es obligatorio' },
              { min: 2, message: 'Mínimo 2 caracteres' },
              { max: 150, message: 'Máximo 150 caracteres' },
              { whitespace: true, message: 'El nombre no puede estar vacío' },
            ]}
          >
            <Input placeholder="Administración, Operaciones..." maxLength={150} />
          </Form.Item>
          <Form.Item name="presupuesto_anual" label="Presupuesto Anual">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999999}
              precision={2}
              placeholder="Opcional"
              formatter={(value) => value ? `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
              parser={(value) => Number(value?.replace(/\$\s?|(\.)/g, '') || 0) as any}
            />
          </Form.Item>
          <Form.Item name="presupuesto_mensual" label="Presupuesto Mensual">
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={999999999}
              precision={2}
              placeholder="Opcional"
              formatter={(value) => value ? `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
              parser={(value) => Number(value?.replace(/\$\s?|(\.)/g, '') || 0) as any}
            />
          </Form.Item>
        </>
      )}
    />
  )
}
