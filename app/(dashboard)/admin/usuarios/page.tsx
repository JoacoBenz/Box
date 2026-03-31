'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  App,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { RolNombre } from '@/types'
import { useAdminTenant } from '@/components/admin/TenantSelector'

const { Title } = Typography

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

interface Usuario {
  id: number
  nombre: string
  email: string
  activo: boolean
  area: { id: number; nombre: string } | null
  usuarios_roles: { rol: { id: number; nombre: string } }[]
  tenant?: { id: number; nombre: string }
}

export default function AdminUsuariosPage() {
  const { message } = App.useApp()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [selectedTenant] = useAdminTenant()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, areasRes] = await Promise.all([
        fetch('/api/usuarios'),
        fetch('/api/areas'),
      ])
      if (!usersRes.ok) throw new Error('Error al cargar usuarios')
      if (!areasRes.ok) throw new Error('Error al cargar áreas')

      const usersData = await usersRes.json()
      const areasData = await areasRes.json()

      setUsuarios(Array.isArray(usersData) ? usersData : usersData.data ?? [])
      setAreas(Array.isArray(areasData) ? areasData : areasData.data ?? [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedTenant])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    if (!selectedTenant) {
      message.warning('Seleccioná una organización antes de crear un usuario')
      return
    }
    setEditUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(u: Usuario) {
    setEditUser(u)
    form.setFieldsValue({
      nombre: u.nombre,
      email: u.email,
      area_id: u.area?.id,
      roles: u.usuarios_roles.map((r) => r.rol.nombre),
    })
    setModalOpen(true)
  }

  async function handleSave() {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const url = editUser ? `/api/usuarios/${editUser.id}` : '/api/usuarios'
      const method = editUser ? 'PATCH' : 'POST'

      const payload: Record<string, unknown> = {
        nombre: values.nombre,
        email: values.email,
        area_id: values.area_id,
        roles: values.roles,
      }
      if (!editUser && values.password) payload.password = values.password

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al guardar')
      }

      message.success(editUser ? 'Usuario actualizado' : 'Usuario creado correctamente')
      setModalOpen(false)
      fetchData()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(u: Usuario) {
    try {
      const res = await fetch(`/api/usuarios/${u.id}/desactivar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al actualizar')
      }
      message.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
      fetchData()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const columns: ColumnsType<Usuario> = [
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
      width: 160,
      render: (_, r) => r.area ? r.area.nombre : '—',
    },
    {
      title: 'Roles',
      key: 'roles',
      render: (_, r) =>
        r.usuarios_roles?.length > 0
          ? r.usuarios_roles?.map((rr) => {
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
  ]

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Usuarios</Title>
        {selectedTenant && <Button type="primary" onClick={openCreate} style={{ fontWeight: 600 }}>+ Nuevo Usuario</Button>}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={usuarios}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
      />

      <Modal
        title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editUser ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        destroyOnHidden={false}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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

          {!editUser && (
            <Form.Item
              label="Contraseña"
              name="password"
              rules={[
                { required: true, message: 'La contraseña es obligatoria' },
                { min: 8, message: 'Mínimo 8 caracteres' },
              ]}
            >
              <Input.Password placeholder="Mínimo 8 caracteres" />
            </Form.Item>
          )}

          <Form.Item label="Área" name="area_id">
            <Select
              allowClear
              placeholder="Seleccionar área"
              options={areas.map((a) => ({ value: a.id, label: a.nombre }))}
            />
          </Form.Item>

          <Form.Item
            label="Roles"
            name="roles"
            rules={[{ required: true, message: 'Asigne al menos un rol' }]}
          >
            <Select
              mode="multiple"
              placeholder="Seleccionar roles"
              options={(Object.keys(ROL_LABELS) as RolNombre[]).map((r) => ({
                value: r,
                label: ROL_LABELS[r],
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
