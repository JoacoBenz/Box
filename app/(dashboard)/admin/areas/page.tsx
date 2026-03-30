'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Popconfirm,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

interface Area {
  id: number
  nombre: string
  activo: boolean
  responsable: { nombre: string } | null
}

export default function AdminAreasPage() {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editArea, setEditArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchAreas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/areas')
      if (!res.ok) throw new Error('Error al cargar las áreas')
      const data = await res.json()
      setAreas(Array.isArray(data) ? data : data.data ?? [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAreas() }, [fetchAreas])

  function openCreate() {
    setEditArea(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(area: Area) {
    setEditArea(area)
    form.setFieldsValue({ nombre: area.nombre })
    setModalOpen(true)
  }

  async function handleSave() {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const url = editArea ? `/api/areas/${editArea.id}` : '/api/areas'
      const method = editArea ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al guardar')
      }

      message.success(editArea ? 'Área actualizada' : 'Área creada correctamente')
      setModalOpen(false)
      fetchAreas()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(area: Area) {
    try {
      const res = await fetch(`/api/areas/${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !area.activo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al actualizar')
      }
      message.success(area.activo ? 'Área desactivada' : 'Área activada')
      fetchAreas()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const columns: ColumnsType<Area> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    { title: 'Nombre', dataIndex: 'nombre', key: 'nombre' },
    {
      title: 'Responsable',
      key: 'responsable',
      render: (_, r) => r.responsable?.nombre ?? <span style={{ color: '#bbb' }}>Sin asignar</span>,
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      key: 'activo',
      width: 100,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Activa' : 'Inactiva'}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 180,
      render: (_, r) => (
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
    },
  ]

  return (
    <div className="page-content" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.5px' }}>Áreas</Title>
        <Button type="primary" onClick={openCreate} style={{ fontWeight: 600 }}>+ Nueva &Aacute;rea</Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={areas}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
      />

      <Modal
        title={editArea ? 'Editar Área' : 'Nueva Área'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editArea ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
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
        </Form>
      </Modal>
    </div>
  )
}
