'use client'

import { useEffect, useState, useCallback } from 'react'
import { App, Table, Button, Tag, Space, Typography, Popconfirm } from 'antd'
import type { ColumnsType } from 'antd/es/table'

const { Title } = Typography

interface Tenant {
  id: number
  nombre: string
  slug: string
  email_contacto: string
  estado: string
  fecha_registro: string
  _count?: { usuarios: number; areas: number }
}

export default function AprobacionesOrgPage() {
  const { message } = App.useApp()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => { fetchPendientes() }, [fetchPendientes])

  async function cambiarEstado(id: number, estado: 'activo' | 'rechazado') {
    try {
      const res = await fetch(`/api/admin/tenants/${id}/estado`, {
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
            <Button type="primary" size="small">Aprobar</Button>
          </Popconfirm>
          <Popconfirm
            title="¿Rechazar esta organización?"
            description="Los usuarios no podrán acceder."
            onConfirm={() => cambiarEstado(r.id, 'rechazado')}
            okText="Rechazar"
            cancelText="Cancelar"
          >
            <Button danger size="small">Rechazar</Button>
          </Popconfirm>
        </Space>
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
    </div>
  )
}
