'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Button, Modal, Form, Input, Tag, Popconfirm, Typography, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined } from '@ant-design/icons'
import { InputNumber } from 'antd'

const { Title } = Typography

interface CentroCosto {
  id: number
  nombre: string
  codigo: string
  activo: boolean
  presupuesto_anual: number | null
  presupuesto_mensual: number | null
}

export default function CentrosCostoPage() {
  const [centros, setCentros] = useState<CentroCosto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CentroCosto | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/centros-costo')
      if (res.ok) setCentros(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    setEditItem(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(item: CentroCosto) {
    setEditItem(item)
    form.setFieldsValue({ nombre: item.nombre, codigo: item.codigo, presupuesto_anual: item.presupuesto_anual, presupuesto_mensual: item.presupuesto_mensual })
    setModalOpen(true)
  }

  async function handleSave(values: { nombre: string; codigo: string }) {
    setSaving(true)
    try {
      const url = editItem ? `/api/centros-costo/${editItem.id}` : '/api/centros-costo'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        setModalOpen(false)
        form.resetFields()
        fetchData()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(id: number) {
    await fetch(`/api/centros-costo/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: false }),
    })
    fetchData()
  }

  const columns: ColumnsType<CentroCosto> = [
    { title: 'Código', dataIndex: 'codigo', width: 120, render: (val) => <Tag>{val}</Tag> },
    { title: 'Nombre', dataIndex: 'nombre' },
    {
      title: 'Presupuesto Anual',
      dataIndex: 'presupuesto_anual',
      width: 160,
      render: (val: number | null) => val != null ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: 'Presupuesto Mensual',
      dataIndex: 'presupuesto_mensual',
      width: 160,
      render: (val: number | null) => val != null ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-',
    },
    {
      title: 'Estado',
      dataIndex: 'activo',
      width: 100,
      render: (val: boolean) => <Tag color={val ? 'green' : 'default'}>{val ? 'Activo' : 'Inactivo'}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 150,
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => openEdit(row)}>Editar</Button>
          {row.activo && (
            <Popconfirm
              title="¿Desactivar este centro de costo?"
              onConfirm={() => handleDeactivate(row.id)}
              okText="Sí"
              cancelText="No"
            >
              <Button size="small" danger>Desactivar</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Centros de Costo</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nuevo Centro de Costo
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={centros}
        rowKey="id"
        loading={loading}
        pagination={false}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      />

      <Modal
        title={editItem ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        okText={editItem ? 'Guardar' : 'Crear'}
        okButtonProps={{ loading: saving }}
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
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
          <Form.Item
            name="presupuesto_anual"
            label="Presupuesto Anual"
          >
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
          <Form.Item
            name="presupuesto_mensual"
            label="Presupuesto Mensual"
          >
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
        </Form>
      </Modal>
    </div>
  )
}
