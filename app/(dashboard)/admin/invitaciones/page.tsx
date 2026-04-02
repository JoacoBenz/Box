'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  App, Table, Button, Tag, Space, Typography, Modal, Form, InputNumber, Switch, Tooltip,
} from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAdminTenant } from '@/components/admin/TenantSelector'

const { Title, Text } = Typography

interface Codigo {
  id: number
  codigo: string
  activo: boolean
  usos: number
  max_usos: number | null
  expira_el: string
  created_at: string
  creador: { nombre: string }
}

export default function InvitacionesPage() {
  const { message } = App.useApp()
  const [codigos, setCodigos] = useState<Codigo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form] = Form.useForm()
  const [selectedTenant] = useAdminTenant()

  const fetchCodigos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/invitaciones')
      if (!res.ok) throw new Error('Error al cargar')
      setCodigos(await res.json())
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedTenant])

  useEffect(() => { fetchCodigos() }, [fetchCodigos])

  async function handleCreate() {
    try {
      const values = await form.validateFields()
      setCreating(true)
      const res = await fetch('/api/admin/invitaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('Error al crear')
      message.success('Código generado')
      setModalOpen(false)
      form.resetFields()
      fetchCodigos()
    } catch (err: any) {
      if (!err?.errorFields) message.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function toggleActivo(id: number) {
    try {
      const res = await fetch(`/api/admin/invitaciones/${id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Error')
      fetchCodigos()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  function copiarLink(codigo: string) {
    const url = `${window.location.origin}/unirse?codigo=${codigo}`
    navigator.clipboard.writeText(url)
    message.success('Link copiado')
  }

  const columns: ColumnsType<Codigo> = [
    {
      title: 'Código',
      dataIndex: 'codigo',
      key: 'codigo',
      render: (v: string) => <Text code copyable>{v}</Text>,
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 100,
      render: (_, r) => {
        const expirado = new Date(r.expira_el) < new Date()
        const agotado = r.max_usos !== null && r.usos >= r.max_usos
        if (expirado) return <Tag color="default">Expirado</Tag>
        if (agotado) return <Tag color="default">Agotado</Tag>
        return r.activo ? <Tag color="green">Activo</Tag> : <Tag color="default">Inactivo</Tag>
      },
    },
    {
      title: 'Usos',
      key: 'usos',
      width: 100,
      render: (_, r) => r.max_usos ? `${r.usos} / ${r.max_usos}` : `${r.usos} / ilimitado`,
    },
    {
      title: 'Expira',
      dataIndex: 'expira_el',
      key: 'expira',
      width: 130,
      render: (v: string) => new Date(v).toLocaleDateString('es-AR'),
    },
    { title: 'Creado por', key: 'creador', render: (_, r) => r.creador?.nombre ?? '—' },
    {
      title: 'Acciones',
      key: 'actions',
      width: 180,
      render: (_, r) => (
        <Space>
          <Tooltip title="Copiar link de invitación">
            <Button size="small" icon={<CopyOutlined />} onClick={() => copiarLink(r.codigo)} />
          </Tooltip>
          <Button size="small" onClick={() => toggleActivo(r.id)}>
            {r.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Códigos de Invitación</Title>
        <Button type="primary" onClick={() => setModalOpen(true)} style={{ fontWeight: 600 }}>
          + Generar Código
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={codigos}
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title="Generar Código de Invitación"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        confirmLoading={creating}
        okText="Generar"
      >
        <Form form={form} layout="vertical" initialValues={{ dias_validez: 30 }}>
          <Form.Item label="Días de validez" name="dias_validez" rules={[{ required: true, message: 'Ingresá los días de validez' }]}>
            <InputNumber min={1} max={365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Máximo de usos (vacío = ilimitado)" name="max_usos">
            <InputNumber min={1} max={9999} style={{ width: '100%' }} placeholder="Ilimitado" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
