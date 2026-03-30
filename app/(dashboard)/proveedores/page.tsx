'use client'

import { useState, useEffect, useCallback } from 'react'
import { Table, Button, Input, Space, Tag, message, Popconfirm, Modal, Form } from 'antd'
import { PlusOutlined, SearchOutlined, EditOutlined, StopOutlined } from '@ant-design/icons'
import ProveedorCreateModal from '@/components/ProveedorCreateModal'

interface Proveedor {
  id: number
  nombre: string
  cuit: string | null
  datos_bancarios: string | null
  link_pagina: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  activo: boolean
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null)
  const [editForm] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const fetchProveedores = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proveedores?search=${encodeURIComponent(search)}&limit=50`)
      if (res.ok) setProveedores(await res.json())
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchProveedores() }, [fetchProveedores])

  const handleCreated = () => {
    setCreateOpen(false)
    fetchProveedores()
  }

  const handleEdit = (prov: Proveedor) => {
    setEditingProv(prov)
    editForm.setFieldsValue(prov)
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingProv) return
    try {
      const values = await editForm.validateFields()
      setSaving(true)
      const res = await fetch(`/api/proveedores/${editingProv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al actualizar')
      }
      message.success('Proveedor actualizado')
      setEditOpen(false)
      fetchProveedores()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/proveedores/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al desactivar')
      message.success('Proveedor desactivado')
      fetchProveedores()
    } catch {
      message.error('Error al desactivar proveedor')
    }
  }

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre', ellipsis: true },
    { title: 'CUIT', dataIndex: 'cuit', key: 'cuit', width: 140, render: (v: string | null) => v || '—' },
    { title: 'Teléfono', dataIndex: 'telefono', key: 'telefono', width: 140, render: (v: string | null) => v || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 200, ellipsis: true, render: (v: string | null) => v || '—' },
    {
      title: 'Web',
      dataIndex: 'link_pagina',
      key: 'link_pagina',
      width: 80,
      render: (v: string | null) => v ? <a href={v} target="_blank" rel="noopener noreferrer">Ver</a> : '—',
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 160,
      render: (_: unknown, record: Proveedor) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Editar
          </Button>
          <Popconfirm title="¿Desactivar este proveedor?" onConfirm={() => handleDeactivate(record.id)} okText="Sí" cancelText="No">
            <Button type="text" size="small" danger icon={<StopOutlined />}>
              Desactivar
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content" style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontWeight: 700 }}>Proveedores</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Nuevo Proveedor
        </Button>
      </div>

      <Input
        placeholder="Buscar por nombre o CUIT..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={proveedores}
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />

      <ProveedorCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      <Modal
        title="Editar Proveedor"
        open={editOpen}
        onOk={handleEditSave}
        onCancel={() => setEditOpen(false)}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={saving}
        width={520}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Nombre" name="nombre" rules={[{ required: true, message: 'Obligatorio' }]}>
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="CUIT" name="cuit">
            <Input maxLength={13} />
          </Form.Item>
          <Form.Item label="Datos Bancarios" name="datos_bancarios">
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
          <Form.Item label="Link de Página Web" name="link_pagina">
            <Input maxLength={500} />
          </Form.Item>
          <Form.Item label="Teléfono" name="telefono">
            <Input maxLength={50} />
          </Form.Item>
          <Form.Item label="Email" name="email">
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="Dirección" name="direccion">
            <Input maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
