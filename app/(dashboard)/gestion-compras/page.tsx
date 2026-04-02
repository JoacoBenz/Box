'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Button, Typography, Modal, Form, Select, Input, DatePicker, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  tipo: string
  prioridad_compra: string | null
  dia_pago_programado: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

const ALL_ESTADOS = Object.entries(ESTADOS_SOLICITUD).map(([value, { label }]) => ({ value, label }))

export default function GestionComprasPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [estadoFilter, setEstadoFilter] = useState<string>('en_compras')

  const [programarOpen, setProgramarOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [programarForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = estadoFilter ? `estado=${estadoFilter}` : ''
      const res = await fetch(`/api/solicitudes?${params}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [estadoFilter])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const handler = () => { fetchData() }
    window.addEventListener('admin-tenant-change', handler)
    return () => window.removeEventListener('admin-tenant-change', handler)
  }, [fetchData])

  async function handleProgramarPago(values: { prioridad_compra: string; dia_pago_programado: any; observaciones?: string }) {
    if (!selectedId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/solicitudes/${selectedId}/procesar-compras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prioridad_compra: values.prioridad_compra,
          dia_pago_programado: values.dia_pago_programado.toISOString(),
          observaciones: values.observaciones || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        setProgramarOpen(false)
        programarForm.resetFields()
        fetchData()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const PRIORIDAD_COLORS: Record<string, string> = {
    urgente: 'red',
    normal: 'blue',
    programado: 'default',
  }

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'N°',
      dataIndex: 'numero',
      width: 130,
      render: (val, row) => <Link href={`/solicitudes/${row.id}`}>{val}</Link>,
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      render: (val, row) => (
        <Space orientation="vertical" size={2}>
          <Link href={`/solicitudes/${row.id}`} style={{ fontWeight: 500 }}>{val}</Link>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.area?.nombre ?? '—'} · {row.solicitante.nombre}</Text>
        </Space>
      ),
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      width: 100,
      render: (val: UrgenciaSolicitud) => {
        const info = URGENCIAS[val]
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 140,
      render: (val: EstadoSolicitud) => {
        const info = ESTADOS_SOLICITUD[val]
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad_compra',
      width: 100,
      render: (val: string | null) =>
        val ? <Tag color={PRIORIDAD_COLORS[val] ?? 'default'}>{val.charAt(0).toUpperCase() + val.slice(1)}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Día de pago',
      dataIndex: 'dia_pago_programado',
      width: 120,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleDateString('es-AR') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 180,
      render: (_, row) => (
        <Space size="small" wrap>
          {row.estado === 'en_compras' && (
            <Button
              size="small"
              type="primary"
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              onClick={() => { setSelectedId(row.id); setProgramarOpen(true) }}
            >
              Programar Pago
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>Gestión de Compras</Title>
        <Text type="secondary" style={{ marginTop: 4, display: 'block' }}>Pipeline de solicitudes para programar pagos</Text>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Estado:</Text>
          <Select
            value={estadoFilter}
            onChange={setEstadoFilter}
            style={{ width: 220 }}
            allowClear
            placeholder="Todos los estados"
            options={[{ value: '', label: 'Todos los estados' }, ...ALL_ESTADOS]}
          />
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={solicitudes}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
        locale={{ emptyText: 'No hay solicitudes para mostrar' }}
        rowClassName={(record: any) =>
          record.urgencia === 'critica' ? 'urgencia-row-critica' :
          record.urgencia === 'urgente' ? 'urgencia-row-urgente' :
          'urgencia-row-normal'
        }
      />

      {/* Modal: Programar Pago */}
      <Modal
        title="Programar Pago"
        open={programarOpen}
        onCancel={() => { setProgramarOpen(false); programarForm.resetFields() }}
        onOk={() => programarForm.submit()}
        okText="Programar Pago"
        okButtonProps={{ loading: actionLoading }}
        cancelText="Cancelar"
      >
        <Form form={programarForm} layout="vertical" onFinish={handleProgramarPago}>
          <Form.Item name="prioridad_compra" label="Prioridad" rules={[{ required: true, message: 'Seleccioná la prioridad' }]}>
            <Select placeholder="Seleccionar prioridad" options={[
              { value: 'urgente', label: 'Urgente' },
              { value: 'normal', label: 'Normal' },
              { value: 'programado', label: 'Programado' },
            ]} />
          </Form.Item>
          <Form.Item
            name="dia_pago_programado"
            label="Fecha de pago"
            rules={[{ required: true, message: 'Seleccioná la fecha de pago' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(d) => d && d < dayjs().startOf('day')}
              placeholder="Seleccionar fecha"
            />
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones">
            <TextArea rows={3} placeholder="Notas internas de Compras..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
