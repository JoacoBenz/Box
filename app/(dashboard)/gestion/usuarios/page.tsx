'use client'

import { useEffect, useState } from 'react'
import { Form, Input, Select, Tag, Button, Space, Popconfirm } from 'antd'
import type { FormInstance } from 'antd/es/form'
import type { RolNombre } from '@/types'
import AdminCrudTable from '@/components/admin/AdminCrudTable'

const ROL_COLORS: Record<RolNombre, string> = {
  solicitante: 'blue',
  responsable_area: 'cyan',
  director: 'purple',
  tesoreria: 'gold',
  compras: 'orange',
  admin: 'red',
}

const ROL_LABELS: Record<RolNombre, string> = {
  solicitante: 'Solicitante',
  responsable_area: 'Responsable de Área',
  director: 'Director/a',
  tesoreria: 'Tesorería',
  compras: 'Compras',
  admin: 'Administrador',
}

interface Area {
  id: number
  nombre: string
}

interface CentroCosto {
  id: number
  nombre: string
  codigo: string
  area_id: number | null
}

interface Usuario {
  id: number
  nombre: string
  email: string
  activo: boolean
  area: { id: number; nombre: string } | null
  centro_costo: { id: number; nombre: string; codigo: string } | null
  area_sugerida?: string | null
  usuarios_roles: { rol: { id: number; nombre: string } }[]
  tenant?: { id: number; nombre: string }
}

function UsuarioFormFields({ form, editing, areas }: { form: FormInstance; editing: Usuario | null; areas: Area[] }) {
  const [sessionRoles, setSessionRoles] = useState<string[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const selectedAreaId = Form.useWatch('area_id', form)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      setSessionRoles(s?.user?.roles ?? [])
    }).catch(() => {})
    fetch('/api/centros-costo').then(r => r.ok ? r.json() : []).then(setCentrosCosto).catch(() => {})
  }, [])

  // Filter centros by selected area (show area's CCs + general ones with no area)
  const filteredCentros = centrosCosto.filter(cc => !cc.area_id || cc.area_id === selectedAreaId)

  return (
    <>
      <Form.Item
        label="Nombre completo"
        name="nombre"
        rules={[{ required: true, message: 'El nombre es obligatorio' }]}
      >
        <Input placeholder="Ej: María García" autoFocus />
      </Form.Item>

      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: 'El email es obligatorio' },
          { type: 'email', message: 'Ingrese un email válido' },
        ]}
      >
        <Input placeholder="usuario@empresa.com" />
      </Form.Item>

      {!editing && (
        <Form.Item
          label="Contraseña"
          name="password"
          rules={[
            { required: true, message: 'La contraseña es obligatoria' },
            { min: 10, message: 'Mínimo 10 caracteres' },
            { pattern: /[A-Z]/, message: 'Debe contener al menos una mayúscula' },
            { pattern: /[a-z]/, message: 'Debe contener al menos una minúscula' },
            { pattern: /[0-9]/, message: 'Debe contener al menos un número' },
            { pattern: /[^A-Za-z0-9]/, message: 'Debe contener al menos un carácter especial (!@#$%...)' },
          ]}
        >
          <Input.Password placeholder="Mínimo 10 caracteres, mayúscula, minúscula, número y especial" />
        </Form.Item>
      )}

      <Form.Item label="Área" name="area_id" rules={[{ required: true, message: 'El área es obligatoria' }]}>
        <Select
          placeholder="Seleccionar área"
          options={areas.map((a) => ({ value: a.id, label: a.nombre }))}
          onChange={() => form.setFieldValue('centro_costo_id', null)}
        />
      </Form.Item>

      {filteredCentros.length > 0 && (
        <Form.Item label="Centro de Costo" name="centro_costo_id">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Seleccionar centro de costo"
            options={filteredCentros.map(cc => ({
              value: cc.id,
              label: `${cc.codigo} — ${cc.nombre}`,
            }))}
          />
        </Form.Item>
      )}

      <Form.Item
        label="Roles"
        name="roles"
        rules={[{ required: true, message: 'Asigne al menos un rol' }]}
      >
        <Select
          mode="multiple"
          placeholder="Seleccionar roles"
          options={(Object.keys(ROL_LABELS) as RolNombre[])
            .filter((r) => r !== 'admin' || sessionRoles.includes('admin'))
            .map((r) => ({ value: r, label: ROL_LABELS[r] }))}
        />
      </Form.Item>
    </>
  )
}

export default function AdminUsuariosPage() {
  return (
    <AdminCrudTable<Usuario>
      title="Usuarios"
      apiUrl="/api/usuarios"
      secondaryApiUrl="/api/areas"
      extractSecondaryData={(data) => Array.isArray(data) ? data : data.data ?? []}
      entityName="Usuario"
      createLabel="+ Nuevo Usuario"
      modalWidth={520}
      mapToForm={(u) => ({
        nombre: u.nombre,
        email: u.email,
        area_id: u.area?.id,
        centro_costo_id: u.centro_costo?.id ?? null,
        roles: u.usuarios_roles.map((r) => r.rol.nombre),
      })}
      mapPayload={(values, editing) => {
        const payload: Record<string, unknown> = {
          nombre: values.nombre,
          email: values.email,
          area_id: values.area_id,
          centro_costo_id: values.centro_costo_id ?? null,
          roles: values.roles,
        }
        if (!editing && values.password) payload.password = values.password
        return payload
      }}
      patchUrl={(u) => `/api/usuarios/${u.id}`}
      deactivateUrl={(u) => `/api/usuarios/${u.id}/desactivar`}
      deactivatePayload={(u) => ({ activo: !u.activo })}
      columns={(selectedTenant, { openEdit, handleDeactivate }) => [
        ...(!selectedTenant ? [{
          title: 'Organización',
          key: 'tenant',
          width: 180,
          render: (_: unknown, r: Usuario) => r.tenant?.nombre ?? '—',
        }] : []),
        { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
        { title: 'Email', dataIndex: 'email', key: 'email', width: 220 },
        {
          title: 'Área',
          key: 'area',
          width: 200,
          render: (_: unknown, r: Usuario) => {
            if (r.area) return r.area.nombre
            if (r.area_sugerida) return <Tag color="orange">Sugerida: {r.area_sugerida}</Tag>
            return '—'
          },
        },
        {
          title: 'Roles',
          key: 'roles',
          render: (_: unknown, r: Usuario) =>
            r.usuarios_roles?.length > 0
              ? r.usuarios_roles.map((rr) => {
                  const rol = rr.rol?.nombre as RolNombre
                  return (
                    <Tag key={rol} color={ROL_COLORS[rol] ?? 'default'} style={{ marginBottom: 2 }}>
                      {ROL_LABELS[rol] ?? rol}
                    </Tag>
                  )
                })
              : <Tag color="default">Sin roles</Tag>,
        },
        {
          title: 'Estado',
          dataIndex: 'activo',
          key: 'activo',
          width: 100,
          render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
        },
        ...(selectedTenant ? [{
          title: 'Acciones',
          key: 'actions',
          width: 180,
          render: (_: unknown, r: Usuario) => (
            <Space>
              <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
              <Popconfirm
                title={r.activo ? '¿Desactivar este usuario?' : '¿Activar este usuario?'}
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
      renderForm={(form, editing, areas: Area[]) => (
        <UsuarioFormFields form={form} editing={editing as Usuario | null} areas={areas} />
      )}
    />
  )
}
