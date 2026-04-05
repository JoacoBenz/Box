'use client'

import { useEffect, useState, useCallback } from 'react'
import { App, Table, Button, Tag, Space, Typography, Popconfirm, Divider, Tooltip } from 'antd'
import { MailOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

interface Tenant {
  id: number
  nombre: string
  slug: string
  email_contacto: string
  estado: string
  fecha_registro: string
  _count?: { usuarios: number; areas: number }
}

interface RegistroPendiente {
  id: number
  nombre_organizacion: string
  nombre_usuario: string
  email: string
  expira_el: string
  created_at: string
  expirado: boolean
}

export default function AprobacionesOrgPage() {
  const { message } = App.useApp()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [registros, setRegistros] = useState<RegistroPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRegistros, setLoadingRegistros] = useState(true)

  const fetchPendientes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tenants?estado=pendiente')
      if (!res.ok) throw new Error('Error al cargar')
      const data = await res.json()
      setTenants(Array.isArray(data) ? data : data.data ?? [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRegistros = useCallback(async () => {
    setLoadingRegistros(true)
    try {
      const res = await fetch('/api/admin/registros-pendientes')
      if (!res.ok) throw new Error('Error al cargar registros')
      const data = await res.json()
      setRegistros(Array.isArray(data) ? data : [])
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoadingRegistros(false)
    }
  }, [])

  useEffect(() => { fetchPendientes(); fetchRegistros() }, [fetchPendientes, fetchRegistros])

  const [actionLoading, setActionLoading] = useState<number | null>(null)

  async function cambiarEstado(id: number, estado: 'activo' | 'rechazado') {
    try {
      setActionLoading(id)
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error')
      }
      message.success(estado === 'activo' ? 'Organización aprobada' : 'Organización rechazada')
      fetchPendientes()
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function eliminarRegistro(id: number) {
    try {
      const res = await fetch(`/api/admin/registros-pendientes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      message.success('Registro eliminado')
      fetchRegistros()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const columns: ColumnsType<Tenant> = [
    { title: 'Organización', dataIndex: 'nombre', key: 'nombre' },
    { title: 'Email', dataIndex: 'email_contacto', key: 'email' },
    { title: 'Slug', dataIndex: 'slug', key: 'slug', width: 160 },
    {
      title: 'Fecha de Registro',
      dataIndex: 'fecha_registro',
      key: 'fecha',
      width: 160,
      render: (v: string) => new Date(v).toLocaleDateString('es-AR'),
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 120,
      render: (v: string) => <Tag color="orange">{v}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 220,
      render: (_, r) => (
        <Space>
          <Popconfirm
            title="¿Aprobar esta organización?"
            description="La organización podrá comenzar a usar el sistema."
            onConfirm={() => cambiarEstado(r.id, 'activo')}
            okText="Aprobar"
            cancelText="Cancelar"
          >
            <Button type="primary" size="small" loading={actionLoading === r.id} disabled={actionLoading !== null}>Aprobar</Button>
          </Popconfirm>
          <Popconfirm
            title="¿Rechazar esta organización?"
            description="Los usuarios no podrán acceder."
            onConfirm={() => cambiarEstado(r.id, 'rechazado')}
            okText="Rechazar"
            cancelText="Cancelar"
          >
            <Button danger size="small" loading={actionLoading === r.id} disabled={actionLoading !== null}>Rechazar</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const registrosColumns: ColumnsType<RegistroPendiente> = [
    { title: 'Organización', dataIndex: 'nombre_organizacion', key: 'org' },
    { title: 'Contacto', dataIndex: 'nombre_usuario', key: 'nombre' },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <Space>
          <span>{email}</span>
          <Tooltip title={`Enviar email a ${email}`}>
            <a href={`mailto:${email}`}><MailOutlined style={{ color: '#1677ff' }} /></a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Fecha de Registro',
      dataIndex: 'created_at',
      key: 'fecha',
      width: 160,
      render: (v: string) => new Date(v).toLocaleDateString('es-AR'),
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 140,
      render: (_, r) => r.expirado
        ? <Tag color="red">Link expirado</Tag>
        : <Tag color="blue">Esperando verificación</Tag>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Popconfirm
          title="¿Eliminar este registro?"
          description="Se eliminará permanentemente."
          onConfirm={() => eliminarRegistro(r.id)}
          okText="Eliminar"
          cancelText="Cancelar"
        >
          <Button size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>
          Organizaciones Pendientes
        </Title>
        <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
          {tenants.length} pendiente{tenants.length !== 1 ? 's' : ''}
        </Tag>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={tenants}
        loading={loading}
        pagination={false}
        size="middle"
        locale={{ emptyText: 'No hay organizaciones pendientes de aprobación' }}
      />

      <Divider />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
            Registros sin verificar email
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Organizaciones que se registraron pero no completaron la verificación de email. Posibles clientes para contactar.
          </Text>
        </div>
        <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
          {registros.length} registro{registros.length !== 1 ? 's' : ''}
        </Tag>
      </div>

      <Table
        rowKey="id"
        columns={registrosColumns}
        dataSource={registros}
        loading={loadingRegistros}
        pagination={registros.length > 10 ? { pageSize: 10 } : false}
        size="middle"
        locale={{ emptyText: 'No hay registros pendientes de verificación' }}
      />
    </div>
  )
}
