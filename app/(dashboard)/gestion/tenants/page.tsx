'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Typography, Card, Statistic, Row, Col, Space, Badge, Button, Modal, Form, Input, Select, Popconfirm, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  TeamOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useFormValid } from '@/hooks/useFormValid'

const { Title, Text } = Typography

interface TenantStats {
  usuarios: number
  areas: number
  solicitudes: number
  compras: number
  proveedores: number
}

interface Tenant {
  id: number
  nombre: string
  slug: string
  estado: string
  email_contacto: string
  moneda: string
  fecha_registro: string
  desactivado: boolean
  stats: TenantStats
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { hasErrors, formProps } = useFormValid(form)
  const [msg, contextHolder] = message.useMessage()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants')
      if (res.ok) setTenants(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const [initialValues, setInitialValues] = useState<Record<string, unknown>>({ moneda: 'ARS' })

  const openCreate = () => {
    setEditing(null)
    setInitialValues({ moneda: 'ARS' })
    setModalOpen(true)
  }

  const openEdit = (t: Tenant) => {
    setEditing(t)
    setInitialValues({
      nombre: t.nombre,
      email_contacto: t.email_contacto,
      moneda: t.moneda,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const url = editing ? `/api/admin/tenants/${editing.id}` : '/api/admin/tenants'
      const method = editing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const err = await res.json()
        msg.error(err.error?.message || 'Error al guardar')
        return
      }

      msg.success(editing ? 'Organización actualizada' : 'Organización creada')
      setModalOpen(false)
      fetchData()
    } catch {
      // validation error
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (t: Tenant) => {
    const res = await fetch(`/api/admin/tenants/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desactivado: !t.desactivado }),
    })
    if (res.ok) {
      msg.success(t.desactivado ? 'Organización activada' : 'Organización desactivada')
      fetchData()
    } else {
      const err = await res.json()
      msg.error(err.error?.message || 'Error')
    }
  }

  const handleDelete = async (t: Tenant) => {
    const res = await fetch(`/api/admin/tenants/${t.id}`, { method: 'DELETE' })
    if (res.ok) {
      msg.success('Organización eliminada')
      fetchData()
    } else {
      const err = await res.json()
      msg.error(err.error?.message || 'Error al eliminar')
    }
  }

  const totalUsuarios = tenants.reduce((sum, t) => sum + t.stats.usuarios, 0)
  const totalSolicitudes = tenants.reduce((sum, t) => sum + t.stats.solicitudes, 0)

  const columns: ColumnsType<Tenant> = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_: unknown, __: Tenant, index: number) => <Text strong style={{ color: '#4f46e5' }}>#{index + 1}</Text>,
    },
    {
      title: 'Organización',
      key: 'nombre',
      render: (_, t) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{t.nombre}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{t.slug} · {t.email_contacto}</Text>
        </div>
      ),
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 130,
      render: (_, t) => {
        if (t.desactivado) return <Tag color="default">Inactivo</Tag>
        const colors: Record<string, string> = { pendiente: 'orange', activo: 'green', rechazado: 'red', suspendido: 'default' }
        return <Tag color={colors[t.estado] ?? 'default'}>{t.estado.charAt(0).toUpperCase() + t.estado.slice(1)}</Tag>
      },
    },
    {
      title: 'Moneda',
      dataIndex: 'moneda',
      key: 'moneda',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Usuarios',
      key: 'usuarios',
      width: 90,
      align: 'center',
      render: (_, t) => (
        <Space size={4}>
          <TeamOutlined style={{ color: '#4f46e5' }} />
          <Text strong>{t.stats.usuarios}</Text>
        </Space>
      ),
    },
    {
      title: 'Áreas',
      key: 'areas',
      width: 80,
      align: 'center',
      render: (_, t) => (
        <Space size={4}>
          <ApartmentOutlined style={{ color: '#7c3aed' }} />
          <Text strong>{t.stats.areas}</Text>
        </Space>
      ),
    },
    {
      title: 'Solicitudes',
      key: 'solicitudes',
      width: 100,
      align: 'center',
      render: (_, t) => (
        <Space size={4}>
          <FileTextOutlined style={{ color: '#0891b2' }} />
          <Text strong>{t.stats.solicitudes}</Text>
        </Space>
      ),
    },
    {
      title: 'Compras',
      key: 'compras',
      width: 90,
      align: 'center',
      render: (_, t) => (
        <Space size={4}>
          <ShoppingCartOutlined style={{ color: '#16a34a' }} />
          <Text strong>{t.stats.compras}</Text>
        </Space>
      ),
    },
    {
      title: 'Proveedores',
      key: 'proveedores',
      width: 100,
      align: 'center',
      render: (_, t) => (
        <Space size={4}>
          <ShopOutlined style={{ color: '#ea580c' }} />
          <Text strong>{t.stats.proveedores}</Text>
        </Space>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 140,
      render: (_, t) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(t)}
            title="Editar"
          />
          <Button
            type="text"
            size="small"
            icon={t.desactivado ? <CheckCircleOutlined style={{ color: '#16a34a' }} /> : <StopOutlined style={{ color: '#f59e0b' }} />}
            onClick={() => handleToggleActive(t)}
            title={t.desactivado ? 'Activar' : 'Desactivar'}
          />
          <Popconfirm
            title="Eliminar organización"
            description="Esta acción no se puede deshacer. Las organizaciones con datos no pueden eliminarse."
            onConfirm={() => handleDelete(t)}
            okText="Eliminar"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="Eliminar"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobalOutlined style={{ fontSize: 24, color: '#4f46e5' }} />
          <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
            Organizaciones
          </Title>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nueva Organización
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 16, borderLeft: '4px solid #4f46e5' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Organizaciones</Text>}
              value={tenants.length}
              prefix={<GlobalOutlined style={{ color: '#4f46e5' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 16, borderLeft: '4px solid #7c3aed' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Usuarios</Text>}
              value={totalUsuarios}
              prefix={<TeamOutlined style={{ color: '#7c3aed' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 16, borderLeft: '4px solid #16a34a' }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 12 }}>Total Solicitudes</Text>}
              value={totalSolicitudes}
              prefix={<FileTextOutlined style={{ color: '#16a34a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={tenants}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay organizaciones registradas' }}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Editar Organización' : 'Nueva Organización'}
        okText={editing ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okButtonProps={{ disabled: hasErrors }}
        destroyOnHidden
        afterOpenChange={(open) => { if (open) form.setFieldsValue(initialValues) }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false} initialValues={initialValues} {...formProps}>
          <Form.Item
            name="nombre"
            label="Nombre de la organización"
            rules={[{ required: true, message: 'Ingresá el nombre' }]}
          >
            <Input placeholder="Ej: Colegio San José" />
          </Form.Item>
          <Form.Item
            name="email_contacto"
            label="Email de contacto"
            rules={[
              { required: true, message: 'Ingresá el email' },
              { type: 'email', message: 'Email inválido' },
            ]}
          >
            <Input placeholder="admin@colegio.edu.ar" />
          </Form.Item>
          <Form.Item
            name="moneda"
            label="Moneda"
            rules={[{ required: true, message: 'Seleccioná la moneda' }]}
          >
            <Select
              options={[
                { value: 'ARS', label: 'ARS — Peso Argentino' },
                { value: 'USD', label: 'USD — Dólar' },
                { value: 'EUR', label: 'EUR — Euro' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
