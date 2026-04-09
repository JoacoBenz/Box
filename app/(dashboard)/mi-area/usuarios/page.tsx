'use client'

import { useEffect, useState, useCallback } from 'react'
import { App, Table, Tag, Button, Space, Modal, Form, Input, Select, Popconfirm, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useFormValid } from '@/hooks/useFormValid'

const { Title } = Typography

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
  centro_costo: { id: number; nombre: string; codigo: string } | null
}

export default function MiAreaUsuariosPage() {
  const { message } = App.useApp()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { hasErrors, formProps } = useFormValid(form)
  const [sessionAreaId, setSessionAreaId] = useState<number | null>(null)
  const [areaNombre, setAreaNombre] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios?pageSize=100')
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      setSessionAreaId(s?.user?.areaId ?? null)
      setAreaNombre(s?.user?.areaNombre ?? 'mi área')
    }).catch(() => {})
    fetch('/api/centros-costo').then(r => r.ok ? r.json() : []).then(setCentrosCosto).catch(() => {})
    fetchData()
  }, [fetchData])

  const filteredCentros = centrosCosto.filter(cc => cc.area_id === sessionAreaId)

  function openCreate() {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(u: Usuario) {
    setEditing(u)
    form.setFieldsValue({
      nombre: u.nombre,
      email: u.email,
      centro_costo_id: u.centro_costo?.id ?? null,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const payload = {
        nombre: values.nombre,
        email: values.email,
        area_id: sessionAreaId,
        centro_costo_id: values.centro_costo_id ?? null,
        roles: ['solicitante'],
        ...(editing ? {} : { password: values.password }),
      }

      const url = editing ? `/api/usuarios/${editing.id}` : '/api/usuarios'
      const method = editing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Error al guardar')
      }

      message.success(editing ? 'Usuario actualizado' : 'Usuario creado')
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(u: Usuario) {
    try {
      const res = await fetch(`/api/usuarios/${u.id}/desactivar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !u.activo }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Error')
      }
      message.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
      fetchData()
    } catch (err: any) {
      message.error(err?.message ?? 'Error inesperado')
    }
  }

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 240 },
    {
      title: 'Centro de Costo',
      key: 'cc',
      width: 200,
      render: (_: unknown, r: Usuario) =>
        r.centro_costo ? `${r.centro_costo.codigo} — ${r.centro_costo.nombre}` : '—',
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 180,
      render: (_: unknown, r: Usuario) => (
        <Space>
          <Button size="small" onClick={() => openEdit(r)}>Editar</Button>
          <Popconfirm
            title={r.activo ? '¿Desactivar este usuario?' : '¿Activar este usuario?'}
            onConfirm={() => handleToggleActive(r)}
            okText="Sí"
            cancelText="No"
          >
            <Button size="small" danger={r.activo}>{r.activo ? 'Desactivar' : 'Activar'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
            Usuarios de {areaNombre}
          </Title>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>Solicitantes de tu área</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nuevo Solicitante
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={usuarios}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay usuarios en tu área' }}
      />

      <Modal
        title={editing ? 'Editar Solicitante' : 'Nuevo Solicitante'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={handleSave}
        okText={editing ? 'Guardar' : 'Crear'}
        okButtonProps={{ loading: saving, disabled: hasErrors }}
        cancelText="Cancelar"
        destroyOnHidden={false}
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} {...formProps}>
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
              { type: 'email', message: 'Ingresá un email válido' },
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
        </Form>
      </Modal>
    </div>
  )
}
