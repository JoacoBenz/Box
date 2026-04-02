'use client'

import { Form, Input, Select, Tag, Button, Space, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import AdminCrudTable from '@/components/admin/AdminCrudTable'

interface Area {
  id: number
  nombre: string
  activo: boolean
  responsable: { id: number; nombre: string } | null
  tenant?: { id: number; nombre: string }
}

interface Usuario {
  id: number
  nombre: string
}

export default function AdminAreasPage() {
  return (
    <AdminCrudTable<Area>
      title="Áreas"
      apiUrl="/api/areas"
      secondaryApiUrl="/api/usuarios?pageSize=100"
      extractSecondaryData={(data) => (data.data ?? []).map((u: any) => ({ id: u.id, nombre: u.nombre }))}
      entityName="Área"
      createLabel="+ Nueva Área"
      mapToForm={(area) => ({ nombre: area.nombre, responsable_id: area.responsable?.id ?? null })}
      patchUrl={(area) => `/api/areas/${area.id}`}
      deactivatePayload={(area) => ({ activo: !area.activo })}
      columns={(selectedTenant, { openEdit, handleDeactivate }) => [
        { title: '#', key: 'index', width: 60, render: (_: unknown, __: Area, index: number) => index + 1 },
        ...(!selectedTenant ? [{
          title: 'Organización',
          key: 'tenant',
          width: 180,
          render: (_: unknown, r: Area) => r.tenant?.nombre ?? '—',
        }] : []),
        { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
        {
          title: 'Responsable',
          key: 'responsable',
          render: (_: unknown, r: Area) => r.responsable?.nombre ?? <span style={{ color: '#bbb' }}>Sin asignar</span>,
        },
        {
          title: 'Estado',
          dataIndex: 'activo',
          key: 'activo',
          width: 100,
          render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag>,
        },
        ...(selectedTenant ? [{
          title: 'Acciones',
          key: 'actions',
          width: 180,
          render: (_: unknown, r: Area) => (
            <Space>
              <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
              <Popconfirm
                title={r.activo ? '¿Desactivar esta área?' : '¿Activar esta área?'}
                onConfirm={() => handleDeactivate(r)}
                okText="Sí"
                cancelText="No"
              >
                <Button size="small" danger={r.activo}>{r.activo ? 'Desactivar' : 'Activar'}</Button>
              </Popconfirm>
            </Space>
          ),
        }] : []),
      ]}
      renderForm={(_form, _editing, usuarios: Usuario[]) => (
        <>
          <Form.Item
            label="Nombre del Área"
            name="nombre"
            rules={[
              { required: true, message: 'El nombre es obligatorio' },
              { max: 100, message: 'Máximo 100 caracteres' },
            ]}
          >
            <Input placeholder="Ej: Secretaría, Dirección, Contaduría" autoFocus />
          </Form.Item>
          <Form.Item label="Responsable" name="responsable_id">
            <Select
              placeholder="Seleccionar responsable"
              allowClear
              showSearch
              optionFilterProp="label"
              options={usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
            />
          </Form.Item>
        </>
      )}
    />
  )
}
